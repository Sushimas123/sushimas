'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';

// Print styles
const printStyles = `
  @media print {
    .no-print { display: none !important; }
    .print-break { page-break-after: always; }
    body { font-size: 12px; }
    .print-title { font-size: 18px; font-weight: bold; margin-bottom: 20px; }
    .print-section { margin-bottom: 15px; border: 1px solid #ddd; padding: 10px; }
    .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .print-image { max-height: 200px; }
  }
`;

interface ExpenseDetail {
  id: number;
  request_id: number;
  category_id: number;
  expense_date: string;
  description: string;
  amount: number;
  receipt_number?: string;
  vendor_name?: string;
  notes?: string;
  receipt_image_url?: string;
  created_by: number;
  created_at: string;
  request_number?: string;
  category_name?: string;
  created_by_name?: string;
}

function ExpenseDetailContent() {
  const params = useParams();
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params?.id) {
      fetchExpenseDetail(params.id as string);
    }
  }, [params?.id]);

  const fetchExpenseDetail = async (id: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('petty_cash_expenses')
        .select('*')
        .eq('id', parseInt(id))
        .single();

      if (error) throw error;
      
      // Fetch related data separately
      if (data.request_id) {
        const { data: requestData } = await supabase
          .from('petty_cash_requests')
          .select('request_number')
          .eq('id', data.request_id)
          .single();
        
        data.request_number = requestData?.request_number || `REQ-${data.request_id}`;
      }
      
      if (data.category_id) {
        const { data: categoryData } = await supabase
          .from('categories')
          .select('category_name')
          .eq('id_category', data.category_id)
          .single();
        
        data.category_name = categoryData?.category_name || `Category ${data.category_id}`;
      }
      
      if (data.created_by) {
        const { data: userData } = await supabase
          .from('users')
          .select('nama_lengkap')
          .eq('id_user', data.created_by)
          .single();
        
        data.created_by_name = userData?.nama_lengkap || `User ${data.created_by}`;
      }
      
      setExpense(data);
    } catch (error) {
      console.error('Error fetching expense detail:', error);
      alert(`Gagal memuat detail expense: ${(error as any)?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Memuat detail...</p>
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl mb-2">❌</div>
        <h3 className="text-sm font-medium">Expense tidak ditemukan</h3>
        <a 
          href="/pettycash/expenses"
          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm mt-3 inline-block"
        >
          Kembali
        </a>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 print-title">Detail Expense #{expense.id}</h1>
            <p className="text-sm text-gray-600">Informasi lengkap pengeluaran petty cash</p>
          </div>
          <a 
            href="/pettycash/expenses"
            className="text-sm text-gray-600 hover:text-gray-800 no-print"
          >
            ← Kembali
          </a>
        </div>

      {/* Expense Info */}
      <div className="bg-white p-4 rounded-lg border print-section">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print-grid">
          <div>
            <label className="block text-xs font-medium text-gray-600">Request</label>
            <div className="text-sm font-semibold text-blue-600">{expense.request_number}</div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-600">Category</label>
            <div className="text-sm font-semibold text-purple-600">{expense.category_name}</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">Amount</label>
            <div className="text-sm font-bold text-green-600">{formatCurrency(expense.amount)}</div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-600">Date</label>
            <div className="text-sm">{formatDate(expense.expense_date)}</div>
          </div>
        </div>
      </div>

      {/* Description & Details */}
      <div className="bg-white p-4 rounded-lg border print-section">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <div className="p-3 bg-gray-50 rounded text-sm">
              {expense.description}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor/Supplier</label>
              <div className="p-3 bg-gray-50 rounded text-sm">
                {expense.vendor_name || 'Tidak ada vendor'}
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Receipt Number</label>
              <div className="p-3 bg-gray-50 rounded text-sm">
                {expense.receipt_number || 'Tidak ada receipt'}
              </div>
            </div>
          </div>
          
          {expense.notes && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <div className="p-3 bg-gray-50 rounded text-sm">
                {expense.notes}
              </div>
            </div>
          )}
          
          {expense.receipt_image_url && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Receipt Image</label>
              <div className="p-3 bg-gray-50 rounded">
                <img 
                  src={`${supabase.storage.from('petty-cash-attachments').getPublicUrl(expense.receipt_image_url!).data.publicUrl}`}
                  alt="Receipt"
                  className="max-w-full h-auto max-h-40 rounded border cursor-pointer print-image"
                  onClick={() => window.open(`${supabase.storage.from('petty-cash-attachments').getPublicUrl(expense.receipt_image_url!).data.publicUrl}`, '_blank')}
                />
                <p className="text-xs text-gray-500 mt-1">Klik gambar untuk memperbesar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit Info */}
      <div className="bg-white p-4 rounded-lg border print-section">
        <h2 className="text-sm font-semibold mb-3">Audit Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm print-grid">
          <div>
            <label className="block text-xs font-medium text-gray-600">Created By</label>
            <div className="font-medium">{expense.created_by_name}</div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-600">Created At</label>
            <div className="font-medium">{formatDateTime(expense.created_at)}</div>
          </div>
        </div>
      </div>


      </div>
    </>
  );
}

export default function ExpenseDetailPage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <ExpenseDetailContent />
      </Layout>
    </PageAccessControl>
  );
}