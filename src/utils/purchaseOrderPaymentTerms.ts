// Enhanced Payment Terms Calculation for Purchase Orders
import { supabase } from '@/src/lib/supabaseClient';

interface PaymentTerm {
  id_payment_term: number;
  calculation_type: string;
  days: number;
  payment_dates?: number[];
  payment_day_of_week?: number;
}

interface PurchaseOrder {
  id: number;
  po_date: string; // tanggal PO dibuat
  tanggal_barang_sampai?: string; // tanggal barang diterima
  id_payment_term?: number;
}

// Calculate due date for purchase order based on payment terms
export const calculatePODueDate = async (
  po: PurchaseOrder
): Promise<{ dueDate: Date | null; description: string }> => {
  if (!po.id_payment_term) {
    return { 
      dueDate: null, 
      description: 'Payment term belum ditentukan' 
    };
  }

  try {
    // Fetch payment term details
    const { data: paymentTerm, error } = await supabase
      .from('payment_terms')
      .select('*')
      .eq('id_payment_term', po.id_payment_term)
      .single();

    if (error || !paymentTerm) {
      return { 
        dueDate: null, 
        description: 'Payment term tidak ditemukan' 
      };
    }

    let baseDate: Date;
    let description: string;

    switch (paymentTerm.calculation_type) {
      case 'from_invoice':
        // Base date = tanggal PO dibuat
        baseDate = new Date(po.po_date);
        description = `${paymentTerm.days} hari dari tanggal PO`;
        break;

      case 'from_delivery':
        // Base date = tanggal barang sampai
        if (!po.tanggal_barang_sampai) {
          return { 
            dueDate: null, 
            description: 'Menunggu barang sampai' 
          };
        }
        baseDate = new Date(po.tanggal_barang_sampai);
        description = `${paymentTerm.days} hari dari barang sampai`;
        break;

      case 'fixed_dates':
        // Base date = tanggal PO, tapi due date berdasarkan tanggal tetap
        baseDate = new Date(po.po_date);
        if (paymentTerm.payment_dates && paymentTerm.payment_dates.length > 0) {
          const currentDay = baseDate.getDate();
          let nextPaymentDate: Date | null = null;
          
          for (const paymentDate of paymentTerm.payment_dates) {
            let targetDate: Date;
            
            if (paymentDate === 999) {
              // End of month - get last day of current month
              targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
            } else {
              // Specific date
              targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), paymentDate);
            }
            
            // If target date is in the past, move to next month
            if (targetDate <= baseDate) {
              if (paymentDate === 999) {
                // Next month end
                targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 2, 0);
              } else {
                // Next month same date
                targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, paymentDate);
              }
            }
            
            // Find the earliest valid payment date
            if (!nextPaymentDate || targetDate < nextPaymentDate) {
              nextPaymentDate = targetDate;
            }
          }
          
          if (nextPaymentDate) {
            const dates = paymentTerm.payment_dates.map((date: number) => 
              date === 999 ? 'akhir bulan' : `tanggal ${date}`
            );
            description = `Pembayaran ${dates.join(' atau ')}`;
            return { dueDate: nextPaymentDate, description };
          }
        }
        description = 'Tanggal pembayaran tetap';
        break;

      case 'weekly':
        // Base date = tanggal PO
        baseDate = new Date(po.po_date);
        if (paymentTerm.payment_day_of_week !== undefined) {
          const currentDay = baseDate.getDay();
          const targetDay = paymentTerm.payment_day_of_week;
          let daysToAdd = targetDay - currentDay;
          
          // If target day is today or in the past, move to next week
          if (daysToAdd <= 0) {
            daysToAdd += 7;
          }
          
          const dueDate = new Date(baseDate);
          dueDate.setDate(dueDate.getDate() + daysToAdd);
          
          const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          description = `Setiap hari ${days[paymentTerm.payment_day_of_week]}`;
          return { dueDate, description };
        }
        description = 'Pembayaran mingguan';
        break;

      default:
        baseDate = new Date(po.po_date);
        description = `${paymentTerm.days} hari dari tanggal PO`;
        break;
    }

    // Calculate due date for from_invoice and from_delivery
    if (paymentTerm.calculation_type === 'from_invoice' || paymentTerm.calculation_type === 'from_delivery') {
      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + paymentTerm.days);
      return { dueDate, description };
    }

    return { 
      dueDate: baseDate, 
      description 
    };

  } catch (error) {
    console.error('Error calculating due date:', error);
    return { 
      dueDate: null, 
      description: 'Error menghitung jatuh tempo' 
    };
  }
};

// Update purchase order due date when payment term or delivery date changes
export const updatePODueDate = async (poId: number): Promise<boolean> => {
  try {
    // Get PO data
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, po_date, tanggal_barang_sampai, id_payment_term')
      .eq('id', poId)
      .single();

    if (poError || !po) {
      console.error('Error fetching PO:', poError);
      return false;
    }

    // Calculate new due date
    const { dueDate } = await calculatePODueDate(po);

    // Update PO with new due date
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({ 
        tanggal_jatuh_tempo: dueDate ? dueDate.toISOString().split('T')[0] : null 
      })
      .eq('id', poId);

    if (updateError) {
      console.error('Error updating due date:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating PO due date:', error);
    return false;
  }
};

// Batch update all POs due dates (useful for migration)
export const batchUpdatePODueDates = async (): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  try {
    // Get all POs with payment terms
    const { data: pos, error } = await supabase
      .from('purchase_orders')
      .select('id, po_date, tanggal_barang_sampai, id_payment_term')
      .not('id_payment_term', 'is', null);

    if (error || !pos) {
      console.error('Error fetching POs:', error);
      return { success: 0, failed: 0 };
    }

    // Process in batches of 10
    for (let i = 0; i < pos.length; i += 10) {
      const batch = pos.slice(i, i + 10);
      
      const updatePromises = batch.map(async (po) => {
        try {
          const { dueDate } = await calculatePODueDate(po);
          
          await supabase
            .from('purchase_orders')
            .update({ 
              tanggal_jatuh_tempo: dueDate ? dueDate.toISOString().split('T')[0] : null 
            })
            .eq('id', po.id);
          
          success++;
        } catch (error) {
          console.error(`Error updating PO ${po.id}:`, error);
          failed++;
        }
      });

      await Promise.all(updatePromises);
    }

  } catch (error) {
    console.error('Error in batch update:', error);
  }

  return { success, failed };
};

// Get payment term display for PO
export const getPOPaymentTermDisplay = async (poId: number): Promise<string> => {
  try {
    const { data: po, error } = await supabase
      .from('purchase_orders')
      .select(`
        id_payment_term,
        payment_terms(term_name, calculation_type, days)
      `)
      .eq('id', poId)
      .single();

    if (error || !po || !po.payment_terms || !Array.isArray(po.payment_terms) || po.payment_terms.length === 0) {
      return 'Payment term tidak ditemukan';
    }

    return po.payment_terms[0].term_name;
  } catch (error) {
    console.error('Error getting payment term display:', error);
    return 'Error';
  }
};