'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';

interface PettyCashRequest {
  id: number;
  request_number: string;
  branch_code: string;
  branch_name: string;
  requested_by: string;
  request_date: string;
  amount: number;
  purpose: string;
  status: string;
  approved_by?: string;
  approved_at?: string;
  disbursed_at?: string;
  notes?: string;
  category?: string;
}

function PettyCashRequestsContent() {
  const [requests, setRequests] = useState<PettyCashRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('30');

  // Fungsi untuk mengambil data dari Supabase
  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      // Query utama untuk petty_cash_requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('petty_cash_requests')
        .select(`
          *,
          branches!inner(nama_branch),
          requested_by_user:users!petty_cash_requests_requested_by_fkey(nama_lengkap),
          approved_by_user:users!petty_cash_requests_approved_by_fkey(nama_lengkap)
        `)
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('Error fetching requests:', requestsError);
        throw requestsError;
      }

      // Format data sesuai dengan interface
      const formattedRequests = requestsData?.map(request => ({
        id: request.id,
        request_number: request.request_number,
        branch_code: request.branch_code,
        branch_name: request.branches?.nama_branch || request.branch_code,
        requested_by: request.requested_by_user?.nama_lengkap || 'Unknown',
        request_date: request.request_date,
        amount: request.amount,
        purpose: request.purpose || '',
        status: request.status || 'pending',
        approved_by: request.approved_by_user?.nama_lengkap,
        approved_at: request.approved_at,
        disbursed_at: request.disbursed_at,
        notes: request.notes,
        category: request.category // Tambahkan field category jika ada di table
      })) || [];

      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error fetching petty cash requests:', error);
      alert('Gagal memuat data requests');
    } finally {
      setLoading(false);
    }
  };

  // Fungsi untuk mengubah status request
  const updateRequestStatus = async (id: number, newStatus: string, notes?: string) => {
    try {
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'approved') {
        updates.approved_by = await getCurrentUserId();
        updates.approved_at = new Date().toISOString();
      } else if (newStatus === 'disbursed') {
        updates.disbursed_by = await getCurrentUserId();
        updates.disbursed_at = new Date().toISOString();
      }

      if (notes) {
        updates.notes = notes;
      }

      const { error } = await supabase
        .from('petty_cash_requests')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Refresh data
      fetchRequests();
      alert(`Status berhasil diubah menjadi ${newStatus}`);
    } catch (error) {
      console.error('Error updating request:', error);
      alert('Gagal mengubah status request');
    }
  };

  // Fungsi untuk mendapatkan current user ID (simulasi)
  const getCurrentUserId = async (): Promise<number> => {
    // Implementasi sesuai dengan auth system Anda
    // Contoh sederhana:
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      return userData.id_user || 1; // Fallback ke ID 1 jika tidak ada
    }
    return 1; // Default fallback
  };

  const handleApprove = async (id: number) => {
    if (confirm('Apakah Anda yakin ingin menyetujui request ini?')) {
      await updateRequestStatus(id, 'approved');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Alasan penolakan:');
    if (reason) {
      await updateRequestStatus(id, 'rejected', reason);
    }
  };

  const handleDisburse = async (id: number) => {
    if (confirm('Apakah Anda yakin ingin mencatat pencairan dana?')) {
      await updateRequestStatus(id, 'disbursed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus request ini? Semua expenses terkait juga akan dihapus.')) return;
    
    try {
      // Check if request has completed settlement
      const { data: settlement } = await supabase
        .from('petty_cash_settlements')
        .select('status')
        .eq('request_id', id)
        .eq('status', 'completed')
        .single();
      
      if (settlement) {
        alert('Request tidak bisa dihapus karena sudah ada settlement yang completed. Undo settlement terlebih dahulu.');
        return;
      }
      
      // Delete all expenses for this request first
      const { error: expenseError } = await supabase
        .from('petty_cash_expenses')
        .delete()
        .eq('request_id', id);
      
      if (expenseError) throw expenseError;
      
      // Delete any settlements for this request
      const { error: settlementError } = await supabase
        .from('petty_cash_settlements')
        .delete()
        .eq('request_id', id);
      
      if (settlementError) throw settlementError;
      
      // Finally delete the request
      const { error } = await supabase
        .from('petty_cash_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchRequests();
      alert('Request dan semua data terkait berhasil dihapus');
    } catch (error) {
      console.error('Error deleting request:', error);
      alert('Gagal menghapus request');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Filter requests
  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requested_by.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || request.branch_code === branchFilter;
    
    // Filter berdasarkan tanggal
    const requestDate = new Date(request.request_date);
    const now = new Date();
    let dateLimit = new Date();
    
    switch (dateFilter) {
      case '7': dateLimit.setDate(now.getDate() - 7); break;
      case '30': dateLimit.setDate(now.getDate() - 30); break;
      case '90': dateLimit.setDate(now.getDate() - 90); break;
      case 'all': 
      default: 
        dateLimit = new Date(0); // Semua tanggal
    }
    
    const matchesDate = requestDate >= dateLimit;
    
    return matchesSearch && matchesStatus && matchesBranch && matchesDate;
  });

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const branches = Array.from(new Set(requests.map(r => r.branch_code)))
    .map(code => {
      const request = requests.find(r => r.branch_code === code);
      return {
        code: code,
        name: request?.branch_name || code
      };
    });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    disbursed: requests.filter(r => r.status === 'disbursed').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    settled: requests.filter(r => r.status === 'settled').length,
    totalAmount: requests.reduce((sum, r) => sum + r.amount, 0),
    pendingAmount: requests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0)
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data petty cash requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Petty Cash Requests</h1>
          <p className="text-gray-600">Kelola semua permintaan petty cash</p>
        </div>
        <a 
          href="/pettycash/request/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          ➕ Buat Request Baru
        </a>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Requests</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          <div className="text-sm text-gray-600">Approved</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{stats.disbursed}</div>
          <div className="text-sm text-gray-600">Disbursed</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          <div className="text-sm text-gray-600">Rejected</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-lg font-bold text-purple-600">{formatCurrency(stats.pendingAmount)}</div>
          <div className="text-sm text-gray-600">Pending Amount</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              placeholder="Cari request number, purpose, atau nama..."
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
              <option value="approved">Approved</option>
              <option value="disbursed">Disbursed</option>
              <option value="rejected">Rejected</option>
              <option value="settled">Settled</option>
            </select>
          </div>
          <div>
            <select 
              value={branchFilter} 
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="all">Semua Cabang</option>
              {branches.map(branch => (
                <option key={branch.code} value={branch.code}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="7">7 Hari Terakhir</option>
              <option value="30">30 Hari Terakhir</option>
              <option value="90">90 Hari Terakhir</option>
              <option value="all">Semua Periode</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Daftar Requests ({filteredRequests.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">Request Info</th>
                <th className="text-left py-3 px-4">Branch</th>
                <th className="text-left py-3 px-4">Requester</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-left py-3 px-4">Purpose</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Approval Info</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id} className="border-b hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-medium text-blue-600">{request.request_number}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(request.request_date)}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-medium">{request.branch_name}</div>
                      <div className="text-xs text-gray-500">{request.branch_code}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-medium">{request.requested_by}</div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="font-semibold">{formatCurrency(request.amount)}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="max-w-xs">
                      <div className="truncate" title={request.purpose}>
                        {request.purpose}
                      </div>
                      {request.notes && (
                        <div className="text-xs text-gray-500 mt-1 truncate" title={request.notes}>
                          💬 {request.notes}
                        </div>
                      )}
                      {request.category && (
                        <div className="text-xs text-blue-500 mt-1">
                          📁 {request.category}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`text-xs font-medium ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)} {request.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    {request.approved_by && (
                      <div className="text-xs">
                        <div className="text-green-600">✅ {request.approved_by}</div>
                        <div className="text-gray-500">
                          {request.approved_at && formatDate(request.approved_at)}
                        </div>
                      </div>
                    )}
                    {request.disbursed_at && (
                      <div className="text-xs text-blue-600 mt-1">
                        💰 Disbursed: {formatDate(request.disbursed_at)}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-1 justify-center">
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="text-green-600 hover:text-green-800 p-1 rounded transition-colors"
                            title="Approve"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
                            title="Reject"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                      {request.status === 'approved' && (
                        <button
                          onClick={() => handleDisburse(request.id)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors text-xs"
                          title="Disburse"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                        </button>
                      )}
                      <a
                        href={`/pettycash/request/${request.id}`}
                        className="text-gray-600 hover:text-gray-800 p-1 rounded transition-colors"
                        title="View Detail"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </a>
                      <button
                        onClick={() => handleDelete(request.id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRequests.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium">Tidak ada request ditemukan</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || statusFilter !== 'all' || branchFilter !== 'all' 
                ? 'Coba ubah filter pencarian' 
                : 'Belum ada request petty cash yang dibuat'
              }
            </p>
            <a 
              href="/pettycash/request/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              ➕ Buat Request Pertama
            </a>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex justify-between items-center text-sm">
          <div>
            Menampilkan {filteredRequests.length} dari {requests.length} requests
          </div>
          <div className="flex gap-4">
            <span>Total Amount: <strong>{formatCurrency(stats.totalAmount)}</strong></span>
            <span>Pending Amount: <strong className="text-yellow-600">{formatCurrency(stats.pendingAmount)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PettyCashRequestsPage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <PettyCashRequestsContent />
      </Layout>
    </PageAccessControl>
  );
}