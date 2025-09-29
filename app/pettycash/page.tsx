'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';

interface PettyCashData {
  totalBalance: number;
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  totalExpenses: number;
  pendingSettlements: number;
  branchBalances: BranchBalance[];
  summaries: PettyCashSummary[];
  expensesData?: any[];
  requestsData?: any[];
  categoriesData?: any[];
  settlementsData?: any[];
}

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

interface BranchBalance {
  branch_code: string;
  branch_name: string;
  current_balance: number;
  allocated_amount: number;
  spent_amount: number;
  pending_amount: number;
  last_reload: string;
  status: 'healthy' | 'low' | 'critical';
}

interface RecentRequest {
  id: number;
  request_number: string;
  branch_code: string;
  amount: number;
  purpose: string;
  status: string;
  requested_by: string;
  request_date: string;
}

interface MonthlyData {
  month: string;
  requests: number;
  expenses: number;
  balance: number;
}

interface CategoryData {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

function PettyCashDashboardContent() {
  const [data, setData] = useState<PettyCashData>({
    totalBalance: 0,
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    totalExpenses: 0,
    pendingSettlements: 0,
    branchBalances: [],
    summaries: []
  });

  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [expandedSummaries, setExpandedSummaries] = useState<Set<number>>(new Set());
  const [branchSort, setBranchSort] = useState<{field: string, direction: 'asc' | 'desc'}>({field: 'branch_name', direction: 'asc'});
  const [summarySort, setSummarySort] = useState<{field: string, direction: 'asc' | 'desc'}>({field: 'request_date', direction: 'desc'});
  const [summaryBranchFilter, setSummaryBranchFilter] = useState('all');
  const [summaryStatusFilter, setSummaryStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'summary'>('overview');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'low': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const getRequestStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'disbursed': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }, []);

  const fetchDashboardData = useCallback(async () => {
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
      
      // Fetch requests data with branch filtering
      let requestsQuery = supabase
        .from('petty_cash_requests')
        .select(`
          *,
          branches(nama_branch),
          requested_by_user:users!petty_cash_requests_requested_by_fkey(nama_lengkap)
        `);
      
      // Apply branch filter for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranchCodes.length > 0) {
        requestsQuery = requestsQuery.in('branch_code', allowedBranchCodes);
      }
      
      const { data: requestsData, error: requestsError } = await requestsQuery;
      
      console.log('Requests data:', requestsData);
      console.log('Requests error:', requestsError);
      
      // Fetch expenses data
      const { data: expensesData, error: expensesError } = await supabase
        .from('petty_cash_expenses')
        .select('*');
      
      // Fetch categories separately
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id_category, category_name');
      
      console.log('Expenses data:', expensesData);
      console.log('Categories data:', categoriesData);
      console.log('Expenses error:', expensesError);
      
      // Fetch settlements data
      const { data: settlementsData, error: settlementsError } = await supabase
        .from('petty_cash_settlements')
        .select('*');
      
      console.log('Settlements data:', settlementsData);
      console.log('Settlements error:', settlementsError);
      
      // Calculate stats
      const totalRequests = requestsData?.length || 0;
      const pendingRequests = requestsData?.filter(r => r.status === 'pending').length || 0;
      const approvedRequests = requestsData?.filter(r => r.status === 'approved').length || 0;
      const totalExpenses = expensesData?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const pendingSettlements = settlementsData?.filter(s => s.status === 'pending').length || 0;
      // Calculate total balance with carried_balance for refill requests
      const totalRequestAmount = requestsData?.reduce((sum, r) => {
        return sum + r.amount + (r.carried_balance || 0);
      }, 0) || 0;
      const totalBalance = totalRequestAmount - totalExpenses;
      
      // Fetch summary data with branch filtering
      let summaryQuery = supabase
        .from('petty_cash_summary')
        .select('*')
        .order('request_date', { ascending: false });
      
      // Apply branch filter for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranchCodes.length > 0) {
        summaryQuery = summaryQuery.in('branch_code', allowedBranchCodes);
      }
      
