'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';

interface Settlement {
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
  settled_by_name?: string;
  verified_by_name?: string;
  request_amount?: number;
  refilled_request_id?: number;
}

function SettlementsContent() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      
      const { data: settlementsData, error } = await supabase
        .from('petty_cash_settlements')
        .select('*, refilled_request_id')
        .order('settlement_date', { ascending: false });

      if (error) throw error;

      const formattedSettlements = [];
      for (const settlement of settlementsData || []) {
        // Fetch request data
        const { data: requestData } = await supabase
          .from('petty_cash_requests')
          .select('request_number, amount')
          .eq('id', settlement.request_id)
          .single();
        
        // Fetch settled by user
        const { data: settledByData } = await supabase
          .from('users')
          .select('nama_lengkap')
          .eq('id_user', settlement.settled_by)
          .single();
        
        // Fetch verified by user if exists
        let verifiedByData = null;
        if (settlement.verified_by) {
          const { data } = await supabase
            .from('users')
            .select('nama_lengkap')
            .eq('id_user', settlement.verified_by)
            .single();
          verifiedByData = data;
        }
        
        formattedSettlements.push({
          ...settlement,
          request_number: requestData?.request_number || `REQ-${settlement.request_id}`,
          request_amount: requestData?.amount || 0,
          settled_by_name: settledByData?.nama_lengkap || `User ${settlement.settled_by}`,
          verified_by_name: verifiedByData?.nama_lengkap || null
        });
      }

      setSettlements(formattedSettlements);
    } catch (error) {
      console.error('Error fetching settlements:', error);
      alert('Gagal memuat data settlements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, []);

  const handleVerify = async (id: number) => {
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
        .eq('id', id);
      
      if (error) throw error;
      
      alert('Settlement berhasil di-verify!');
      fetchSettlements();
    } catch (error) {
      alert('Gagal verify settlement');
    }
  };

  const handleComplete = async (id: number) => {
    if (!confirm('Complete settlement ini?')) return;
    
    try {
      const { error } = await supabase
        .from('petty_cash_settlements')
        .update({ status: 'completed' })
        .eq('id', id);
      
      if (error) throw error;
      
      alert('Settlement berhasil di-complete!');
      fetchSettlements();
    } catch (error) {
      alert('Gagal complete settlement');
    }
  };

  const handleUndoSettlement = async (id: number) => {
    if (!confirm('Undo settlement ini? Settlement akan dihapus dan request bisa digunakan lagi untuk expense.')) return;
    
    try {
      const { error } = await supabase
        .from('petty_cash_settlements')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      alert('Settlement berhasil di-undo!');
      fetchSettlements();
    } catch (error) {
      alert('Gagal undo settlement');
    }
  };

  const handleRefill = async (settlementId: number, remainingAmount: number) => {
    const settlement = settlements.find(s => s.id === settlementId);
    if (!settlement) return;
    
    // Validasi 1: Hanya settlement completed yang bisa di-refill
    if (settlement.status !== 'completed') {
      alert('Hanya settlement dengan status "completed" yang bisa di-refill');
      return;
    }
    
    // Validasi 2: Cek apakah sudah ada refill sebelumnya
    if (settlement.refilled_request_id || settlement.notes?.includes('[REFILLED]')) {
      alert('Settlement ini sudah di-refill sebelumnya');
      return;
    }
    
    // Validasi 3: Pastikan ada expenses yang bisa di-refill
    if (settlement.total_expenses <= 0) {
      alert('Tidak ada dana yang bisa di-refill (total expenses = 0)');
      return;
    }
    
    // Refill amount = total expenses (dana yang terpakai dikembalikan ke kas)
    const refillAmount = settlement.total_expenses;
    
    if (!confirm(`Refill settlement ${settlement.settlement_number}?\n\nDana terpakai: ${formatCurrency(settlement.total_expenses)}\nSisa saldo: ${formatCurrency(settlement.remaining_amount)}\nTotal baru: ${formatCurrency(settlement.total_expenses + settlement.remaining_amount)}`)) return;
    
    try {
      const user = localStorage.getItem('user');
      const currentUser = user ? JSON.parse(user) : null;
      
      if (!currentUser?.id_user) {
        alert('User tidak ditemukan');
        return;
      }

      // Generate request number
      const requestNumber = `REQ-REFILL-${Date.now()}`;
      
      // Get original request data for branch info
      const { data: originalRequest } = await supabase
        .from('petty_cash_requests')
        .select('branch_code')
        .eq('id', settlement.request_id)
        .single();
      
      // Create new request with refill tracking fields
      const { data: newRequest, error: requestError } = await supabase
        .from('petty_cash_requests')
        .insert({
          request_number: requestNumber,
          amount: refillAmount,
          purpose: `Refill dari settlement ${settlement.settlement_number}`,
          branch_code: originalRequest?.branch_code || 'UNKNOWN',
          requested_by: currentUser.id_user,
          status: 'approved', // Auto approve refill
          approved_by: currentUser.id_user,
          approved_at: new Date().toISOString(),
          parent_request_id: settlement.request_id,
          carried_balance: settlement.remaining_amount,
          notes: `Auto-generated refill dari settlement ${settlement.settlement_number}. Carried balance: ${formatCurrency(settlement.remaining_amount)}`
        })
        .select()
        .single();
      
      if (requestError) throw requestError;
      
      // Update settlement to mark as refilled
      const { error: updateError } = await supabase
        .from('petty_cash_settlements')
        .update({ 
          refilled_request_id: newRequest.id,
          notes: (settlement.notes || '') + `\n[REFILLED ${new Date().toLocaleDateString('id-ID')}] Dana terpakai ${formatCurrency(refillAmount)} di-refill ke request ${requestNumber}`
        })
        .eq('id', settlementId);
      
      if (updateError) throw updateError;
      
      alert(`✅ Refill berhasil!\n\nRequest baru: ${requestNumber}\nRefill Amount: ${formatCurrency(refillAmount)}\nCarried Balance: ${formatCurrency(settlement.remaining_amount)}\nTotal Available: ${formatCurrency(refillAmount + settlement.remaining_amount)}\n\nDana sudah siap digunakan lagi.`);
      fetchSettlements();
    } catch (error) {
      console.error('Error refilling:', error);
      alert('Gagal melakukan refill');
    }
  };

  const filteredSettlements = settlements.filter(settlement => {
    const matchesSearch = 
      settlement.settlement_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      settlement.request_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || settlement.status === statusFilter;
    
    return matchesSearch && matchesStatus;
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

  const stats = {
    total: settlements.length,
    pending: settlements.filter(s => s.status === 'pending').length,
    verified: settlements.filter(s => s.status === 'verified').length,
    completed: settlements.filter(s => s.status === 'completed').length,
    refillable: settlements.filter(s => 
      s.status === 'completed' && 
      !s.refilled_request_id &&
      !s.notes?.includes('[REFILLED]') &&
      s.total_expenses > 0
    ).length,
    totalRemaining: settlements.reduce((sum, s) => sum + s.remaining_amount, 0),
    totalRefillableAmount: settlements
      .filter(s => s.status === 'completed' && !s.refilled_request_id && !s.notes?.includes('[REFILLED]'))
      .reduce((sum, s) => sum + s.total_expenses, 0)
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data settlements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Petty Cash Settlements</h1>
          <p className="text-gray-600">Kelola penyelesaian dan pengembalian saldo petty cash</p>
        </div>
        <a 
          href="/pettycash/settlements/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          ➕ Buat Settlement
        </a>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Settlements</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{stats.verified}</div>
          <div className="text-sm text-gray-600">Verified</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-lg font-bold text-purple-600">{stats.refillable}</div>
          <div className="text-sm text-gray-600">Ready for Refill</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-lg font-bold text-orange-600">{formatCurrency(stats.totalRefillableAmount)}</div>
          <div className="text-sm text-gray-600">Total Refillable</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              type="text"
              placeholder="Cari settlement number atau request number..."
              className="w-full border rounded px-3 py-2 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Daftar Settlements ({filteredSettlements.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">Settlement Info</th>
                <th className="text-left py-3 px-4">Request</th>
                <th className="text-right py-3 px-4">Request Amount</th>
                <th className="text-right py-3 px-4">Total Expenses</th>
                <th className="text-right py-3 px-4">Remaining</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Settled By</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSettlements.map((settlement) => (
                <tr key={settlement.id} className="border-b hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-medium text-blue-600">{settlement.settlement_number}</div>
                      <div className="text-xs text-gray-500">{formatDate(settlement.settlement_date)}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-purple-600 font-medium">{settlement.request_number}</div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="font-semibold">{formatCurrency(settlement.request_amount || 0)}</div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="font-semibold text-red-600">{formatCurrency(settlement.total_expenses)}</div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="font-bold text-green-600">{formatCurrency(settlement.remaining_amount)}</div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`text-xs font-medium ${getStatusColor(settlement.status)}`}>
                      {getStatusIcon(settlement.status)} {settlement.status.toUpperCase()}
                    </span>
                    {(settlement.refilled_request_id || settlement.notes?.includes('[REFILLED]')) && (
                      <div className="text-xs text-purple-600 mt-1">🔄 Refilled</div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-medium">{settlement.settled_by_name}</div>
                      {settlement.verified_by_name && (
                        <div className="text-xs text-green-600">✓ {settlement.verified_by_name}</div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-1 justify-center">
                      {settlement.status === 'pending' && (
                        <button
                          onClick={() => handleVerify(settlement.id)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors"
                          title="Verify"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      {settlement.status === 'verified' && (
                        <button
                          onClick={() => handleComplete(settlement.id)}
                          className="text-green-600 hover:text-green-800 p-1 rounded transition-colors"
                          title="Complete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                      {settlement.status === 'completed' && settlement.total_expenses > 0 && !settlement.refilled_request_id && !settlement.notes?.includes('[REFILLED]') && (
                        <button
                          onClick={() => handleRefill(settlement.id, settlement.remaining_amount)}
                          className="text-purple-600 hover:text-purple-800 p-1 rounded transition-colors"
                          title="Refill dana terpakai"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                      <a
                        href={`/pettycash/settlements/${settlement.id}`}
                        className="text-gray-600 hover:text-gray-800 p-1 rounded transition-colors"
                        title="View Detail"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </a>
                      <button
                        onClick={() => handleUndoSettlement(settlement.id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
                        title="Undo Settlement"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSettlements.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-lg font-medium">Tidak ada settlement ditemukan</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Coba ubah filter pencarian' 
                : 'Belum ada settlement yang dibuat'
              }
            </p>
            <a 
              href="/pettycash/settlements/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              ➕ Buat Settlement Pertama
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettlementsPage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <SettlementsContent />
      </Layout>
    </PageAccessControl>
  );
}