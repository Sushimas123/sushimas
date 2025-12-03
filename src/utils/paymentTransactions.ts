import { supabase } from '@/src/lib/supabaseClient'

export interface PaymentTransaction {
  po_id: number
  payment_date: string
  payment_amount: number
  payment_method: string
  payment_via: string
  reference_number: string
  notes: string
  created_by?: number
}

export interface BulkPaymentTransaction {
  bulk_reference: string
  total_amount: number
  payment_date: string
  payment_via: string
  payment_method: string
  notes: string
  po_ids: number[]
}

export class PaymentTransactionManager {
  
  /**
   * Execute single payment with rollback capability
   */
  static async executeSinglePayment(payment: PaymentTransaction): Promise<{ success: boolean; error?: string }> {
    try {
      // Start transaction by getting current state
      const { data: currentPO, error: poError } = await supabase
        .from('purchase_orders')
        .select('id, po_number, bulk_payment_ref')
        .eq('id', payment.po_id)
        .single()

      if (poError || !currentPO) {
        return { success: false, error: 'PO tidak ditemukan atau sudah tidak valid' }
      }

      // Validate PO is not already in bulk payment
      if (currentPO.bulk_payment_ref) {
        return { success: false, error: 'PO sudah dalam bulk payment, tidak bisa dibayar individual' }
      }

      // Get current payments to validate amount
      const { data: currentPayments, error: paymentsError } = await supabase
        .from('po_payments')
        .select('payment_amount')
        .eq('po_id', payment.po_id)
        .eq('status', 'completed')

      if (paymentsError) {
        return { success: false, error: 'Gagal validasi pembayaran existing' }
      }

      const totalPaid = currentPayments?.reduce((sum, p) => sum + p.payment_amount, 0) || 0
      
      // Get PO total from finance view
      const { data: financeData, error: financeError } = await supabase
        .from('finance_dashboard_view')
        .select('total_tagih, sisa_bayar')
        .eq('id', payment.po_id)
        .single()

      if (financeError || !financeData) {
        return { success: false, error: 'Gagal mendapatkan data keuangan PO' }
      }

      const maxPayable = financeData.sisa_bayar
      if (payment.payment_amount > maxPayable) {
        return { success: false, error: `Jumlah pembayaran melebihi sisa bayar: ${maxPayable}` }
      }

      // Execute payment insert
      const { data: insertedPayment, error: insertError } = await supabase
        .from('po_payments')
        .insert({
          ...payment,
          status: 'completed'
        })
        .select()
        .single()

      if (insertError) {
        return { success: false, error: `Gagal menyimpan pembayaran: ${insertError.message}` }
      }

      return { success: true }

    } catch (error) {
      console.error('Payment transaction error:', error)
      return { success: false, error: 'Terjadi kesalahan sistem saat memproses pembayaran' }
    }
  }

  /**
   * Execute bulk payment with rollback capability
   */
  static async executeBulkPayment(bulkPayment: BulkPaymentTransaction): Promise<{ success: boolean; error?: string }> {
    const rollbackActions: (() => Promise<void>)[] = []

    try {
      // Validate all POs first
      const { data: pos, error: posError } = await supabase
        .from('purchase_orders')
        .select('id, po_number, bulk_payment_ref')
        .in('id', bulkPayment.po_ids)

      if (posError || !pos || pos.length !== bulkPayment.po_ids.length) {
        return { success: false, error: 'Beberapa PO tidak ditemukan atau sudah tidak valid' }
      }

      // Check if any PO already has bulk payment
      const alreadyInBulk = pos.filter(po => po.bulk_payment_ref)
      if (alreadyInBulk.length > 0) {
        return { 
          success: false, 
          error: `PO ${alreadyInBulk.map(p => p.po_number).join(', ')} sudah dalam bulk payment lain` 
        }
      }

      // Check if bulk reference already exists
      const { data: existingBulk } = await supabase
        .from('bulk_payments')
        .select('id')
        .eq('bulk_reference', bulkPayment.bulk_reference)
        .single()

      if (existingBulk) {
        return { success: false, error: 'Bulk reference sudah ada, silakan refresh halaman' }
      }

      // Step 1: Insert bulk payment
      const { data: insertedBulk, error: bulkError } = await supabase
        .from('bulk_payments')
        .insert({
          bulk_reference: bulkPayment.bulk_reference,
          total_amount: bulkPayment.total_amount,
          payment_date: bulkPayment.payment_date,
          payment_via: bulkPayment.payment_via,
          payment_method: bulkPayment.payment_method,
          notes: bulkPayment.notes
        })
        .select()
        .single()

      if (bulkError) {
        return { success: false, error: `Gagal membuat bulk payment: ${bulkError.message}` }
      }

      // Add rollback action for bulk payment
      rollbackActions.push(async () => {
        await supabase
          .from('bulk_payments')
          .delete()
          .eq('id', insertedBulk.id)
      })

      // Step 2: Update all POs with bulk reference
      const updatePromises = bulkPayment.po_ids.map(async (poId) => {
        const { error: updateError } = await supabase
          .from('purchase_orders')
          .update({ bulk_payment_ref: bulkPayment.bulk_reference })
          .eq('id', poId)

        if (updateError) {
          throw new Error(`Gagal update PO ${poId}: ${updateError.message}`)
        }

        // Add rollback action for this PO
        rollbackActions.push(async () => {
          await supabase
            .from('purchase_orders')
            .update({ bulk_payment_ref: null })
            .eq('id', poId)
        })
      })

      await Promise.all(updatePromises)

      return { success: true }

    } catch (error) {
      console.error('Bulk payment transaction error:', error)
      
      // Execute rollback
      console.log('Executing rollback for bulk payment...')
      for (const rollbackAction of rollbackActions.reverse()) {
        try {
          await rollbackAction()
        } catch (rollbackError) {
          console.error('Rollback action failed:', rollbackError)
        }
      }

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memproses bulk payment' 
      }
    }
  }

  /**
   * Rollback single payment
   */
  static async rollbackSinglePayment(paymentId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('po_payments')
        .delete()
        .eq('id', paymentId)

      if (error) {
        return { success: false, error: `Gagal rollback payment: ${error.message}` }
      }

      return { success: true }
    } catch (error) {
      console.error('Payment rollback error:', error)
      return { success: false, error: 'Gagal melakukan rollback payment' }
    }
  }

  /**
   * Rollback bulk payment
   */
  static async rollbackBulkPayment(bulkReference: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Remove bulk reference from all POs
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({ bulk_payment_ref: null })
        .eq('bulk_payment_ref', bulkReference)

      if (poError) {
        console.error('Failed to rollback PO updates:', poError)
      }

      // Delete bulk payment record
      const { error: bulkError } = await supabase
        .from('bulk_payments')
        .delete()
        .eq('bulk_reference', bulkReference)

      if (bulkError) {
        return { success: false, error: `Gagal rollback bulk payment: ${bulkError.message}` }
      }

      return { success: true }
    } catch (error) {
      console.error('Bulk payment rollback error:', error)
      return { success: false, error: 'Gagal melakukan rollback bulk payment' }
    }
  }
}