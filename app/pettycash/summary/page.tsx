'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';

interface PettyCashSummary {
  id: number;
  request_number: string;
  branch_code: string;
  nama_branch: string;
  requested_by_name: string;
  approved_by_name?: string;
  request_date: string;
  amount: number;
  purpose: string;
  status: string;
  total_expenses: number;
  remaining_amount: number;
}

function PettyCashSummaryContent() {
  const [summaries, setSummaries] = useState<PettyCashSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [categoriesData, setCategoriesData] = useState<any[]>([]);

  const fetchSummaries = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('petty_cash_summary')
        .select('*')
        .order('request_date', { ascending: false });

      if (error) throw error;
      setSummaries(data || []);
      
      // Fetch expenses data for dropdown
      const { data: expensesData } = await supabase
        .from('petty_cash_expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      
      setExpensesData(expensesData || []);
      
      // Fetch categories data
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id_category, category_name');
      
      setCategoriesData(categoriesData || []);
    } catch (error) {
      console.error('Error fetching summaries:', error);
      alert('Gagal memuat data summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, []);

  const filteredSummaries = summaries.filter(summary => {
    const matchesSearch = 
      summary.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.requested_by_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || summary.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || summary.branch_code === branchFilter;
    
    return matchesSearch && matchesStatus && matchesBranch;
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

  const branches = Array.from(new Set(summaries.map(s => s.branch_code)))
    .map(code => {
      const summary = summaries.find(s => s.branch_code === code);
      return {
        code: code,
        name: summary?.nama_branch || code
      };
    });

  const stats = {
    total: summaries.length,
    totalRequested: summaries.reduce((sum, s) => sum + s.amount, 0),
    totalExpenses: summaries.reduce((sum, s) => sum + s.total_expenses, 0),
    totalRemaining: summaries.reduce((sum, s) => sum + s.remaining_amount, 0),
    pendingCount: summaries.filter(s => s.status === 'pending').length,
    disbursedCount: summaries.filter(s => s.status === 'disbursed').length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Petty Cash Summary</h1>
          <p className="text-gray-600">Ringkasan semua request dengan expenses dan sisa saldo</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Requests</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-lg font-bold text-green-600">{formatCurrency(stats.totalRequested)}</div>
          <div className="text-sm text-gray-600">Total Requested</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-lg font-bold text-red-600">{formatCurrency(stats.totalExpenses)}</div>
          <div className="text-sm text-gray-600">Total Expenses</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-lg font-bold text-purple-600">{formatCurrency(stats.totalRemaining)}</div>
          <div className="text-sm text-gray-600">Total Remaining</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{stats.disbursedCount}</div>
          <div className="text-sm text-gray-600">Disbursed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Summary Report ({filteredSummaries.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">Request Info</th>
                <th className="text-left py-3 px-4">Branch</th>
                <th className="text-left py-3 px-4">Requester</th>
                <th className="text-right py-3 px-4">Requested</th>
                <th className="text-right py-3 px-4">Expenses</th>
                <th className="text-right py-3 px-4">Remaining</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.map((summary) => {
                const isExpanded = expandedRows.has(summary.id);
                
                const toggleExpanded = () => {
                  const newExpanded = new Set(expandedRows);
                  if (isExpanded) {
                    newExpanded.delete(summary.id);
                  } else {
                    newExpanded.add(summary.id);
                  }
                  setExpandedRows(newExpanded);
                };
                
                // Get expenses for this request
                const requestExpenses = expensesData.filter(expense => expense.request_id === summary.id);
                
                return (
                  <React.Fragment key={summary.id}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={toggleExpanded}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                          <div>
                            <div className="font-medium text-blue-600">{summary.request_number}</div>
                            <div className="text-xs text-gray-500">{formatDate(summary.request_date)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium">{summary.nama_branch}</div>
                          <div className="text-xs text-gray-500">{summary.branch_code}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium">{summary.requested_by_name}</div>
                          {summary.approved_by_name && (
                            <div className="text-xs text-green-600">✓ {summary.approved_by_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-semibold">{formatCurrency(summary.amount)}</div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-semibold text-red-600">{formatCurrency(summary.total_expenses)}</div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className={`font-bold ${summary.remaining_amount > 0 ? 'text-green-600' : summary.remaining_amount < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {formatCurrency(Math.abs(summary.remaining_amount))}
                          {summary.remaining_amount < 0 && ' (Over)'}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`text-xs font-medium ${getStatusColor(summary.status)}`}>
                          {getStatusIcon(summary.status)} {summary.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="max-w-xs truncate" title={summary.purpose}>
                          {summary.purpose}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="py-2 px-4 bg-gray-50">
                          <div className="text-sm">
                            <div className="font-medium mb-2">Expenses Detail ({requestExpenses.length}):</div>
                            {requestExpenses.length > 0 ? (
                              <div className="space-y-1">
                                {requestExpenses.map(expense => {
                                  const categoryData = categoriesData?.find(c => c.id_category === expense.category_id);
                                  const expenseDate = new Date(expense.expense_date).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  });
                                  return (
                                    <div key={expense.id} className="text-xs text-gray-700">
                                      <span className="text-gray-500">{expenseDate}</span> | {categoryData?.category_name || 'Other'} | {expense.vendor_name || expense.description} | <span className="font-semibold text-green-600">{formatCurrency(expense.amount)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">Belum ada expenses</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredSummaries.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium">Tidak ada data summary ditemukan</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' || branchFilter !== 'all'
                ? 'Coba ubah filter pencarian' 
                : 'Belum ada request yang dibuat'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PettyCashSummaryPage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <PettyCashSummaryContent />
      </Layout>
    </PageAccessControl>
  );
}