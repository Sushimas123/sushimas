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
  qty?: number;
  harga?: number;
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
  product_id?: number;
  barang_masuk_id?: number;
}

function PettyCashExpensesContent() {
  const [expenses, setExpenses] = useState<PettyCashExpense[]>([]);
  const [requests, setRequests] = useState<{id: number, amount: number, parent_request_id?: number, carried_balance?: number, request_number?: string, branch_code?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const exportToExcel = () => {
    const exportData = filteredExpenses.map((expense, index) => {
      const runningBalance = calculateRunningBalance(expense);
      
      return {
        'Tanggal': formatDate(expense.expense_date),
        'Request Number': expense.request_number,
        'Cabang': expense.branch_name,
        'Kategori': expense.category_name,
        'Deskripsi': expense.description,
        'Nama Barang': expense.vendor_name || '-',
        'Qty': expense.qty || '-',
        'Harga Satuan': expense.harga || '-',
        'Total': expense.amount,
        'Running Balance': runningBalance,
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

  const handleConvertToBarangMasuk = async (expense: PettyCashExpense) => {
    if (!expense.product_id || !expense.qty) {
      alert('Expense harus memiliki product dan quantity untuk dikonversi');
      return;
    }

    if (expense.barang_masuk_id) {
      alert('Expense ini sudah dikonversi ke barang masuk');
      return;
    }

    if (!confirm(`Konversi expense "${expense.description}" ke barang masuk?`)) return;

    try {
      const response = await fetch('/api/barang-masuk/from-petty-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId: expense.id })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal konversi');
      }

      alert('Berhasil dikonversi ke barang masuk!');
      fetchExpenses();
    } catch (error) {
      alert(`Gagal konversi: ${error}`);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Hapus expense ini? Jika sudah dikonversi ke barang masuk, data barang masuk juga akan terhapus.')) return;
    
    try {
      const { data: expense } = await supabase
        .from('petty_cash_expenses')
        .select('request_id, barang_masuk_id')
        .eq('id', id)
        .single();
      
      if (!expense) {
        alert('Expense tidak ditemukan');
        return;
      }
      
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
      
      if (expense.barang_masuk_id) {
        const { data: barangMasukData } = await supabase
          .from('barang_masuk')
          .select('no_po, id_barang, tanggal')
          .eq('id', expense.barang_masuk_id)
          .single();
        
        if (barangMasukData) {
          const { data: gudangEntry } = await supabase
            .from('gudang')
            .select('id')
            .eq('id_product', barangMasukData.id_barang)
            .eq('source_type', 'PO')
            .eq('source_reference', barangMasukData.no_po)
            .eq('tanggal', barangMasukData.tanggal)
            .maybeSingle();
          
          if (gudangEntry) {
            if (!confirm('Barang sudah masuk ke gudang. Hapus juga dari gudang? Ini akan mempengaruhi stok.')) {
              return;
            }
            
            const { error: gudangDeleteError } = await supabase
              .from('gudang')
              .delete()
              .eq('id_product', barangMasukData.id_barang)
              .eq('source_type', 'PO')
              .eq('source_reference', barangMasukData.no_po)
              .eq('tanggal', barangMasukData.tanggal);
            
            if (gudangDeleteError) {
              console.error('Gudang delete error:', gudangDeleteError);
              alert(`Gagal menghapus data dari gudang: ${gudangDeleteError.message}`);
              return;
            }
          }
        }
        
        const { error: updateError } = await supabase
          .from('petty_cash_expenses')
          .update({ barang_masuk_id: null })
          .eq('id', id);
        
        if (updateError) {
          console.error('Update expense error:', updateError);
          alert(`Gagal mengupdate expense: ${updateError.message}`);
          return;
        }
        
        const { error: barangMasukError } = await supabase
          .from('barang_masuk')
          .delete()
          .eq('id', expense.barang_masuk_id);
        
        if (barangMasukError) {
          console.error('Barang masuk delete error:', barangMasukError);
          alert(`Gagal menghapus data barang masuk: ${barangMasukError.message}`);
          return;
        }
      }
      
      const { error } = await supabase
        .from('petty_cash_expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      alert('Expense berhasil dihapus!' + (expense.barang_masuk_id ? ' Data barang masuk terkait juga telah dihapus.' : ''));
      fetchExpenses();
    } catch (error) {
      alert('Gagal menghapus expense');
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      
      // Get user data and check role
      const userData = localStorage.getItem('user');
      let userRole = '';
      let allowedBranchCodes: string[] = [];
      
      if (userData) {
        const user = JSON.parse(userData);
        userRole = user.role;
        
        // For non-admin users, get their allowed branches
        if (userRole !== 'super admin' && userRole !== 'admin' && user.id_user) {
          const { data: userBranches } = await supabase
            .from('user_branches')
            .select('kode_branch')
            .eq('id_user', user.id_user)
            .eq('is_active', true);
          
          allowedBranchCodes = userBranches?.map(ub => ub.kode_branch) || [];
        }
      }
      
      // Fetch requests with branch filtering
      let requestsQuery = supabase
        .from('petty_cash_requests')
        .select(`
          id, 
          amount, 
          parent_request_id, 
          carried_balance,
          request_number,
          branch_code
        `)
        .order('created_at', { ascending: true });
      
      // Apply branch filter for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranchCodes.length > 0) {
        requestsQuery = requestsQuery.in('branch_code', allowedBranchCodes);
      }
      
      const { data: requestsData } = await requestsQuery;
      setRequests(requestsData || []);
      
      // Get request IDs for filtering expenses
      const allowedRequestIds = requestsData?.map(r => r.id) || [];
      
      // Fetch expenses filtered by allowed requests
      let expensesQuery = supabase
        .from('petty_cash_expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      
      // Apply request filter for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && allowedRequestIds.length > 0) {
        expensesQuery = expensesQuery.in('request_id', allowedRequestIds);
      }
      
      const { data: expensesData, error } = await expensesQuery;

      if (error) throw error;

      const formattedExpenses = [];
      for (const expense of expensesData || []) {
        const { data: requestData } = await supabase
          .from('petty_cash_requests')
          .select(`
            request_number,
            branch_code,
            branches(nama_branch)
          `)
          .eq('id', expense.request_id)
          .single();
        
        const { data: categoryData } = await supabase
          .from('categories')
          .select('category_name')
          .eq('id_category', expense.category_id)
          .single();
        
        const { data: userData } = await supabase
          .from('users')
          .select('nama_lengkap')
          .eq('id_user', expense.created_by)
          .single();
        
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
          qty: expense.qty,
          harga: expense.harga,
          receipt_number: expense.receipt_number,
          vendor_name: expense.vendor_name,
          notes: expense.notes,
          created_by: expense.created_by,
          created_at: expense.created_at,
          request_number: requestData?.request_number || `REQ-${expense.request_id}`,
          category_name: categoryData?.category_name || `Category ${expense.category_id}`,
          created_by_name: userData?.nama_lengkap || `User ${expense.created_by}`,
          branch_name: (requestData?.branches as any)?.nama_branch || 'Unknown Branch',
          settlement_status: settlementData?.status || 'no_settlement',
          product_id: expense.product_id,
          barang_masuk_id: expense.barang_masuk_id
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

  const calculateRunningBalance = (expense: PettyCashExpense) => {
    const request = requests.find(r => r.id === expense.request_id);
    if (!request) return 0;

    const totalAvailable = request.amount + (request.carried_balance || 0);

    const relevantExpenses = expenses.filter(e => 
      e.request_id === expense.request_id && 
      (new Date(e.expense_date) < new Date(expense.expense_date) ||
      (new Date(e.expense_date).getTime() === new Date(expense.expense_date).getTime() && e.id <= expense.id))
    );

    const totalExpensesUpToNow = relevantExpenses.reduce((sum, e) => sum + e.amount, 0);

    return totalAvailable - totalExpensesUpToNow;
  };

  const stats = {
    total: expenses.length,
    totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
    filteredAmount: filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    totalRemaining: requests.reduce((sum, r) => {
      const requestExpenses = expenses.filter(e => e.request_id === r.id);
      const totalExpenses = requestExpenses.reduce((expSum, e) => expSum + e.amount, 0);
      return sum + (r.amount + ((r as any).carried_balance || 0)) - totalExpenses;
    }, 0)
  };

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
    <div className="space-y-4 md:space-y-6">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Pengeluaran Petty Cash</h1>
          <p className="text-gray-600 text-sm md:text-base">Kelola semua pengeluaran petty cash</p>
        </div>
        
        {/* Action Buttons - Stacked on mobile */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={exportToExcel}
            className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 text-sm md:text-base"
          >
            📊 Export Excel
          </button>
          <a 
            href="/pettycash/expenses/create"
            className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm md:text-base"
          >
            ➕ Tambah Pengeluaran
          </a>
        </div>
      </div>

      {/* Stats Cards - Grid 2x2 on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-3 md:p-4 rounded-lg border text-center">
          <div className="text-lg md:text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-xs md:text-sm text-gray-600">Total Pengeluaran</div>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-lg border text-center">
          <div className="text-sm md:text-lg font-bold text-green-600">{formatCurrency(stats.totalAmount)}</div>
          <div className="text-xs md:text-sm text-gray-600">Total Amount</div>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-lg border text-center">
          <div className="text-sm md:text-lg font-bold text-purple-600">{formatCurrency(stats.filteredAmount)}</div>
          <div className="text-xs md:text-sm text-gray-600">Filtered Amount</div>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-lg border text-center">
          <div className="text-sm md:text-lg font-bold text-orange-600">{formatCurrency(stats.totalRemaining)}</div>
          <div className="text-xs md:text-sm text-gray-600">Sisa Modal</div>
        </div>
      </div>

      {/* Search Bar - Always visible */}
      <div className="bg-white p-4 rounded-lg border">
        <input
          type="text"
          placeholder="Cari description, vendor, atau request number..."
          className="w-full border rounded px-3 py-3 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Filter Toggle for Mobile */}
      <div className="bg-white p-4 rounded-lg border md:hidden">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="w-full flex justify-between items-center text-sm font-medium"
        >
          <span>Filter Data</span>
          <svg 
            className={`w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isFilterOpen && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Kategori</label>
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
              <label className="block text-xs text-gray-600 mb-1">Status Settlement</label>
              <select 
                value={settlementFilter} 
                onChange={(e) => setSettlementFilter(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="all">Semua Status</option>
                <option value="no_settlement">Belum Settlement</option>
                <option value="pending">Settlement Pending</option>
                <option value="verified">Settlement Verified</option>
                <option value="completed">Settlement Completed</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-2 text-xs"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-2 text-xs"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters for Desktop */}
      <div className="bg-white p-4 rounded-lg border hidden md:block">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

      {/* Expenses List - Mobile Cards */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 md:p-6 border-b">
          <h2 className="text-lg font-semibold">Daftar Pengeluaran   ({filteredExpenses.length})</h2>
        </div>
        
        {/* Mobile View - Cards */}
        <div className="md:hidden">
          {filteredExpenses.map((expense) => {
            const runningBalance = calculateRunningBalance(expense);
            
            return (
              <div key={expense.id} className="border-b p-4 space-y-3">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-blue-600">{expense.request_number}</div>
                    <div className="text-sm text-gray-500">{formatDate(expense.expense_date)}</div>
                  </div>
                  {getSettlementStatusBadge(expense.settlement_status || 'no_settlement')}
                </div>
                
                {/* Basic Info */}
                <div>
                  <div className="font-medium text-sm mb-1">{expense.description}</div>
                  <div className="text-xs text-gray-600 flex flex-wrap gap-2">
                    <span>{expense.branch_name}</span>
                    <span>•</span>
                    <span>{expense.category_name}</span>
                  </div>
                </div>
                
                {/* Vendor & Product Info */}
                {expense.vendor_name && (
                  <div className="text-sm">
                    <span className="text-gray-600">Vendor: </span>
                    {expense.vendor_name}
                  </div>
                )}
                
                {/* Quantity & Price */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600 text-xs">Qty</div>
                    <div>{expense.qty || (expense.amount && expense.harga ? (expense.amount / expense.harga).toFixed(2) : '-')}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-xs">Harga Satuan</div>
                    <div>{expense.harga ? formatCurrency(expense.harga) : (expense.qty && expense.amount ? formatCurrency(expense.amount / expense.qty) : '-')}</div>
                  </div>
                </div>
                
                {/* Amount & Balance */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-600 text-xs">Total Amount</div>
                    <div className="font-semibold text-green-600">{formatCurrency(expense.amount)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-xs">Running Balance</div>
                    <div className={`font-semibold ${runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(runningBalance)}
                    </div>
                  </div>
                </div>
                
                {/* Notes */}
                {expense.notes && (
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    💬 {expense.notes}
                  </div>
                )}
                
                {/* Receipt */}
                {expense.receipt_number && (
                  <div className="text-xs">
                    <span className="text-gray-600">Receipt: </span>
                    {expense.receipt_number}
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex justify-between pt-2 border-t">
                  <div className="flex gap-2">
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
                    
                    {expense.product_id && expense.qty && !expense.barang_masuk_id && (
                      <button
                        onClick={() => handleConvertToBarangMasuk(expense)}
                        className="text-green-600 hover:text-green-800 p-1 rounded transition-colors"
                        title="Convert to Barang Masuk"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      </button>
                    )}
                    
                    {expense.barang_masuk_id && (
                      <a
                        href={`/purchaseorder/barang_masuk`}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors"
                        title="View in Barang Masuk"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                  
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
              </div>
            );
          })}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">Tgl</th>
                <th className="text-left py-3 px-4">Kode Modal</th>
                <th className="text-left py-3 px-4">Cabang</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-left py-3 px-4">Nama Barang</th>
                <th className="text-right py-3 px-4">Qty</th>
                <th className="text-right py-3 px-4">Harga</th>
                <th className="text-right py-3 px-4">Total</th>
                <th className="text-right py-3 px-4">Running Balance</th>
                <th className="text-left py-3 px-4">Settlement Status</th>
                <th className="text-left py-3 px-4">Receipt</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => {
                const runningBalance = calculateRunningBalance(expense);
                
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
                      <div>{expense.qty || (expense.amount && expense.harga ? (expense.amount / expense.harga).toFixed(2) : '-')}</div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div>{expense.harga ? formatCurrency(expense.harga) : (expense.qty && expense.amount ? formatCurrency(expense.amount / expense.qty) : '-')}</div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="font-semibold">{formatCurrency(expense.amount)}</div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className={`font-semibold ${runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(runningBalance)}
                      </div>
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
                        {expense.product_id && expense.qty && !expense.barang_masuk_id && (
                          <button
                            onClick={() => handleConvertToBarangMasuk(expense)}
                            className="text-green-600 hover:text-green-800 p-1 rounded transition-colors"
                            title="Convert to Barang Masuk"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          </button>
                        )}
                        {expense.barang_masuk_id && (
                          <a
                            href={`/purchaseorder/barang_masuk`}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors"
                            title="View in Barang Masuk"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
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
            <h3 className="text-lg font-medium">Tidak ada pengeluaran ditemukan</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || categoryFilter !== 'all' 
                ? 'Coba ubah filter pencarian' 
                : 'Belum ada pengeluaran   yang dibuat'
              }
            </p>
            <a 
              href="/pettycash/expenses/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              ➕ Tambah Pengeluaran Pertama
            </a>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm gap-2">
          <div>
            Menampilkan {filteredExpenses.length} dari {expenses.length} expenses
          </div>
          <div className="flex flex-col md:flex-row gap-2 md:gap-4 text-center md:text-left">
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