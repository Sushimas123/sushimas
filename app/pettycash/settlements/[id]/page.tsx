'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';

interface SettlementDetail {
  id: number;
  request_id: number;
  settlement_number: string;
  total_expenses: number;
  remaining_amount: number;
  settled_by: number;
  settlement_date: string;
  verified_by?: number;
  verified_at?: string;
  status: string;
  notes?: string;
  created_at: string;
  request_number?: string;
  request_amount?: number;
  branch_name?: string;
  settled_by_name?: string;
  verified_by_name?: string;
  expenses?: Array<{
    id: number;
    description: string;
    amount: number;
    expense_date: string;
    vendor_name?: string;
    receipt_number?: string;
  }>;
}

function SettlementDetailContent() {
  const params = useParams();
  const [settlement, setSettlement] = useState<SettlementDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params?.id) {
      fetchSettlementDetail(params.id as string);
    }
  }, [params?.id]);

  const fetchSettlementDetail = async (id: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('petty_cash_settlements')
        .select('*')
        .eq('id', parseInt(id))
        .single();

      if (error) throw error;
      
      // Fetch request data
      if (data.request_id) {
        const { data: requestData } = await supabase
          .from('petty_cash_requests')
          .select('request_number, amount, branch_code')
          .eq('id', data.request_id)
          .single();
        
        data.request_number = requestData?.request_number;
        data.request_amount = requestData?.amount;
        
        // Fetch branch name
        if (requestData?.branch_code) {
          const { data: branchData } = await supabase
            .from('branches')
            .select('nama_branch')
            .eq('kode_branch', requestData.branch_code)
            .single();
          
          data.branch_name = branchData?.nama_branch || requestData.branch_code;
        }
      }
      
      // Fetch settled by user
      if (data.settled_by) {
        const { data: settledByData } = await supabase
          .from('users')
          .select('nama_lengkap')
          .eq('id_user', data.settled_by)
          .single();
        
        data.settled_by_name = settledByData?.nama_lengkap;
      }
      
      // Fetch verified by user
      if (data.verified_by) {
        const { data: verifiedByData } = await supabase
          .from('users')
          .select('nama_lengkap')
          .eq('id_user', data.verified_by)
          .single();
        
        data.verified_by_name = verifiedByData?.nama_lengkap;
      }
      
      // Fetch expenses for this request
      const { data: expensesData } = await supabase
        .from('petty_cash_expenses')
        .select('id, description, amount, expense_date, vendor_name, receipt_number')
        .eq('request_id', data.request_id)
        .order('expense_date', { ascending: false });
      
      data.expenses = expensesData || [];
      
      setSettlement(data);
    } catch (error) {
      console.error('Error fetching settlement detail:', error);
      alert(`Gagal memuat detail settlement: ${(error as any)?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!confirm('Verify settlement ini?')) return;
    
    try {
      const user = localStorage.getItem('user');
      const currentUser = user ? JSON.parse(user) : null;
      
      const { error } = await supabase
        .from('petty_cash_settlements')
        .update({ 
          status: 'verified',
          verified_by: currentUser?.id_user,
          verified_at: new Date().toISOString()
        })
        .eq('id', settlement!.id);
      
      if (error) throw error;
      
      alert('Settlement berhasil di-verify!');
      if (params?.id) {
        fetchSettlementDetail(params.id as string);
      }
    } catch (error) {
      alert('Gagal verify settlement');
    }
  };

  const handleComplete = async () => {
    if (!confirm('Complete settlement ini?')) return;
    
    try {
      const { error } = await supabase
        .from('petty_cash_settlements')
        .update({ status: 'completed' })
        .eq('id', settlement!.id);
      
      if (error) throw error;
      
      alert('Settlement berhasil di-complete!');
      if (params?.id) {
        fetchSettlementDetail(params.id as string);
      }
    } catch (error) {
      alert('Gagal complete settlement');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600';
      case 'verified': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'verified': return '✅';
      case 'completed': return '🏁';
      default: return '📋';
    }
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

  if (!settlement) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl mb-2">❌</div>
        <h3 className="text-sm font-medium">Settlement tidak ditemukan</h3>
        <a 
          href="/pettycash/settlements"
          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm mt-3 inline-block"
        >
          Kembali
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Settlement #{settlement.settlement_number}</h1>
          <span className={`text-xs font-medium ${getStatusColor(settlement.status)}`}>
            {getStatusIcon(settlement.status)} {settlement.status.toUpperCase()}
          </span>
        </div>
        <a 
          href="/pettycash/settlements"
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Kembali
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Settlement Info */}
          <div className="bg-white p-4 rounded-lg border">
            <h2 className="text-sm font-semibold mb-3">Settlement Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600">Request</label>
                <div className="text-sm font-semibold text-blue-600">{settlement.request_number}</div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600">Branch</label>
                <div className="text-sm font-semibold">{settlement.branch_name}</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">Settlement Date</label>
                <div className="text-sm">{formatDate(settlement.settlement_date)}</div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600">Settled By</label>
                <div className="text-sm">{settlement.settled_by_name}</div>
              </div>
            </div>
          </div>

          {/* Amount Breakdown */}
          <div className="bg-white p-4 rounded-lg border">
            <h2 className="text-sm font-semibold mb-3">Amount Breakdown</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <span className="text-sm font-medium">Request Amount</span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(settlement.request_amount || 0)}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                <span className="text-sm font-medium">Total Expenses</span>
                <span className="text-lg font-bold text-red-600">-{formatCurrency(settlement.total_expenses)}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
                <span className="text-sm font-medium">Remaining Amount</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(settlement.remaining_amount)}</span>
              </div>
            </div>
          </div>

          {/* Expenses List */}
          <div className="bg-white p-4 rounded-lg border">
            <h2 className="text-sm font-semibold mb-3">Expense Details ({settlement.expenses?.length || 0})</h2>
            {settlement.expenses && settlement.expenses.length > 0 ? (
              <div className="space-y-2">
                {settlement.expenses.map((expense) => (
                  <div key={expense.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{expense.description}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(expense.expense_date)}
                        {expense.vendor_name && ` • ${expense.vendor_name}`}
                        {expense.receipt_number && ` • Receipt: ${expense.receipt_number}`}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-red-600">{formatCurrency(expense.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Tidak ada expense untuk request ini
              </div>
            )}
          </div>

          {/* Notes */}
          {settlement.notes && (
            <div className="bg-white p-4 rounded-lg border">
              <h2 className="text-sm font-semibold mb-3">Notes</h2>
              <div className="p-3 bg-gray-50 rounded text-sm">
                {settlement.notes}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status & Actions */}
          <div className="bg-white p-4 rounded-lg border">
            <h2 className="text-sm font-semibold mb-3">Actions</h2>
            <div className="space-y-2">
              {settlement.status === 'pending' && (
                <button 
                  onClick={handleVerify}
                  className="w-full text-blue-600 hover:text-blue-800 border border-blue-300 hover:border-blue-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Verify Settlement
                </button>
              )}
              
              {settlement.status === 'verified' && (
                <button 
                  onClick={handleComplete}
                  className="w-full text-green-600 hover:text-green-800 border border-green-300 hover:border-green-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Complete Settlement
                </button>
              )}
              
              <button 
                onClick={() => window.print()}
                className="w-full text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            </div>
          </div>

          {/* Verification Info */}
          {settlement.verified_by && (
            <div className="bg-white p-4 rounded-lg border">
              <h2 className="text-sm font-semibold mb-3">Verification</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Verified By:</span>
                  <div className="font-medium text-green-600">{settlement.verified_by_name}</div>
                </div>
                <div>
                  <span className="text-gray-600">Verified At:</span>
                  <div className="font-medium">{settlement.verified_at ? formatDateTime(settlement.verified_at) : '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Audit Info */}
          <div className="bg-white p-4 rounded-lg border">
            <h2 className="text-sm font-semibold mb-3">Audit Information</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Created At:</span>
                <div className="font-medium">{formatDateTime(settlement.created_at)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettlementDetailPage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <SettlementDetailContent />
      </Layout>
    </PageAccessControl>
  );
}