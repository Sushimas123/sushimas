'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';

interface RequestWithExpenses {
  id: number;
  request_number: string;
  amount: number; // This will now represent total available (amount + carried_balance)
  total_expenses: number;
  remaining_amount: number;
  branch_name: string;
}

function CreateSettlementContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [requests, setRequests] = useState<RequestWithExpenses[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithExpenses | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchRequestsWithExpenses();
  }, []);

  const fetchRequestsWithExpenses = async () => {
    try {
      setDataLoading(true);

      // Get disbursed requests with refill fields
      const { data: requestsData, error: requestsError } = await supabase
        .from('petty_cash_requests')
        .select('id, request_number, amount, branch_code, parent_request_id, carried_balance')
        .eq('status', 'disbursed')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      const requestsWithExpenses = [];
      for (const request of requestsData || []) {
        // Check if already settled
        const { data: existingSettlement } = await supabase
          .from('petty_cash_settlements')
          .select('id')
          .eq('request_id', request.id)
          .single();

        if (existingSettlement) continue; // Skip if already settled

        // Get total expenses for this request
        const { data: expensesData } = await supabase
          .from('petty_cash_expenses')
          .select('amount')
          .eq('request_id', request.id);

        const totalExpenses = expensesData?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
        // Calculate total available = amount + carried_balance (for refill requests)
        const totalAvailable = request.amount + (request.carried_balance || 0);
        const remainingAmount = totalAvailable - totalExpenses;

        // Get branch name
        const { data: branchData } = await supabase
          .from('branches')
          .select('nama_branch')
          .eq('kode_branch', request.branch_code)
          .single();

        requestsWithExpenses.push({
          id: request.id,
          request_number: request.request_number,
          amount: totalAvailable, // Show total available instead of just amount
          total_expenses: totalExpenses,
          remaining_amount: remainingAmount,
          branch_name: branchData?.nama_branch || request.branch_code
        });
      }

      setRequests(requestsWithExpenses);
    } catch (error) {
      console.error('Error fetching requests:', error);
      alert('Gagal memuat data requests');
    } finally {
      setDataLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRequest) {
      alert('Pilih request terlebih dahulu');
      return;
    }

    setLoading(true);

    try {
      const user = localStorage.getItem('user');
      const currentUser = user ? JSON.parse(user) : null;
      
      if (!currentUser?.id_user) {
        throw new Error('User tidak ditemukan');
      }

      const { data, error } = await supabase
        .from('petty_cash_settlements')
        .insert({
          request_id: selectedRequest.id,
          settlement_number: `STL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
          total_expenses: selectedRequest.total_expenses,
          remaining_amount: selectedRequest.remaining_amount,
          settled_by: currentUser.id_user,
          notes: notes.trim() || null
        })
        .select();

      if (error) throw error;
      
      alert('Settlement berhasil dibuat!');
      router.push('/pettycash/settlements');
    } catch (error) {
      console.error('Error creating settlement:', error);
      alert(`Terjadi kesalahan: ${(error as any)?.message || 'Unknown error'}`);
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

  if (dataLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Buat Settlement</h1>
          <p className="text-sm text-gray-600">Pilih request untuk diselesaikan dan kembalikan sisa dana</p>
        </div>
        <a 
          href="/pettycash/settlements"
          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
        >
          ← Kembali
        </a>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium">Tidak ada request yang perlu di-settle</h3>
          <p className="text-gray-600">Semua request sudah diselesaikan atau belum ada yang disbursed</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Request Selection */}
          <div className="bg-white p-4 rounded-lg border">
            <h2 className="text-sm font-semibold mb-3">Pilih Request untuk Settlement</h2>
            
            <div className="space-y-3">
              {requests.map((request) => (
                <div 
                  key={request.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedRequest?.id === request.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="request"
                      checked={selectedRequest?.id === request.id}
                      onChange={() => setSelectedRequest(request)}
                      className="text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-blue-600">{request.request_number}</div>
                          <div className="text-sm text-gray-600">{request.branch_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">
                            <span className="text-gray-600">Available: </span>
                            <span className="font-semibold">{formatCurrency(request.amount)}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Expenses: </span>
                            <span className="font-semibold text-red-600">{formatCurrency(request.total_expenses)}</span>
                          </div>
                          <div className="text-sm border-t pt-1 mt-1">
                            <span className="text-gray-600">Remaining: </span>
                            <span className={`font-bold ${request.remaining_amount > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                              {formatCurrency(request.remaining_amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settlement Details */}
          {selectedRequest && (
            <div className="bg-white p-4 rounded-lg border">
              <h2 className="text-sm font-semibold mb-3">Detail Settlement</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-600">Total Available</div>
                  <div className="text-lg font-bold">{formatCurrency(selectedRequest.amount)}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-600">Total Expenses</div>
                  <div className="text-lg font-bold text-red-600">{formatCurrency(selectedRequest.total_expenses)}</div>
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded border border-green-200">
                <div className="text-sm text-green-700">Amount to Return</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(selectedRequest.remaining_amount)}</div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm border-gray-300"
                  rows={3}
                  placeholder="Catatan settlement..."
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4">
            <a
              href="/pettycash/settlements"
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Batal
            </a>
            <button
              type="submit"
              disabled={loading || !selectedRequest}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Buat Settlement'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function CreateSettlementPage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <CreateSettlementContent />
      </Layout>
    </PageAccessControl>
  );
}