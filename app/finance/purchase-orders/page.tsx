"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { DollarSign, FileText, AlertTriangle, TrendingUp, Search, Plus, Filter, X, ChevronDown, ChevronRight, Calendar, Building, User, CreditCard, Clock, CheckCircle, AlertCircle, Edit, ChevronUp } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import PaymentModal from './PaymentModal'

interface FinanceData {
  id: number
  po_number: string
  po_date: string
  nama_supplier: string
  nama_branch: string
  total_po: number
  total_paid: number
  sisa_bayar: number
  status_payment: string
  is_overdue: boolean
  days_overdue: number
  tanggal_jatuh_tempo: string
  last_payment_date: string
}

export default function FinancePurchaseOrders() {
  const [data, setData] = useState<FinanceData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPO, setSelectedPO] = useState<FinanceData | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [expandedRows, setExpandedRows] = useState<number[]>([])
  const [rowDetails, setRowDetails] = useState<Record<number, any>>({})
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [notesState, setNotesState] = useState<Record<number, string>>({})
  
  // Filter states
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    supplier: '',
    branch: '',
    poStatus: '',
    paymentStatus: '',
    dueDate: '',
    goodsReceived: ''
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchFinanceData()
    fetchSuppliers()
    fetchBranches()
  }, [])

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('id_supplier, nama_supplier').order('nama_supplier')
    setSuppliers(data || [])
  }

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('id_branch, nama_branch').order('nama_branch')
    setBranches(data || [])
  }

  const fetchRowDetails = async (id: number) => {
    try {
      // Fetch payment history
      const { data: payments } = await supabase
        .from('po_payments')
        .select('*')
        .eq('po_id', id)
        .order('payment_date', { ascending: false })
      
      // Fetch items
      const { data: items } = await supabase
        .from('po_items')
        .select('*')
        .eq('po_id', id)
      
      setRowDetails(prev => ({
        ...prev,
        [id]: { payments, items }
      }))
    } catch (error) {
      console.error('Error fetching row details:', error)
    }
  }

  const toggleRowExpansion = async (id: number) => {
    if (expandedRows.includes(id)) {
      setExpandedRows(expandedRows.filter(rowId => rowId !== id))
    } else {
      setExpandedRows([...expandedRows, id])
      if (!rowDetails[id]) {
        await fetchRowDetails(id)
      }
    }
  }

  const fetchFinanceData = async () => {
    try {
      let query = supabase
        .from('finance_dashboard_view')
        .select('*')
        .order('po_date', { ascending: false })

      // Apply filters
      if (filters.dateFrom) query = query.gte('po_date', filters.dateFrom)
      if (filters.dateTo) query = query.lte('po_date', filters.dateTo)
      if (filters.supplier) query = query.eq('supplier_id', filters.supplier)
      if (filters.branch) query = query.eq('cabang_id', filters.branch)
      if (filters.poStatus) query = query.eq('po_status', filters.poStatus)
      if (filters.dueDate === 'overdue') query = query.eq('is_overdue', true)
      if (filters.dueDate === 'due_soon') query = query.lte('days_until_due', 7).gt('days_until_due', 0)
      if (filters.goodsReceived === 'received') query = query.not('tanggal_barang_sampai', 'is', null)
      if (filters.goodsReceived === 'not_received') query = query.is('tanggal_barang_sampai', null)

      const { data: financeData, error } = await query

      if (error) throw error
      
      // Recalculate totals and get payment dates
      const correctedData = await Promise.all(
        (financeData || []).map(async (item: any) => {
          // Get actual items data
          const { data: items } = await supabase
            .from('po_items')
            .select('qty, harga, total, actual_price, received_qty, product_id')
            .eq('po_id', item.id)

          let correctedTotal = 0
          for (const poItem of items || []) {
            if (poItem.total) {
              correctedTotal += poItem.total
            } else if (poItem.actual_price && poItem.received_qty) {
              correctedTotal += poItem.received_qty * poItem.actual_price
            } else if (poItem.harga) {
              correctedTotal += poItem.qty * poItem.harga
            } else {
              const { data: product } = await supabase
                .from('nama_product')
                .select('harga')
                .eq('id_product', poItem.product_id)
                .single()
              correctedTotal += poItem.qty * (product?.harga || 0)
            }
          }

          // Get latest payment info
          const { data: latestPayment } = await supabase
            .from('po_payments')
            .select('payment_date, payment_via, payment_method')
            .eq('po_id', item.id)
            .order('payment_date', { ascending: false })
            .limit(1)
            .single()

          // Get branch badan
          const { data: branchData } = await supabase
            .from('branches')
            .select('badan')
            .eq('id_branch', item.cabang_id)
            .single()

          const calculatedStatus = item.total_paid === 0 ? 'unpaid' : item.total_paid >= correctedTotal ? 'paid' : 'partial'
          
          // Apply payment status filter
          if (filters.paymentStatus && calculatedStatus !== filters.paymentStatus) {
            return null
          }

          return {
            ...item,
            total_po: correctedTotal,
            sisa_bayar: correctedTotal - item.total_paid,
            status_payment: calculatedStatus,
            dibayar_tanggal: latestPayment?.payment_date || null,
            payment_via: latestPayment?.payment_via || null,
            payment_method: latestPayment?.payment_method || null,
            badan: branchData?.badan || null
          }
        })
      )
      
      const filteredCorrectedData = correctedData.filter(item => item !== null)
      setData(filteredCorrectedData)

      // Initialize notes state from the data
      const newNotesState: Record<number, string> = {}
      filteredCorrectedData.forEach(item => {
        const defaultNotes = item.nama_branch === 'Sushimas Harapan Indah' ? 'Rek CV' : 'Rek PT'
        newNotesState[item.id] = (item as any).notes || defaultNotes
      })
      setNotesState(newNotesState)
    } catch (error) {
      console.error('Error fetching finance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const allFilteredData = data.filter(item => {
    const matchesSearch = item.po_number.toLowerCase().includes(search.toLowerCase()) ||
                         item.nama_supplier.toLowerCase().includes(search.toLowerCase()) ||
                         item.nama_branch.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  }).sort((a, b) => {
    if (!sortField) return 0
    
    let aVal = (a as any)[sortField]
    let bVal = (b as any)[sortField]
    
    if (sortField === 'po_date' || sortField === 'tanggal_jatuh_tempo' || sortField === 'dibayar_tanggal' || sortField === 'tanggal_barang_sampai') {
      aVal = aVal ? new Date(aVal).getTime() : 0
      bVal = bVal ? new Date(bVal).getTime() : 0
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const totalPages = Math.ceil(allFilteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const filteredData = allFilteredData.slice(startIndex, startIndex + itemsPerPage)

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      supplier: '',
      branch: '',
      poStatus: '',
      paymentStatus: '',
      dueDate: '',
      goodsReceived: ''
    })
  }

  const applyFilters = () => {
    setLoading(true)
    setCurrentPage(1)
    fetchFinanceData()
  }

  const summary = {
    totalPO: data.reduce((sum, item) => sum + item.total_po, 0),
    totalPaid: data.reduce((sum, item) => sum + item.total_paid, 0),
    outstanding: data.reduce((sum, item) => sum + item.sisa_bayar, 0),
    overdue: data.filter(item => item.is_overdue).reduce((sum, item) => sum + item.sisa_bayar, 0),
    totalOrders: data.length,
    overdueOrders: data.filter(item => item.is_overdue).length
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      case 'unpaid': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-4 w-4 mr-1" />
      case 'partial': return <Clock className="h-4 w-4 mr-1" />
      case 'unpaid': return <AlertCircle className="h-4 w-4 mr-1" />
      default: return <FileText className="h-4 w-4 mr-1" />
    }
  }

  const handlePaymentSuccess = () => {
    fetchFinanceData()
    setShowPaymentModal(false)
    setSelectedPO(null)
  }

  const handleNotesChange = async (poId: number, newValue: string) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ notes: newValue })
        .eq('id', poId)
      
      if (error) throw error
      
      // Update local state
      setNotesState(prev => ({
        ...prev,
        [poId]: newValue
      }))

      // Also update the data state to reflect the change
      setData(prev => prev.map(item => 
        item.id === poId ? { ...item, notes: newValue } : item
      ))
    } catch (error) {
      console.error('Error updating notes:', error)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageAccessControl pageName="finance">
        <div className="p-6 bg-gray-50 min-h-screen">
          {/* Summary Cards - Compact Version */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <div className="bg-white p-3 rounded-lg shadow border border-gray-200">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-xs text-gray-600">Total PO</p>
                  <p className="text-sm font-semibold">{formatCurrency(summary.totalPO)}</p>
                  <p className="text-xs text-gray-500">{summary.totalOrders} orders</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow border border-gray-200">
              <div className="flex items-center">                
                <div className="ml-3">
                  <p className="text-xs text-gray-600">Sudah Dibayar</p>
                  <p className="text-sm font-semibold">{formatCurrency(summary.totalPaid)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow border border-gray-200">
              <div className="flex items-center">                
                <div className="ml-3">
                  <p className="text-xs text-gray-600">Outstanding</p>
                  <p className="text-sm font-semibold">{formatCurrency(summary.outstanding)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow border border-gray-200">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-xs text-gray-600">Overdue</p>
                  <p className="text-sm font-semibold">{formatCurrency(summary.overdue)}</p>
                  <p className="text-xs text-gray-500">{summary.overdueOrders} orders</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow border border-gray-200 col-span-2">
              <div className="flex justify-between items-center h-full">
                <div>
                  <p className="text-xs text-gray-600">Last Updated</p>
                  <p className="text-sm font-semibold">{new Date().toLocaleDateString('id-ID', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                </div>
                <button 
                  onClick={fetchFinanceData}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                >
                  Refresh Data
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filter Section */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Cari PO number, supplier, atau cabang..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 text-sm"
                >
                  <Filter size={16} />
                  Filter
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dari Tanggal</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sampai Tanggal</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                    <select
                      value={filters.supplier}
                      onChange={(e) => setFilters({...filters, supplier: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Semua Supplier</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id_supplier} value={supplier.id_supplier}>
                          {supplier.nama_supplier}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                    <select
                      value={filters.branch}
                      onChange={(e) => setFilters({...filters, branch: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Semua Cabang</option>
                      {branches.map(branch => (
                        <option key={branch.id_branch} value={branch.id_branch}>
                          {branch.nama_branch}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PO Status</label>
                    <select
                      value={filters.poStatus}
                      onChange={(e) => setFilters({...filters, poStatus: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Semua Status PO</option>
                      <option value="Pending">Pending</option>
                      <option value="Sedang diproses">Sedang diproses</option>
                      <option value="Barang sampai">Barang sampai</option>
                      <option value="Dibatalkan">Dibatalkan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                    <select
                      value={filters.paymentStatus}
                      onChange={(e) => setFilters({...filters, paymentStatus: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Semua Payment Status</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jatuh Tempo</label>
                    <select
                      value={filters.dueDate}
                      onChange={(e) => setFilters({...filters, dueDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Semua</option>
                      <option value="overdue">Overdue</option>
                      <option value="due_soon">Jatuh Tempo 7 Hari</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barang Sampai</label>
                    <select
                      value={filters.goodsReceived}
                      onChange={(e) => setFilters({...filters, goodsReceived: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Semua</option>
                      <option value="received">Sudah Sampai</option>
                      <option value="not_received">Belum Sampai</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={applyFilters}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Terapkan Filter
                  </button>
                  <button
                    onClick={() => { clearFilters(); applyFilters(); }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 text-sm"
                  >
                    <X size={16} />
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="w-8 px-2 py-3"></th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('po_number')}>PO Info {sortField === 'po_number' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nama_supplier')}>Supplier {sortField === 'nama_supplier' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rekening</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nama_branch')}>Branch {sortField === 'nama_branch' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Notes</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Priority</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PO Status</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total_po')}>Total PO {sortField === 'total_po' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total_paid')}>Dibayar {sortField === 'total_paid' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('sisa_bayar')}>Sisa {sortField === 'sisa_bayar' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status_payment')}>Payment Status {sortField === 'status_payment' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Termin</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tanggal_jatuh_tempo')}>Jatuh Tempo {sortField === 'tanggal_jatuh_tempo' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('dibayar_tanggal')}>Dibayar Tanggal {sortField === 'dibayar_tanggal' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Payment Via</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Metode</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tanggal_barang_sampai')}>Barang Sampai {sortField === 'tanggal_barang_sampai' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((item) => {
                    const isExpanded = expandedRows.includes(item.id)
                    const rowClass = `hover:bg-gray-50 ${item.is_overdue ? 'bg-red-50' : ''} ${isExpanded ? 'bg-blue-50' : ''}`
                    
                    return (
                      <React.Fragment key={item.id}>
                        <tr className={rowClass}>
                          <td className="px-2 py-4 whitespace-nowrap">
                            <button 
                              onClick={() => toggleRowExpansion(item.id)}
                              className="text-gray-500 hover:text-blue-600"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div>
                              <a 
                                href={`/purchaseorder/received-preview?id=${item.id}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {item.po_number}
                              </a>
                              <div className="text-xs text-gray-500 flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {formatDate(item.po_date)}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <User className="h-4 w-4 text-gray-400 mr-1" />
                              {item.nama_supplier}
                            </div>
                            {(item as any).nama_penerima && (
                              <div className="text-xs text-gray-500 mt-1">{(item as any).nama_penerima}</div>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).nomor_rekening ? (
                              <div>
                                <div className="flex items-center font-medium">
                                  <CreditCard className="h-4 w-4 text-gray-400 mr-1" />
                                  {(item as any).bank_penerima}
                                </div>
                                <div className="text-xs text-gray-500">{(item as any).nomor_rekening}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <Building className="h-4 w-4 text-gray-400 mr-1" />
                              {item.nama_branch}
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <select 
                              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                              value={notesState[item.id] || 'Rek Michael'}
                              onChange={(e) => handleNotesChange(item.id, e.target.value)}
                            >
                              <option value="Rek Michael">Rek Michael</option>
                              <option value="Rek PT">Rek PT</option>
                              <option value="Rek CV">Rek CV</option>
                            </select>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              (item as any).priority === 'tinggi' ? 'bg-red-100 text-red-800' :
                              (item as any).priority === 'sedang' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {(item as any).priority || 'biasa'}
                            </span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              (item as any).po_status === 'Barang sampai' ? 'bg-green-100 text-green-800' :
                              (item as any).po_status === 'Sedang diproses' ? 'bg-blue-100 text-blue-800' :
                              (item as any).po_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {(item as any).po_status}
                            </span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(item.total_po)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.total_paid)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(item.sisa_bayar)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status_payment)}`}>
                              {getStatusIcon(item.status_payment)}
                              {item.status_payment.toUpperCase()}
                            </span>
                            {item.is_overdue && (
                              <div className="text-xs text-red-600 mt-1 flex items-center">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Overdue {item.days_overdue} hari
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).termin_days || 30} hari
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                              {formatDate(item.tanggal_jatuh_tempo)}
                            </div>
                            {item.last_payment_date && (
                              <div className="text-xs text-gray-500">
                                Last: {formatDate(item.last_payment_date)}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).dibayar_tanggal ? (
                              <div className="text-green-600 font-medium flex items-center">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {formatDate((item as any).dibayar_tanggal)}
                              </div>
                            ) : (
                              <span className="text-gray-400">Belum dibayar</span>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).payment_via || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).payment_method || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).tanggal_barang_sampai ? (
                              <div className="flex items-center">
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                                {formatDate((item as any).tanggal_barang_sampai)}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-center">
                            <div className="flex gap-1 justify-center">
                              {item.sisa_bayar > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedPO(item)
                                    setShowPaymentModal(true)
                                  }}
                                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Bayar
                                </button>
                              )}
                              {item.total_paid > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedPO(item)
                                    setShowPaymentModal(true)
                                  }}
                                  className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                  title="Edit Payment"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded Row with Details */}
                        {isExpanded && (
                          <tr className="bg-blue-50">
                            <td colSpan={19} className="px-4 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Payment History */}
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Riwayat Pembayaran
                                  </h3>
                                  {rowDetails[item.id]?.payments?.length > 0 ? (
                                    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {rowDetails[item.id].payments.map((payment: any) => (
                                            <tr key={payment.id}>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm">{formatDate(payment.payment_date)}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">{formatCurrency(payment.payment_amount)}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm">{payment.payment_method}</td>
                                              <td className="px-3 py-2 text-sm">{payment.notes || '-'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">Belum ada riwayat pembayaran</p>
                                  )}
                                </div>
                                
                                {/* Items List */}
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Daftar Item
                                  </h3>
                                  {rowDetails[item.id]?.items?.length > 0 ? (
                                    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Harga</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {rowDetails[item.id].items.map((poItem: any) => (
                                            <tr key={poItem.id}>
                                              <td className="px-3 py-2 text-sm">{poItem.product_name || `Product ${poItem.product_id}`}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm">
                                                {poItem.received_qty ? `${poItem.received_qty}/${poItem.qty}` : poItem.qty}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm">{formatCurrency(poItem.harga || poItem.actual_price || 0)}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">{formatCurrency(poItem.total || (poItem.qty * (poItem.harga || 0)))}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">Tidak ada item</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-lg shadow">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(startIndex + itemsPerPage, allFilteredData.length)}</span> of{' '}
                    <span className="font-medium">{allFilteredData.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === currentPage
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}

          {allFilteredData.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200 mt-4">
              <FileText className="h-12 w-12 mx-auto text-gray-400" />
              <p className="mt-2">Tidak ada data yang ditemukan</p>
              <p className="text-sm">Coba ubah filter pencarian Anda</p>
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedPO && (
          <PaymentModal
            po={selectedPO}
            onClose={() => {
              setShowPaymentModal(false)
              setSelectedPO(null)
            }}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </PageAccessControl>
    </Layout>
  )
}