      const { data: summaryData } = await summaryQuery;
      
      // Calculate branch balances - LATEST REQUEST PER BRANCH
      const branchMap = new Map();
      
      // Get latest UNSETTLED request per branch
      requestsData?.forEach(request => {
        const branchCode = request.branch_code;
        const branchName = request.branches?.nama_branch || branchCode;
        
        // Check if this request has completed settlement
        const hasCompletedSettlement = settlementsData?.some(s => 
          s.request_id === request.id && s.status === 'completed'
        );
        
        // Skip requests that are already settled
        if (hasCompletedSettlement) return;
        
        // Calculate total available amount (amount + carried_balance)
        const totalAvailable = request.amount + (request.carried_balance || 0);
        
        if (!branchMap.has(branchCode)) {
          branchMap.set(branchCode, {
            branch_code: branchCode,
            branch_name: branchName,
            latest_request: request,
            allocated_amount: totalAvailable,
            spent_amount: 0,
            pending_amount: request.status === 'pending' ? totalAvailable : 0,
            request_date: request.request_date
          });
        } else {
          // Update if this request is newer and not settled
          const existing = branchMap.get(branchCode);
          if (new Date(request.request_date) > new Date(existing.request_date)) {
            existing.latest_request = request;
            existing.allocated_amount = totalAvailable;
            existing.pending_amount = request.status === 'pending' ? totalAvailable : 0;
            existing.request_date = request.request_date;
          }
        }
      });
      
      // Add expenses only for latest UNSETTLED request per branch
      expensesData?.forEach(expense => {
        // Find request to get branch
        const request = requestsData?.find(r => r.id === expense.request_id);
        if (request) {
          // Check if this expense's request has completed settlement
          const hasCompletedSettlement = settlementsData?.some(s => 
            s.request_id === request.id && s.status === 'completed'
          );
          
          // Skip expenses from settled requests
          if (hasCompletedSettlement) return;
          
          const branchCode = request.branch_code;
          const branch = branchMap.get(branchCode);
          if (branch && branch.latest_request.id === expense.request_id) {
            branch.spent_amount += expense.amount;
          }
        }
      });
      
      // Convert to array and calculate status
      const branchBalances = Array.from(branchMap.values()).map(branch => {
        const current_balance = branch.allocated_amount - branch.spent_amount;
        const utilization = branch.allocated_amount > 0 ? (branch.spent_amount / branch.allocated_amount) * 100 : 0;
        
        let status: 'healthy' | 'low' | 'critical' = 'healthy';
        if (utilization > 80) status = 'critical';
        else if (utilization > 60) status = 'low';
        
        return {
          branch_code: branch.branch_code,
          branch_name: branch.branch_name,
          allocated_amount: branch.allocated_amount,
          spent_amount: branch.spent_amount,
          pending_amount: branch.pending_amount,
          current_balance,
          last_reload: branch.request_date,
          status,
          latest_request_number: branch.latest_request.request_number
        };
      });
      
