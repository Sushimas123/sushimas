'use client';

import { useState, useEffect, useMemo } from 'react';
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

interface PettyCashRequest {
  id: number;
  amount: number;
  parent_request_id?: number;
  carried_balance?: number;
  request_number?: string;
  branch_code?: string;
  branches?: any;
  }


function PettyCashExpensesContent() {
  const [expenses, setExpenses] = useState<PettyCashExpense[]>([]);
  const [requests, setRequests] = useState<PettyCashRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Pre-compute running balances untuk mengatasi N+1
  const runningBalances = useMemo(() => {
    const balanceMap = new Map<number, number>();
    const requestMap = new Map(requests.map(r => [r.id, r]));
    
    // Group expenses by request_id and sort by date/id
    const expensesByRequest = new Map<number, PettyCashExpense[]>();
    expenses.forEach(expense => {
      if (!expensesByRequest.has(expense.request_id)) {
        expensesByRequest.set(expense.request_id, []);
      }
      expensesByRequest.get(expense.request_id)!.push(expense);
    });
    
    // Calculate running balance for each request
    expensesByRequest.forEach((requestExpenses, requestId) => {
      const request = requestMap.get(requestId);
      if (!request) return;
      
      const totalAvailable = request.amount + (request.carried_balance || 0);
      let runningTotal = 0;
      
      // Sort expenses by date then by id
      const sortedExpenses = requestExpenses.sort((a, b) => {
        const dateA = new Date(a.expense_date).getTime();
        const dateB = new Date(b.expense_date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.id - b.id;
      });
      
      sortedExpenses.forEach(expense => {
        runningTotal += expense.amount;
        balanceMap.set(expense.id, totalAvailable - runningTotal);
      });
    });
    
    return balanceMap;
  }, [expenses, requests]);

  const exportToExcel = () => {
    try {
      const exportData = filteredExpenses.map((expense) => {
        const runningBalance = runningBalances.get(expense.id) || 0;
        
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
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengexport data ke Excel');
    }
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
      console.error('Conversion error:', error);
      alert(`Gagal konversi: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Hapus expense ini? Jika sudah dikonversi ke barang masuk, data barang masuk juga akan terhapus.')) return;
    
    try {
      const { data: expense, error: expenseError } = await supabase
        .from('petty_cash_expenses')
        .select('request_id, barang_masuk_id')
        .eq('id', id)
        .single();
      
      if (expenseError) throw expenseError;
      if (!expense) {
        alert('Expense tidak ditemukan');
        return;
      }
      
      const { data: settlement, error: settlementError } = await supabase
        .from('petty_cash_settlements')
        .select('status')
        .eq('request_id', expense.request_id)
        .eq('status', 'completed')
        .single();
      
      if (settlementError && settlementError.code !== 'PGRST116') throw settlementError;
      
      if (settlement) {
        alert('Expense tidak bisa dihapus karena request sudah ada settlement yang completed. Undo settlement terlebih dahulu.');
        return;
      }
      
      // Check for related gudang entries
      const { data: gudangEntries, error: gudangError } = await supabase
        .from('gudang')
        .select('*')
        .or(`source_reference.ilike.%PETTY-CASH-${id}%,source_reference.ilike.%${id}%`);
      
      if (gudangError) throw gudangError;
      
      if (gudangEntries && gudangEntries.length > 0) {
        if (!confirm('Expense ini sudah masuk ke gudang. Hapus juga dari gudang? Ini akan mempengaruhi stok.')) {
          return;
        }
        
        for (const gudangEntry of gudangEntries) {
          const { error: gudangDeleteError } = await supabase
            .from('gudang')
            .delete()
            .eq('order_no', gudangEntry.order_no);
          
          if (gudangDeleteError) {
            console.error('Gudang delete error:', gudangDeleteError);
            alert(`Gagal menghapus data dari gudang: ${gudangDeleteError.message}`);
            return;
          }
        }
      }
      
      // Remove foreign key reference first
      if (expense.barang_masuk_id) {
        const { error: updateError } = await supabase
          .from('petty_cash_expenses')
          .update({ barang_masuk_id: null })
          .eq('id', id);
        
        if (updateError) throw updateError;
      }
      
      // Delete the expense
      const { error: expenseDeleteError } = await supabase
        .from('petty_cash_expenses')
        .delete()
        .eq('id', id);
      
      if (expenseDeleteError) throw expenseDeleteError;
      
      // Delete related barang_masuk entries
      if (expense.barang_masuk_id) {
        const { error: barangMasukError } = await supabase
          .from('barang_masuk')
          .delete()
          .eq('id', expense.barang_masuk_id);
        
        if (barangMasukError) {
          console.error('Barang masuk delete error:', barangMasukError);
        }
      } else {
        // Check for barang_masuk with source_reference containing expense ID
        const { data: barangMasukEntries, error: barangMasukSearchError } = await supabase
          .from('barang_masuk')
          .select('*')
          .or(`no_po.ilike.%PETTY-CASH-${id}%,no_po.ilike.%${id}%`);
        
        if (barangMasukSearchError) {
          console.error('Barang masuk search error:', barangMasukSearchError);
        } else if (barangMasukEntries && barangMasukEntries.length > 0) {
          for (const barangMasuk of barangMasukEntries) {
            const { error: barangMasukDeleteError } = await supabase
              .from('barang_masuk')
              .delete()
              .eq('id', barangMasuk.id);
            
            if (barangMasukDeleteError) {
              console.error('Barang masuk delete error:', barangMasukDeleteError);
            }
          }
        }
      }
      
      alert('Expense berhasil dihapus!' + (expense.barang_masuk_id ? ' Data barang masuk terkait juga telah dihapus.' : ''));
      fetchExpenses();
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Gagal menghapus expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      
      const userData = localStorage.getItem('user');
      let userRole = '';
      let allowedBranchCodes: string[] = [];
      
      if (userData) {
        try {
          const user = JSON.parse(userData);
          userRole = user.role || '';
          
          if (userRole !== 'super admin' && userRole !== 'admin' && user.id_user) {
            const { data: userBranches, error: userBranchesError } = await supabase
              .from('user_branches')
              .select('kode_branch')
              .eq('id_user', user.id_user)
              .eq('is_active', true);
            
            if (userBranchesError) throw userBranchesError;
            
            allowedBranchCodes = userBranches?.map(ub => ub.kode_branch) || [];
          }
        } catch (parseError) {
          console.error('Error parsing user data:', parseError);
        }
      }
      
      // Fetch all data in parallel
      const [
        requestsResult,
        expensesResult,
        categoriesResult,
        usersResult,
        settlementsResult
      ] = await Promise.all([
        supabase.from('petty_cash_requests')
          .select('id, amount, parent_request_id, carried_balance, request_number, branch_code, branches(nama_branch)')
          .order('created_at', { ascending: true }),
        supabase.from('petty_cash_expenses').select('*').order('expense_date', { ascending: false }),
        supabase.from('categories').select('id_category, category_name'),
        supabase.from('users').select('id_user, nama_lengkap'),
        supabase.from('petty_cash_settlements').select('request_id, status')
      ]);

      // Handle errors
      if (expensesResult.error) throw expensesResult.error;
      if (requestsResult.error) throw requestsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (usersResult.error) throw usersResult.error;
      if (settlementsResult.error) throw settlementsResult.error;

      // Create lookup maps
      const requestsMap = new Map((requestsResult.data || []).map(r => [r.id, r]));
      const categoriesMap = new Map((categoriesResult.data || []).map(c => [c.id_category, c.category_name]));
      const usersMap = new Map((usersResult.data || []).map(u => [u.id_user, u.nama_lengkap]));
      const settlementsMap = new Map((settlementsResult.data || []).map(s => [s.request_id, s.status]));

      // Filter requests by branch
      let filteredRequests = requestsResult.data || [];
      if (userRole !== 'super admin' && userRole !== 'admin') {
        if (allowedBranchCodes.length > 0) {
          filteredRequests = filteredRequests.filter(r => 
            r.branch_code && allowedBranchCodes.includes(r.branch_code)
          );
        } else {
          filteredRequests = [];
        }
      }
      setRequests(filteredRequests);

      const allowedRequestIds = new Set(filteredRequests.map(r => r.id));

      // Map expenses with lookups
      const formattedExpenses = (expensesResult.data || [])
        .filter(expense => 
          userRole === 'super admin' || 
          userRole === 'admin' || 
          allowedRequestIds.has(expense.request_id)
        )
        .map(expense => {
          const request = requestsMap.get(expense.request_id);
          const branchName = (request?.branches as any)?.nama_branch || 'Unknown Branch';
          
          return {
            ...expense,
            request_number: request?.request_number || `REQ-${expense.request_id}`,
            category_name: categoriesMap.get(expense.category_id) || `Category ${expense.category_id}`,
            created_by_name: usersMap.get(expense.created_by) || `User ${expense.created_by}`,
            branch_name: branchName,
            settlement_status: settlementsMap.get(expense.request_id) || 'no_settlement'
          };
        });

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.description.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      expense.vendor_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      expense.request_number?.toLowerCase().includes(debouncedSearch.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || expense.category_id.toString() === categoryFilter;
    
    const matchesBranch = branchFilter === 'all' || expense.branch_name === branchFilter;
    
    const matchesSettlement = settlementFilter === 'all' || expense.settlement_status === settlementFilter;
    
    let matchesDate = true;
    if (startDate || endDate) {
      const expenseDate = new Date(expense.expense_date);
      if (startDate) {
        matchesDate = matchesDate && expenseDate >= new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && expenseDate <= endDateTime;
      }
    }
    
    return matchesSearch && matchesCategory && matchesBranch && matchesSettlement && matchesDate;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  // Memoized categories dan branches
  const categories = useMemo(() => 
    Array.from(new Set(expenses.map(e => e.category_id)))
      .map(id => {
        const expense = expenses.find(e => e.category_id === id);
        return {
          id: id,
          name: expense?.category_name || `Category ${id}`
        };
      }), [expenses]);

  const branches = useMemo(() => 
    Array.from(new Set(expenses.map(e => e.branch_name)))
      .filter((name): name is string => !!name)
      .sort(), [expenses]);

  // Pagination
  const totalPages = Math.ceil(filteredExpenses.length / pageSize);
  const paginatedExpenses = filteredExpenses.slice((page - 1) * pageSize, page * pageSize);

  const stats = {
    total: expenses.length,
    totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
    filteredAmount: filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    totalRemaining: requests.reduce((sum, r) => {
      const requestExpenses = expenses.filter(e => e.request_id === r.id);
      const totalExpenses = requestExpenses.reduce((expSum, e) => expSum + e.amount, 0);
      return sum + (r.amount + (r.carried_balance || 0)) - totalExpenses;
    }, 0)
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
              <label className="block text-xs text-gray-600 mb-1">Cabang</label>
              <select 
                value={branchFilter} 
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="all">Semua Cabang</option>
                {branches.map(branch => (
                  <option key={branch} value={branch}>
                    {branch}
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              value={branchFilter} 
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="all">Semua Cabang</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>
                  {branch}
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

      {/* Expenses List - Table Only */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Daftar Pengeluaran ({filteredExpenses.length})</h2>
        
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-xs border table-fixed">
            <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="text-left py-2 px-2 border-b w-20">Tgl</th>
              <th className="text-left py-2 px-2 border-b w-24">Kode Modal</th>
              <th className="text-left py-2 px-2 border-b w-32">Cabang</th>
              <th className="text-left py-2 px-2 border-b w-20">Category</th>
              <th className="text-left py-2 px-2 border-b w-32">Description</th>
              <th className="text-left py-2 px-2 border-b w-24">Nama Barang</th>
              <th className="text-right py-2 px-2 border-b w-16">Qty</th>
              <th className="text-right py-2 px-2 border-b w-20">Harga</th>
              <th className="text-right py-2 px-2 border-b w-20">Total</th>
              <th className="text-right py-2 px-2 border-b w-24">Running Balance</th>
              <th className="text-left py-2 px-2 border-b w-20">Settlement</th>
              <th className="text-left py-2 px-2 border-b w-20">Receipt</th>
              <th className="text-center py-2 px-2 border-b w-20">Actions</th>
            </tr>
          </thead>
            <tbody>
              {paginatedExpenses.map((expense) => {
                const runningBalance = runningBalances.get(expense.id) || 0;
                
                return (
                  <tr key={expense.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <div className="text-xs">{formatDate(expense.expense_date)}</div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-blue-600 text-xs truncate" title={expense.request_number}>{expense.request_number}</div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-green-600 text-xs truncate" title={expense.branch_name}>{expense.branch_name}</div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-purple-600 text-xs truncate" title={expense.category_name}>{expense.category_name}</div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-xs truncate" title={expense.description}>
                        {expense.description}
                      </div>
                      {expense.notes && (
                        <div className="text-xs text-gray-500 truncate" title={expense.notes}>
                          💬 {expense.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-xs truncate" title={expense.vendor_name || '-'}>{expense.vendor_name || '-'}</div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="text-xs">{expense.qty || (expense.amount && expense.harga ? (expense.amount / expense.harga).toFixed(2) : '-')}</div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="text-xs">{expense.harga ? formatCurrency(expense.harga) : (expense.qty && expense.amount ? formatCurrency(expense.amount / expense.qty) : '-')}</div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="font-semibold text-xs">{formatCurrency(expense.amount)}</div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className={`font-semibold text-xs ${runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(runningBalance)}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-1 py-0.5 text-xs rounded-full ${
                        expense.settlement_status === 'completed' ? 'bg-green-100 text-green-800' :
                        expense.settlement_status === 'verified' ? 'bg-blue-100 text-blue-800' :
                        expense.settlement_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {expense.settlement_status === 'completed' ? 'Done' :
                         expense.settlement_status === 'verified' ? 'Verified' :
                         expense.settlement_status === 'pending' ? 'Pending' : 'None'}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-xs truncate" title={expense.receipt_number || '-'}>{expense.receipt_number || '-'}</div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex gap-0.5 justify-center">
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

        {paginatedExpenses.length === 0 && filteredExpenses.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-lg font-medium">Tidak ada pengeluaran ditemukan</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || categoryFilter !== 'all' 
                ? 'Coba ubah filter pencarian' 
                : 'Belum ada pengeluaran yang dibuat'
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredExpenses.length)} of {filteredExpenses.length} entries
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="hidden md:flex gap-2">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-2 text-sm rounded ${
                      page === pageNum ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="px-2 py-2 text-sm">...</span>}
            </div>
            <span className="md:hidden px-3 py-2 text-sm bg-gray-50 rounded">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

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
