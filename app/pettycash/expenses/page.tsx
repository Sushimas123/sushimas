'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';
import * as XLSX from 'xlsx';

interface PettyCashExpense {
  id: number;
  request_id: number;
  category_id: number;
  expense_date: string;
  description: string;
  amount: number;
  receipt_number?: string;
  vendor_name?: string;
  notes?: string;
  created_by: number;
  created_at: string;
  request_number?: string;
  category_name?: string;
  created_by_name?: string;
  branch_name?: string;
  settlement_status?: string;
}

function PettyCashExpensesContent() {
  const [expenses, setExpenses] = useState<PettyCashExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('all');

  const exportToExcel = () => {
    const exportData = filteredExpenses.map((expense, index) => {
      const expensesForThisRequest = filteredExpenses.filter(e => e.request_id === expense.request_id);
      const currentExpenseIndex = expensesForThisRequest.findIndex(e => e.id === expense.id);
      const expensesUpToThis = expensesForThisRequest.slice(0, currentExpenseIndex + 1);
      const runningTotal = expensesUpToThis.reduce((sum, e) => sum + e.amount, 0);
      
      return {
        'Tanggal': formatDate(expense.expense_date),
        'Request Number': expense.request_number,
        'Cabang': expense.branch_name,
        'Kategori': expense.category_name,
        'Deskripsi': expense.description,
        'Nama Barang': expense.vendor_name || '-',
        'Jumlah': expense.amount,
        'Running Balance': runningTotal,
        'Status Settlement': expense.settlement_status || 'no_settlement',
        'Receipt Number': expense.receipt_number || '-',
        'Notes': expense.notes || '-'
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    
    const fileName = `petty_cash_expenses_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Hapus expense ini? Tindakan ini tidak dapat dibatalkan.')) return;
    
    try {
      // Get expense to check request_id
      const { data: expense } = await supabase
        .from('petty_cash_expenses')
        .select('request_id')
        .eq('id', id)
        .single();
      
      if (!expense) {
        alert('Expense tidak ditemukan');
        return;
      }
      
      // Check if request has completed settlement
      const { data: settlement } = await supabase
        .from('petty_cash_settlements')
        .select('status')
        .eq('request_id', expense.request_id)
        .eq('status', 'completed')
        .single();
      
      if (settlement) {
        alert('Expense tidak bisa dihapus karena request sudah ada settlement yang completed. Undo settlement terlebih dahulu.');
        return;
      }
      
      const { error } = await supabase
        .from('petty_cash_expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      alert('Expense berhasil dihapus!');
      fetchExpenses();
    } catch (error) {
      alert('Gagal menghapus expense');
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      
      const { data: expensesData, error } = await supabase
        .from('petty_cash_expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (error) throw error;

      // Fetch related data for each expense
      const formattedExpenses = [];
      for (const expense of expensesData || []) {
        // Fetch request data with branch info
        const { data: requestData } = await supabase
          .from('petty_cash_requests')
          .select(`
            request_number,
            branch_code,
            branches(nama_branch)
          `)
          .eq('id', expense.request_id)
          .single();
        
        // Fetch category name
        const { data: categoryData } = await supabase
          .from('categories')
          .select('category_name')
          .eq('id_category', expense.category_id)
          .single();
        
        // Fetch user name
        const { data: userData } = await supabase
          .from('users')
          .select('nama_lengkap')
          .eq('id_user', expense.created_by)
          .single();
        
        // Fetch settlement status
        const { data: settlementData } = await supabase
          .from('petty_cash_settlements')
          .select('status')
          .eq('request_id', expense.request_id)
          .single();
        
        formattedExpenses.push({
          id: expense.id,
          request_id: expense.request_id,
          category_id: expense.category_id,
          expense_date: expense.expense_date,
          description: expense.description,
          amount: expense.amount,
          receipt_number: expense.receipt_number,
          vendor_name: expense.vendor_name,
          notes: expense.notes,
          created_by: expense.created_by,
          created_at: expense.created_at,
          request_number: requestData?.request_number || `REQ-${expense.request_id}`,
          category_name: categoryData?.category_name || `Category ${expense.category_id}`,
          created_by_name: userData?.nama_lengkap || `User ${expense.created_by}`,
          branch_name: (requestData?.branches as any)?.nama_branch || 'Unknown Branch',
          settlement_status: settlementData?.status || 'no_settlement'
        });
      }

      setExpenses(formattedExpenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      alert('Gagal memuat data expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.request_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || expense.category_id.toString() === categoryFilter;
    
    const matchesSettlement = settlementFilter === 'all' || expense.settlement_status === settlementFilter;
    
    let matchesDate = true;
    if (startDate || endDate) {
      const expenseDate = new Date(expense.expense_date);
      if (startDate) {
        matchesDate = matchesDate && expenseDate >= new Date(startDate);
      }
      if (endDate) {
        matchesDate = matchesDate && expenseDate <= new Date(endDate);
      }
    }
    
    return matchesSearch && matchesCategory && matchesSettlement && matchesDate;
  });

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

  const categories = Array.from(new Set(expenses.map(e => e.category_id)))
    .map(id => {
      const expense = expenses.find(e => e.category_id === id);
      return {
        id: id,
        name: expense?.category_name || `Category ${id}`
      };
    });

  const stats = {
    total: expenses.length,
    totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
    filteredAmount: filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    runningBalance: expenses.length > 0 ? expenses.reduce((sum, e) => sum + e.amount, 0) : 0
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Petty Cash Expenses</h1>
          <p className="text-gray-600">Kelola semua pengeluaran petty cash</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            📊 Export Excel
          </button>
          <a 
            href="/pettycash/expenses/create"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            ➕ Tambah Expense
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Expenses</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-lg font-bold text-green-600">{formatCurrency(stats.totalAmount)}</div>
          <div className="text-sm text-gray-600">Total Amount</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-lg font-bold text-purple-600">{formatCurrency(stats.filteredAmount)}</div>
          <div className="text-sm text-gray-600">Filtered Amount</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-lg font-bold text-orange-600">{formatCurrency(stats.runningBalance)}</div>
          <div className="text-sm text-gray-600">Running Balance</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              placeholder="Cari description, vendor, atau request number..."
              className="w-full border rounded px-3 py-2 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="all">Semua Kategori</option>
              {categories.map(category => (
                <option key={category.id} value={category.id.toString()}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select 
              value={settlementFilter} 
              onChange={(e) => setSettlementFilter(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="all">Semua Status Settlement</option>
              <option value="no_settlement">Belum Settlement</option>
              <option value="pending">Settlement Pending</option>
              <option value="verified">Settlement Verified</option>
              <option value="completed">Settlement Completed</option>
            </select>
          </div>
          <div className="flex gap-1">
            <input
              type="date"
              className="border rounded px-2 py-2 text-xs flex-1"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              className="border rounded px-2 py-2 text-xs flex-1"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Daftar Expenses ({filteredExpenses.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Request</th>
                <th className="text-left py-3 px-4">Branch</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-left py-3 px-4">Nama Barang</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-right py-3 px-4">Running Balance</th>
                <th className="text-left py-3 px-4">Settlement Status</th>
                <th className="text-left py-3 px-4">Receipt</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense, index) => {
                // Calculate running balance per request (cumulative expenses for this request up to this point)
                const expensesForThisRequest = filteredExpenses.filter(e => e.request_id === expense.request_id);
                const currentExpenseIndex = expensesForThisRequest.findIndex(e => e.id === expense.id);
                const expensesUpToThis = expensesForThisRequest.slice(0, currentExpenseIndex + 1);
                const runningTotal = expensesUpToThis.reduce((sum, e) => sum + e.amount, 0);
                
                const getSettlementStatusBadge = (status: string) => {
                  switch (status) {
                    case 'completed':
                      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Completed</span>;
                    case 'verified':
                      return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Verified</span>;
                    case 'pending':
                      return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
                    case 'no_settlement':
                    default:
                      return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">No Settlement</span>;
                  }
                };
                
                return (
                <tr key={expense.id} className="border-b hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="font-medium">{formatDate(expense.expense_date)}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-blue-600 font-medium">{expense.request_number}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-green-600 font-medium">{expense.branch_name}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-purple-600">{expense.category_name}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="max-w-xs">
                      <div className="truncate" title={expense.description}>
                        {expense.description}
                      </div>
                      {expense.notes && (
                        <div className="text-xs text-gray-500 mt-1 truncate" title={expense.notes}>
                          💬 {expense.notes}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div>{expense.vendor_name || '-'}</div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="font-semibold">{formatCurrency(expense.amount)}</div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="font-semibold text-orange-600">{formatCurrency(runningTotal)}</div>
                  </td>
                  <td className="py-4 px-4">
                    {getSettlementStatusBadge(expense.settlement_status || 'no_settlement')}
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-xs">{expense.receipt_number || '-'}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-1 justify-center">
                      <a
                        href={`/pettycash/expenses/${expense.id}`}
                        className="text-gray-600 hover:text-gray-800 p-1 rounded transition-colors"
                        title="View Detail"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </a>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
                        title="Delete Expense"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredExpenses.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-lg font-medium">Tidak ada expense ditemukan</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || categoryFilter !== 'all' 
                ? 'Coba ubah filter pencarian' 
                : 'Belum ada expense yang dibuat'
              }
            </p>
            <a 
              href="/pettycash/expenses/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              ➕ Tambah Expense Pertama
            </a>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex justify-between items-center text-sm">
          <div>
            Menampilkan {filteredExpenses.length} dari {expenses.length} expenses
          </div>
          <div className="flex gap-4">
            <span>Total Amount: <strong>{formatCurrency(stats.totalAmount)}</strong></span>
            <span>Filtered Amount: <strong className="text-purple-600">{formatCurrency(stats.filteredAmount)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PettyCashExpensesPage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <PettyCashExpensesContent />
      </Layout>
    </PageAccessControl>
  );
}