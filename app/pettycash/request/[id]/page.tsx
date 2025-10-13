'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';

interface RequestDetail {
  id: number;
  request_number: string;
  branch_code: string;
  requested_by: number;
  amount: number;
  purpose: string;
  notes: string;
  status: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  disbursed_at?: string;
  user_name?: string;
  attachment?: string;
  branch_name?: string;
}

const fetchRequestDetail = async (id: string) => {
  const { data, error } = await supabase
    .from('petty_cash_requests')
    .select(`
      *,
      requested_by_user:users!petty_cash_requests_requested_by_fkey(id_user, nama_lengkap),
      branches(kode_branch, nama_branch)
    `)
    .eq('id', parseInt(id))
    .single();

  if (error) throw error;
  
  return {
    ...data,
    user_name: data.requested_by_user?.nama_lengkap || null,
    branch_name: data.branches?.nama_branch || data.branch_code
  };
};

function RequestDetailContent() {
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params?.id as string;

  const { data: request, isLoading: loading, error } = useQuery({
    queryKey: ['petty-cash-request', id],
    queryFn: () => fetchRequestDetail(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, additionalData }: { status: string; additionalData?: any }) => {
      const updateData = { status, ...additionalData };
      const { error } = await supabase
        .from('petty_cash_requests')
        .update(updateData)
        .eq('id', parseInt(id));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-request', id] });
      alert('Status berhasil diupdate!');
    },
    onError: (error) => {
      alert(`Gagal update status: ${error.message}`);
    }
  });

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600';
      case 'approved': return 'text-green-600';
      case 'rejected': return 'text-red-600';
      case 'disbursed': return 'text-blue-600';
      case 'settled': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'approved': return '✅';
      case 'rejected': return '❌';
      case 'disbursed': return '💰';
      case 'settled': return '🏁';
      default: return '📋';
    }
  };

  const handleApprove = () => {
    if (!confirm('Approve request ini?')) return;
    updateStatusMutation.mutate({
      status: 'approved',
      additionalData: { approved_at: new Date().toISOString() }
    });
  };

  const handleReject = () => {
    if (!confirm('Reject request ini?')) return;
    updateStatusMutation.mutate({ status: 'rejected' });
  };

  const handleDisburse = () => {
    if (!confirm('Disburse request ini?')) return;
    updateStatusMutation.mutate({
      status: 'disbursed',
      additionalData: { disbursed_at: new Date().toISOString() }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl mb-2">❌</div>
        <h3 className="text-sm font-medium">Error loading request</h3>
        <p className="text-xs text-gray-500 mb-3">{(error as any)?.message}</p>
        <a 
          href="/pettycash/request"
          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm inline-block"
        >
          Kembali
        </a>
      </div>
    );
  }

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

  if (!request) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl mb-2">❌</div>
        <h3 className="text-sm font-medium">Request tidak ditemukan</h3>
        <a 
          href="/pettycash/request"
          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm mt-3 inline-block"
        >
          Kembali
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Detail Request #{request.request_number}</h1>
          <span className={`text-xs font-medium ${getStatusColor(request.status)}`}>
            {getStatusIcon(request.status)} {request.status.toUpperCase()}
          </span>
        </div>
        <a 
          href="/pettycash/request"
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Kembali
        </a>
      </div>

      {/* Request Info */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600">Branch</label>
            <div className="text-sm font-semibold">{request.branch_name || request.branch_code}</div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-600">Amount</label>
            <div className="text-sm font-bold text-green-600">{formatCurrency(request.amount)}</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">Requested By</label>
            <div className="text-sm">{request.user_name || `User ${request.requested_by}`}</div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-600">Date</label>
            <div className="text-sm">{formatDate(request.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Purpose & Notes */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Purpose</label>
            <div className="p-3 bg-gray-50 rounded text-sm">
              {request.purpose || 'Tidak ada tujuan'}
            </div>
          </div>
          
          {request.notes && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <div className="p-3 bg-gray-50 rounded text-sm">
                {request.notes}
              </div>
            </div>
          )}
          
          {request.attachment && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Attachment</label>
              <div className="p-3 bg-gray-50 rounded text-sm">
                <a 
                  href={request.attachment} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
                >
                  📎 View Attachment
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex gap-3">
          {request.status === 'pending' && (
            <>
              <button 
                onClick={handleApprove}
                disabled={updateStatusMutation.isPending}
                className="text-green-600 hover:text-green-800 border border-green-300 hover:border-green-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateStatusMutation.isPending ? (
                  <div className="animate-spin w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {updateStatusMutation.isPending ? 'Processing...' : 'Approve'}
              </button>
              <button 
                onClick={handleReject}
                disabled={updateStatusMutation.isPending}
                className="text-red-600 hover:text-red-800 border border-red-300 hover:border-red-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateStatusMutation.isPending ? (
                  <div className="animate-spin w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {updateStatusMutation.isPending ? 'Processing...' : 'Reject'}
              </button>
            </>
          )}
          
          {request.status === 'approved' && (
            <button 
              onClick={handleDisburse}
              disabled={updateStatusMutation.isPending}
              className="text-blue-600 hover:text-blue-800 border border-blue-300 hover:border-blue-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateStatusMutation.isPending ? (
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              )}
              {updateStatusMutation.isPending ? 'Processing...' : 'Disburse'}
            </button>
          )}
          
          <button 
            onClick={handlePrint}
            className="text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RequestDetailPage() {
  return (
    <Layout>
      <PageAccessControl pageName="pettycash">
        <RequestDetailContent />
      </PageAccessControl>
    </Layout>
  );
}