      setData({
        totalBalance,
        totalRequests,
        pendingRequests,
        approvedRequests,
        totalExpenses,
        pendingSettlements,
        branchBalances,
        summaries: summaryData || [],
        expensesData: expensesData || undefined,
        requestsData: requestsData || undefined,
        categoriesData: categoriesData || undefined,
        settlementsData: settlementsData || undefined
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleReloadBalance = useCallback((branchCode: string) => {
    window.location.href = '/pettycash/request';
  }, []);

  const handleBranchSort = useCallback((field: string) => {
    setBranchSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleSummarySort = useCallback((field: string) => {
    setSummarySort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const getSortIcon = useCallback((field: string, currentSort: {field: string, direction: 'asc' | 'desc'}) => {
    if (currentSort.field !== field) return '↕';
    return currentSort.direction === 'asc' ? '↑' : '↓';
  }, []);

  const filteredBranches = useMemo(() => {
    return data.branchBalances
      .filter(branch => selectedBranch === 'all' || branch.branch_code === selectedBranch)
      .filter(branch => {
        const branchDate = new Date(branch.last_reload);
        const now = new Date();
        const daysAgo = parseInt(dateRange);
        const dateLimit = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return branchDate >= dateLimit;
      })
      .sort((a, b) => {
        const { field, direction } = branchSort;
        let aVal = a[field as keyof typeof a];
        let bVal = b[field as keyof typeof b];
        
        if (field === 'last_reload') {
          aVal = new Date(aVal as string).getTime();
          bVal = new Date(bVal as string).getTime();
        }
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        return direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      });
  }, [data.branchBalances, selectedBranch, dateRange, branchSort]);

  const filteredSummaries = useMemo(() => {
    return data.summaries
      .filter(summary => summaryBranchFilter === 'all' || summary.branch_code === summaryBranchFilter)
      .filter(summary => {
        if (summaryStatusFilter === 'all') return true;
        const settlement = data.settlementsData?.find(s => s.request_id === summary.id);
        const actualStatus = settlement ? settlement.status : summary.status;
        return actualStatus === summaryStatusFilter;
      })
      .filter(summary => {
        const requestDate = new Date(summary.request_date);
        const now = new Date();
        const daysAgo = parseInt(dateRange);
        const dateLimit = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return requestDate >= dateLimit;
      })
      .sort((a, b) => {
        const { field, direction } = summarySort;
        let aVal = a[field as keyof typeof a];
        let bVal = b[field as keyof typeof b];
        
        if (field === 'request_date') {
          aVal = new Date(aVal as string).getTime();
          bVal = new Date(bVal as string).getTime();
        }
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        return direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      });
  }, [data.summaries, summaryBranchFilter, summaryStatusFilter, dateRange, summarySort, data.settlementsData]);

  const MobileBranchCard = ({ branch }: { branch: BranchBalance }) => {
    const isExpanded = expandedBranches.has(branch.branch_code);
    const branchExpenses = data.expensesData?.filter(expense => {
      const request = data.requestsData?.find(r => r.id === expense.request_id);
      if (request?.branch_code !== branch.branch_code) return false;
      const hasCompletedSettlement = data.settlementsData?.some(s => 
        s.request_id === request.id && s.status === 'completed'
      );
      return !hasCompletedSettlement;
    }) || [];

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <button 
                onClick={() => {
                  const newExpanded = new Set(expandedBranches);
                  if (isExpanded) newExpanded.delete(branch.branch_code);
                  else newExpanded.add(branch.branch_code);
                  setExpandedBranches(newExpanded);
                }}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
              <span className="font-semibold text-sm">{branch.branch_name}</span>
            </div>
            <div className="text-xs text-gray-500 ml-4">{branch.branch_code}</div>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(branch.status)}`}>
            {branch.status === 'healthy' ? '✅' : branch.status === 'low' ? '⚠️' : '🚨'}
          </span>
        </div>

        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Current Balance</span>
            <span className="text-lg font-bold text-green-600">
              {formatCurrency(branch.current_balance)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                branch.status === 'healthy' ? 'bg-green-500' :
                branch.status === 'low' ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ 
                width: `${Math.min(100, (branch.spent_amount / branch.allocated_amount) * 100)}%` 
              }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
          <div className="text-center p-2 bg-blue-50 rounded">
            <p className="text-gray-600">Allocated</p>
            <p className="font-semibold">{formatCurrency(branch.allocated_amount)}</p>
          </div>
          <div className="text-center p-2 bg-red-50 rounded">
            <p className="text-gray-600">Spent</p>
            <p className="font-semibold">{formatCurrency(branch.spent_amount)}</p>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
          <span>Last Reload</span>
          <span>{new Date(branch.last_reload).toLocaleDateString('id-ID')}</span>
        </div>

        <a 
          href="/pettycash/expenses/create"
          className="w-full bg-green-600 text-white text-center py-2 rounded text-sm font-medium hover:bg-green-700 block"
        >
          ➕ Add Expense
        </a>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-2">Recent Expenses ({branchExpenses.length}):</p>
            {branchExpenses.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {branchExpenses.slice(0, 5).map(expense => {
                  const categoryData = data.categoriesData?.find(c => c.id_category === expense.category_id);
                  const expenseDate = new Date(expense.expense_date).toLocaleDateString('id-ID');
                  return (
                    <div key={expense.id} className="text-xs bg-gray-50 p-2 rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{categoryData?.category_name || 'Other'}</p>
                          <p className="text-gray-600">{expense.vendor_name || expense.description}</p>
                          <p className="text-gray-500">{expenseDate}</p>
                        </div>
                        <p className="font-semibold text-green-600 ml-2">
                          {formatCurrency(expense.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {branchExpenses.length > 5 && (
                  <p className="text-xs text-center text-gray-500">
                    +{branchExpenses.length - 5} more expenses
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center">No expenses yet</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const MobileSummaryCard = ({ item }: { item: PettyCashSummary }) => {
    const isExpanded = expandedSummaries.has(item.id);
    const settlement = data.settlementsData?.find(s => s.request_id === item.id);
    const actualStatus = settlement ? settlement.status : item.status;
    const requestExpenses = data.expensesData?.filter(expense => expense.request_id === item.id) || [];

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'approved': return 'bg-green-100 text-green-800';
        case 'rejected': return 'bg-red-100 text-red-800';
        case 'disbursed': return 'bg-blue-100 text-blue-800';
        case 'completed': return 'bg-purple-100 text-purple-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <button 
                onClick={() => {
                  const newExpanded = new Set(expandedSummaries);
                  if (isExpanded) newExpanded.delete(item.id);
                  else newExpanded.add(item.id);
                  setExpandedSummaries(newExpanded);
                }}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
              <span className="font-semibold text-blue-600 text-sm">{item.request_number}</span>
            </div>
            <div className="text-xs text-gray-500 ml-4">
              {new Date(item.request_date).toLocaleDateString('id-ID')}
            </div>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(actualStatus)}`}>
            {actualStatus.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-gray-500">Cabang</p>
            <p className="text-sm font-medium">{item.nama_branch}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Requester</p>
            <p className="text-sm font-medium">{item.requested_by_name}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-50 p-2 rounded text-center">
            <p className="text-xs text-gray-500">Requested</p>
            <p className="text-sm font-semibold">{formatCurrency(item.amount)}</p>
          </div>
          <div className="bg-gray-50 p-2 rounded text-center">
            <p className="text-xs text-gray-500">Expenses</p>
            <p className="text-sm font-semibold text-red-600">{formatCurrency(item.total_expenses)}</p>
          </div>
          <div className="bg-gray-50 p-2 rounded text-center">
            <p className="text-xs text-gray-500">Remaining</p>
            <p className={`text-sm font-semibold ${
              item.remaining_amount > 0 ? 'text-green-600' : 
              item.remaining_amount < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {formatCurrency(Math.abs(item.remaining_amount))}
            </p>
          </div>
        </div>

        <div className="mb-2">
          <p className="text-xs text-gray-500">Purpose</p>
          <p className="text-sm line-clamp-2">{item.purpose}</p>
        </div>

        {isExpanded && requestExpenses.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-2">Expenses ({requestExpenses.length}):</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {requestExpenses.map(expense => {
                const categoryData = data.categoriesData?.find(c => c.id_category === expense.category_id);
                const expenseDate = new Date(expense.expense_date).toLocaleDateString('id-ID');
                return (
                  <div key={expense.id} className="text-xs bg-gray-50 p-2 rounded">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{categoryData?.category_name || 'Other'}</p>
                        <p className="text-gray-600">{expense.vendor_name || expense.description}</p>
                        <p className="text-gray-500 text-xs">{expenseDate}</p>
                      </div>
                      <p className="font-semibold text-green-600 ml-2">
                        {formatCurrency(expense.amount)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-4 p-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Petty Cash Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Monitor petty cash semua cabang</p>
        </div>

        <div className="bg-white rounded-lg p-2 shadow-sm">
          <div className="flex border-b">
            <button
              className={`flex-1 py-2 text-sm font-medium ${
                activeTab === 'overview' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500'
              }`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium ${
                activeTab === 'branches' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500'
              }`}
              onClick={() => setActiveTab('branches')}
            >
              Cabang ({filteredBranches.length})
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium ${
                activeTab === 'summary' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500'
              }`}
              onClick={() => setActiveTab('summary')}
            >
              Summary ({filteredSummaries.length})
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <select 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="all">Semua Cabang</option>
              {data.branchBalances.map(branch => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="7">7 Hari</option>
              <option value="30">30 Hari</option>
              <option value="90">90 Hari</option>
            </select>
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-600">Total Balance</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(data.totalBalance)}</p>
                <p className="text-xs text-gray-500 mt-1">Saldo tersedia</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-lg font-bold text-blue-600">{data.totalRequests}</p>
                <p className="text-xs text-gray-500 mt-1">
                  <span className="text-yellow-600">{data.pendingRequests} pending</span>
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(data.totalExpenses)}</p>
                <p className="text-xs text-gray-500 mt-1">Pengeluaran</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-600">Pending Settlements</p>
                <p className="text-lg font-bold text-orange-600">{data.pendingSettlements}</p>
                <p className="text-xs text-gray-500 mt-1">Menunggu</p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h3 className="font-semibold text-sm mb-3">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Cabang Aktif</span>
                  <span className="font-semibold">{data.branchBalances.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cabang Sehat</span>
                  <span className="font-semibold text-green-600">
                    {data.branchBalances.filter(b => b.status === 'healthy').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cabang Kritis</span>
                  <span className="font-semibold text-red-600">
                    {data.branchBalances.filter(b => b.status === 'critical').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branches' && (
          <div>
            <div className="mb-3 flex justify-between items-center">
              <h3 className="font-semibold">Saldo Cabang</h3>
              <span className="text-sm text-gray-500">{filteredBranches.length} cabang</span>
            </div>
            <div className="space-y-3">
              {filteredBranches.map(branch => (
                <MobileBranchCard key={branch.branch_code} branch={branch} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div>
            <div className="mb-3 flex justify-between items-center">
              <h3 className="font-semibold">Summary Report</h3>
              <span className="text-sm text-gray-500">{filteredSummaries.length} requests</span>
            </div>
            <div className="space-y-3">
              {filteredSummaries.map(summary => (
                <MobileSummaryCard key={summary.id} item={summary} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Petty Cash Dashboard</h1>
          <p className="text-gray-600">Monitor dan kelola petty cash semua cabang</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="all">Semua Cabang</option>
            {data.branchBalances.map(branch => (
              <option key={branch.branch_code} value={branch.branch_code}>
                {branch.branch_name}
              </option>
            ))}
          </select>
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="7">7 Hari</option>
            <option value="30">30 Hari</option>
            <option value="90">90 Hari</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Balance</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalBalance)}</p>
            </div>

          </div>
          <p className="text-xs text-gray-500 mt-2">Saldo dari request terbaru per cabang</p>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-blue-600">{data.totalRequests}</p>
            </div>

          </div>
          <p className="text-xs text-gray-500 mt-2">
            <span className="text-yellow-600">{data.pendingRequests} pending</span> • 
            <span className="text-green-600 ml-1">{data.approvedRequests} approved</span>
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(data.totalExpenses)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Pengeluaran bulan ini</p>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Settlements</p>
              <p className="text-2xl font-bold text-orange-600">{data.pendingSettlements}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Menunggu penyelesaian</p>
        </div>
      </div>

      {/* Branch Balances */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Saldo Per Cabang</h2>
          <p className="text-sm text-gray-600">Monitor saldo dan status setiap cabang</p>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">
                    <button onClick={() => handleBranchSort('branch_name')} className="hover:text-blue-600">
                      Cabang <span className="text-xs">{getSortIcon('branch_name', branchSort)}</span>
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button onClick={() => handleBranchSort('current_balance')} className="hover:text-blue-600">
                      Saldo Saat Ini <span className="text-xs">{getSortIcon('current_balance', branchSort)}</span>
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button onClick={() => handleBranchSort('allocated_amount')} className="hover:text-blue-600">
                      Alokasi <span className="text-xs">{getSortIcon('allocated_amount', branchSort)}</span>
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button onClick={() => handleBranchSort('spent_amount')} className="hover:text-blue-600">
                      Terpakai <span className="text-xs">{getSortIcon('spent_amount', branchSort)}</span>
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button onClick={() => handleBranchSort('pending_amount')} className="hover:text-blue-600">
                      Pending <span className="text-xs">{getSortIcon('pending_amount', branchSort)}</span>
                    </button>
                  </th>
                  <th className="text-center py-3 px-2">
                    <button onClick={() => handleBranchSort('status')} className="hover:text-blue-600">
                      Status <span className="text-xs">{getSortIcon('status', branchSort)}</span>
                    </button>
                  </th>
                  <th className="text-center py-3 px-2">
                    <button onClick={() => handleBranchSort('last_reload')} className="hover:text-blue-600">
                      Last Reload <span className="text-xs">{getSortIcon('last_reload', branchSort)}</span>
                    </button>
                  </th>
                  <th className="text-center py-3 px-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBranches.map((branch) => {
                  const isExpanded = expandedBranches.has(branch.branch_code);
                  
                  const toggleExpanded = () => {
                    const newExpanded = new Set(expandedBranches);
                    if (isExpanded) {
                      newExpanded.delete(branch.branch_code);
                    } else {
                      newExpanded.add(branch.branch_code);
                    }
                    setExpandedBranches(newExpanded);
                  };
                  
                  // Get expenses for this branch (only from unsettled requests)
                  const branchExpenses = data.expensesData?.filter(expense => {
                    const request = data.requestsData?.find(r => r.id === expense.request_id);
                    if (request?.branch_code !== branch.branch_code) return false;
                    
                    // Check if this expense's request has completed settlement
                    const hasCompletedSettlement = data.settlementsData?.some(s => 
                      s.request_id === request.id && s.status === 'completed'
                    );
                    
                    // Only show expenses from unsettled requests
                    return !hasCompletedSettlement;
                  }) || [];
                  
                  return (
                    <React.Fragment key={branch.branch_code}>
                      <tr className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={toggleExpanded}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                            <div>
                              <div className="font-medium">{branch.branch_name}</div>
                              <div className="text-xs text-gray-500">{branch.branch_code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 font-semibold">
                          {formatCurrency(branch.current_balance)}
                        </td>
                        <td className="text-right py-3 px-2">
                          {formatCurrency(branch.allocated_amount)}
                        </td>
                        <td className="text-right py-3 px-2">
                          {formatCurrency(branch.spent_amount)}
                        </td>
                        <td className="text-right py-3 px-2">
                          {formatCurrency(branch.pending_amount)}
                        </td>
                        <td className="text-center py-3 px-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(branch.status)}`}>
                            {branch.status === 'healthy' ? '✅ Sehat' : 
                             branch.status === 'low' ? '⚠️ Rendah' : '🚨 Kritis'}
                          </span>
                        </td>
                        <td className="text-center py-3 px-2 text-xs">
                          {new Date(branch.last_reload).toLocaleDateString('id-ID')}
                        </td>
                        <td className="text-center py-3 px-2">
                          <a 
                            href="/pettycash/expenses/create"
                            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 inline-block"
                          >
                            ➕ Add Expense
                          </a>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="py-2 px-4 bg-gray-50">
                            <div className="text-sm">
                              <div className="font-medium mb-2">Expenses Detail ({branchExpenses.length}):</div>
                              {branchExpenses.length > 0 ? (
                                <div className="space-y-1">
                                  {branchExpenses.map(expense => {
                                    const categoryData = data.categoriesData?.find(c => c.id_category === expense.category_id);
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
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Summary Report ({data.summaries.length})</h2>
            <div className="flex gap-3">
              <select 
                value={summaryBranchFilter} 
                onChange={(e) => setSummaryBranchFilter(e.target.value)}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="all">Semua Cabang</option>
                {data.branchBalances.map(branch => (
                  <option key={branch.branch_code} value={branch.branch_code}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
              <select 
                value={summaryStatusFilter} 
                onChange={(e) => setSummaryStatusFilter(e.target.value)}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="disbursed">Disbursed</option>
                <option value="verified">Verified</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">
                  <button onClick={() => handleSummarySort('request_number')} className="hover:text-blue-600">
                    Request Info <span className="text-xs">{getSortIcon('request_number', summarySort)}</span>
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => handleSummarySort('nama_branch')} className="hover:text-blue-600">
                    Branch <span className="text-xs">{getSortIcon('nama_branch', summarySort)}</span>
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => handleSummarySort('requested_by_name')} className="hover:text-blue-600">
                    Requester <span className="text-xs">{getSortIcon('requested_by_name', summarySort)}</span>
                  </button>
                </th>
                <th className="text-right py-3 px-4">
                  <button onClick={() => handleSummarySort('amount')} className="hover:text-blue-600">
                    Requested <span className="text-xs">{getSortIcon('amount', summarySort)}</span>
                  </button>
                </th>
                <th className="text-right py-3 px-4">
                  <button onClick={() => handleSummarySort('total_expenses')} className="hover:text-blue-600">
                    Expenses <span className="text-xs">{getSortIcon('total_expenses', summarySort)}</span>
                  </button>
                </th>
                <th className="text-right py-3 px-4">
                  <button onClick={() => handleSummarySort('remaining_amount')} className="hover:text-blue-600">
                    Remaining <span className="text-xs">{getSortIcon('remaining_amount', summarySort)}</span>
                  </button>
                </th>
                <th className="text-center py-3 px-4">
                  <button onClick={() => handleSummarySort('status')} className="hover:text-blue-600">
                    Status <span className="text-xs">{getSortIcon('status', summarySort)}</span>
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => handleSummarySort('purpose')} className="hover:text-blue-600">
                    Purpose <span className="text-xs">{getSortIcon('purpose', summarySort)}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.map((summary) => {
                const isExpanded = expandedSummaries.has(summary.id);
                
                const toggleExpanded = () => {
                  const newExpanded = new Set(expandedSummaries);
                  if (isExpanded) {
                    newExpanded.delete(summary.id);
                  } else {
                    newExpanded.add(summary.id);
                  }
                  setExpandedSummaries(newExpanded);
                };
                
                // Get expenses for this request
                const requestExpenses = data.expensesData?.filter(expense => expense.request_id === summary.id) || [];
                
                // Get settlement status for this request
                const settlement = data.settlementsData?.find(s => s.request_id === summary.id);
                const actualStatus = settlement ? settlement.status : summary.status;
                
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'pending': return 'text-yellow-600';
                    case 'approved': return 'text-green-600';
                    case 'rejected': return 'text-red-600';
                    case 'disbursed': return 'text-blue-600';
                    case 'verified': return 'text-blue-600';
                    case 'completed': return 'text-purple-600';
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
                    case 'verified': return '🔍';
                    case 'completed': return '🏁';
                    case 'settled': return '🏁';
                    default: return '📋';
                  }
                };
                
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
                            <div className="text-xs text-gray-500">{new Date(summary.request_date).toLocaleDateString('id-ID')}</div>
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
                          {summary.remaining_amount < 0 ? '-' : ''}{formatCurrency(Math.abs(summary.remaining_amount))}
                          {summary.remaining_amount < 0 && ' (Over)'}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`text-xs font-medium ${getStatusColor(actualStatus)}`}>
                          {getStatusIcon(actualStatus)} {actualStatus.toUpperCase()}
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
                                  const categoryData = data.categoriesData?.find(c => c.id_category === expense.category_id);
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
      </div>
    </div>
  );
}

export default function PettyCashDashboardPage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <PettyCashDashboardContent />
      </Layout>
    </PageAccessControl>
  );
}