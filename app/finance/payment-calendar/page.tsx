"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Calendar, Clock, CheckCircle, X, DollarSign, Filter, ChevronDown, ChevronUp, Search, Download } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import PaymentModal from '../purchase-orders/PaymentModal'

interface ScheduledPayment {
  id: number
  po_number: string
  po_date: string
  nama_supplier: string
  nama_branch: string
  total_po: number
  total_paid: number
  sisa_bayar: number
  status_payment: string
  tanggal_barang_sampai: string
  tanggal_jatuh_tempo: string
  status: string
  approval_status: string
  approved_at: string
  rejected_at?: string
  rejection_notes?: string
  notes?: string
}

// Custom hook untuk fetch data
const useScheduledPayments = (statusFilter: string) => {
  const [payments, setPayments] = useState<ScheduledPayment[]>([])
  const [allPayments, setAllPayments] = useState<ScheduledPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchScheduledPayments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: financeData, error: fetchError } = await supabase
        .from('finance_dashboard_view')
        .select('*')
        .order('po_date', { ascending: false })

      if (fetchError) throw fetchError
      
      // Optimized: Get all related data in bulk to avoid N+1 queries
      const poIds = (financeData || []).map(item => item.id)
      
      // Early return if no data
      if (poIds.length === 0) {
        setAllPayments([])
        setPayments([])
        return
      }
      
      // Split poIds into chunks to avoid Supabase limit
      const chunkSize = 100
      const poIdChunks = []
      for (let i = 0; i < poIds.length; i += chunkSize) {
        poIdChunks.push(poIds.slice(i, i + chunkSize))
      }
      
      // Bulk fetch all related data in parallel with chunking
      const [poItemsResults, paymentsResults, poDataResults, bulkPaymentsResults] = await Promise.all([
        Promise.all(poIdChunks.map(chunk => 
          supabase
            .from('po_items')
            .select('po_id, qty, harga, actual_price, received_qty, product_id')
            .in('po_id', chunk)
        )),
        Promise.all(poIdChunks.map(chunk => 
          supabase
            .from('po_payments')
            .select('po_id, payment_amount, payment_date, status')
            .in('po_id', chunk)
            .eq('status', 'completed')
        )),
        Promise.all(poIdChunks.map(chunk => 
          supabase
            .from('purchase_orders')
            .select('id, bulk_payment_ref, total_tagih, approval_status, approved_at, rejected_at, rejection_notes, notes')
            .in('id', chunk)
        )),
        supabase.from('bulk_payments').select('*')
      ])
      
      // Combine chunked results
      const poItemsResult = { data: poItemsResults.flatMap(r => r.data || []) }
      const paymentsResult = { data: paymentsResults.flatMap(r => r.data || []) }
      const poDataResult = { data: poDataResults.flatMap(r => r.data || []) }
      const bulkPaymentsResult = bulkPaymentsResults
      
      // Create lookup maps for O(1) access
      const itemsMap = new Map<number, any[]>()
      const paymentsMap = new Map<number, any[]>()
      const poDataMap = new Map<number, any>()
      const bulkPaymentsMap = new Map<string, any>()
      
      // Group items by PO ID
      poItemsResult.data?.forEach(item => {
        if (!itemsMap.has(item.po_id)) {
          itemsMap.set(item.po_id, [])
        }
        itemsMap.get(item.po_id)?.push(item)
      })
      
      // Group payments by PO ID
      paymentsResult.data?.forEach(payment => {
        if (!paymentsMap.has(payment.po_id)) {
          paymentsMap.set(payment.po_id, [])
        }
        paymentsMap.get(payment.po_id)?.push(payment)
      })
      
      // Create PO data map
      poDataResult.data?.forEach(po => {
        poDataMap.set(po.id, po)
      })
      
      // Create bulk payments map
      bulkPaymentsResult.data?.forEach(bp => {
        bulkPaymentsMap.set(bp.bulk_reference, bp)
      })
      
      // Transform data efficiently
      const correctedData = (financeData || []).map((item: any) => {
        const items = itemsMap.get(item.id) || []
        const payments = paymentsMap.get(item.id) || []
        const poData = poDataMap.get(item.id)
        const bulkPayment = poData?.bulk_payment_ref ? bulkPaymentsMap.get(poData.bulk_payment_ref) : null
        const latestPayment = payments[0] || null
        
        // Calculate corrected total using original PO price (harga)
        const correctedTotal = items.reduce((sum, poItem) => {
          const qty = parseFloat(poItem.qty) || 0
          const harga = parseFloat(poItem.harga) || 0
          return sum + (qty * harga)
        }, 0)
        
        // Use finance_dashboard_view total if no items or corrected total is 0
        const finalTotal = correctedTotal > 0 ? correctedTotal : (item.total_po || 0)
        
        const totalPaid = payments.reduce((sum, payment) => sum + payment.payment_amount, 0)
        const totalTagih = poData?.total_tagih || 0
        
        // Calculate amounts
        const basisAmount = totalTagih > 0 ? totalTagih : finalTotal
        let calculatedStatus
        let displayTotalPaid = totalPaid
        let sisaBayar = basisAmount - totalPaid
        
        if (poData?.bulk_payment_ref) {
          calculatedStatus = 'paid'
          displayTotalPaid = basisAmount
          sisaBayar = 0
        } else {
          calculatedStatus = totalPaid === 0 ? 'unpaid' : totalPaid >= basisAmount ? 'paid' : 'partial'
        }
        
        // Determine status
        let status = 'need_submit'
        if (calculatedStatus === 'paid') {
          status = 'paid'
        } else if (poData?.approval_status === 'rejected') {
          status = 'rejected'
        } else if (item.tanggal_barang_sampai && poData?.approval_status === 'pending') {
          status = 'need_approve'
        } else if (item.tanggal_barang_sampai && poData?.approval_status === 'approved' && calculatedStatus === 'unpaid') {
          status = 'need_payment'
        } else if (item.tanggal_barang_sampai && calculatedStatus === 'unpaid') {
          status = 'need_submit'
        } else if (item.tanggal_barang_sampai && calculatedStatus === 'partial') {
          status = 'need_payment'
        } else if (!item.tanggal_barang_sampai) {
          status = 'need_approve'
        }
        
        return {
          ...item,
          total_po: finalTotal,
          total_paid: displayTotalPaid,
          sisa_bayar: sisaBayar,
          status_payment: calculatedStatus,
          status,
          total_tagih: totalTagih,
          approval_status: poData?.approval_status,
          approved_at: poData?.approved_at,
          rejected_at: poData?.rejected_at,
          rejection_notes: poData?.rejection_notes,
          notes: poData?.notes,
          dibayar_tanggal: bulkPayment?.payment_date || latestPayment?.payment_date || null
        }
      })
      
      // Filter data yang sudah sampai atau sudah dibayar
      const goodsArrivedData = correctedData.filter((item: any) => item.tanggal_barang_sampai || item.dibayar_tanggal)
      
      setAllPayments(goodsArrivedData)
      
      // Apply filter
      const filteredData = statusFilter === 'all' 
        ? goodsArrivedData 
        : goodsArrivedData.filter((item: any) => item.status === statusFilter)
      
      setPayments(filteredData)
    } catch (err) {
      console.error('Error fetching scheduled payments:', err)
      setError('Failed to load payments data')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchScheduledPayments()
  }, [fetchScheduledPayments])

  return { payments, allPayments, loading, error, refetch: fetchScheduledPayments }
}

// Mobile Card Component
const MobilePaymentCard = ({ payment, onAction }: { 
  payment: ScheduledPayment; 
  onAction: (payment: ScheduledPayment) => void;
}) => {
  const [expanded, setExpanded] = useState(false)
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'need_submit': return 'bg-pink-100 text-pink-800 border-pink-200'
      case 'need_approve': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'need_payment': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'paid': return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const isOverdue = payment.tanggal_jatuh_tempo && 
    payment.tanggal_jatuh_tempo < new Date().toISOString().split('T')[0] && 
    payment.status !== 'paid'

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className={`bg-white rounded-lg shadow border p-4 mb-3 ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{payment.nama_supplier}</h3>
          <p className="text-sm text-gray-600">{payment.po_number}</p>
          <p className="text-xs text-gray-500">{payment.nama_branch}</p>
          <p className="text-xs text-gray-500">
            {(() => {
              const defaultNotes = payment.nama_branch === 'Sushimas Harapan Indah' ? 'Rek CV' : 'REK PT'
              return payment.notes || defaultNotes
            })()}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-2 p-1 text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <div className="flex justify-between items-center mb-2">
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(payment.status)}`}>
          {payment.status.replace('_', ' ').toUpperCase()}
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {formatCurrency(payment.sisa_bayar)}
        </span>
      </div>

      <div className="text-xs text-gray-500 mb-3">
        {payment.status === 'rejected' ? (
          <div>
            <div>Rejected: {payment.rejected_at ? new Date(payment.rejected_at).toLocaleDateString('id-ID') : 'N/A'}</div>
            {payment.rejection_notes && (
              <div className="text-red-600 mt-1">Reason: {payment.rejection_notes}</div>
            )}
          </div>
        ) : (
          <div>
            <div>Due: {payment.tanggal_jatuh_tempo ? new Date(payment.tanggal_jatuh_tempo).toLocaleDateString('id-ID') : 'TBD'}</div>
            {(payment as any).dibayar_tanggal && (
              <div>Paid: {new Date((payment as any).dibayar_tanggal).toLocaleDateString('id-ID')}</div>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t pt-3 mt-3">
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div>
              <span className="text-gray-600">Total PO:</span>
              <div className="font-medium">{formatCurrency(payment.total_po)}</div>
            </div>
            <div>
              <span className="text-gray-600">Paid:</span>
              <div className="font-medium">{formatCurrency(payment.total_paid)}</div>
            </div>
          </div>
          
          {payment.total_po !== payment.sisa_bayar && (
            <div className="text-xs text-gray-500 mb-3">
              Difference: {formatCurrency(payment.total_po - payment.sisa_bayar)}
            </div>
          )}

          <div className="flex gap-2">
            {payment.status === 'need_submit' && (
              <a
                href={`/finance/purchase-orders/submit-approval?id=${payment.id}`}
                className="flex-1 px-3 py-2 bg-pink-600 text-white text-sm rounded hover:bg-pink-700 text-center"
              >
                Submit
              </a>
            )}
            {payment.status === 'need_approve' && (
              <button
                onClick={() => onAction(payment)}
                className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                Approve
              </button>
            )}
            {payment.status === 'need_payment' && (
              <button
                onClick={() => onAction(payment)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Pay
              </button>
            )}
            {payment.status === 'rejected' && (payment as any).rejection_notes && (
              <button
                onClick={() => alert((payment as any).rejection_notes)}
                className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                View Notes
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Mobile Filters Component
const MobileFilters = ({ 
  statusFilter, 
  setStatusFilter, 
  branchFilter,
  setBranchFilter,
  notesFilter,
  setNotesFilter,
  branches,
  notes,
  statusCounts,
  isOpen,
  onClose 
}: {
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  branchFilter: string;
  setBranchFilter: (filter: string) => void;
  notesFilter: string;
  setNotesFilter: (filter: string) => void;
  branches: string[];
  notes: string[];
  statusCounts: any;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Filters</h3>
          <button onClick={onClose} className="p-1">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Status</h4>
            <div className="space-y-2">
              {[
                { key: 'all', label: 'All Status', color: 'gray' },
                { key: 'need_submit', label: 'Need Submit', color: 'pink' },
                { key: 'need_approve', label: 'Need Approve', color: 'purple' },
                { key: 'need_payment', label: 'Need Payment', color: 'blue' },
                { key: 'paid', label: 'Paid', color: 'green' },
                { key: 'rejected', label: 'Rejected', color: 'red' }
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`w-full text-left p-3 rounded-lg ${
                    statusFilter === key 
                      ? `bg-${color}-100 text-${color}-800 border-${color}-200 border-2`
                      : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{label}</span>
                    <span className="text-sm opacity-75">({statusCounts[key]})</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Branch</h4>
            <div className="space-y-2">
              <button
                onClick={() => setBranchFilter('all')}
                className={`w-full text-left p-3 rounded-lg ${
                  branchFilter === 'all' 
                    ? 'bg-blue-100 text-blue-800 border-blue-200 border-2'
                    : 'bg-gray-50 text-gray-700'
                }`}
              >
                All Branches
              </button>
              {branches.map(branch => (
                <button
                  key={branch}
                  onClick={() => setBranchFilter(branch)}
                  className={`w-full text-left p-3 rounded-lg ${
                    branchFilter === branch 
                      ? 'bg-blue-100 text-blue-800 border-blue-200 border-2'
                      : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  {branch}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Notes</h4>
            <div className="space-y-2">
              <button
                onClick={() => setNotesFilter('all')}
                className={`w-full text-left p-3 rounded-lg ${
                  notesFilter === 'all' 
                    ? 'bg-blue-100 text-blue-800 border-blue-200 border-2'
                    : 'bg-gray-50 text-gray-700'
                }`}
              >
                All Notes
              </button>
              {notes.map(note => (
                <button
                  key={note}
                  onClick={() => setNotesFilter(note || '')}
                  className={`w-full text-left p-3 rounded-lg ${
                    notesFilter === note 
                      ? 'bg-blue-100 text-blue-800 border-blue-200 border-2'
                      : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2 rounded-lg"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PaymentCalendar() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [notesFilter, setNotesFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedPO, setSelectedPO] = useState<ScheduledPayment | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const itemsPerPage = 20

  const { payments: allFilteredPayments, allPayments, loading, error, refetch } = useScheduledPayments(statusFilter)
  
  // Apply branch, notes, date and search filters
  const payments = useMemo(() => {
    let filtered = allFilteredPayments
    
    // Apply branch filter
    if (branchFilter !== 'all') {
      filtered = filtered.filter(p => p.nama_branch === branchFilter)
    }
    
    // Apply notes filter
    if (notesFilter !== 'all') {
      filtered = filtered.filter(p => {
        const defaultNotes = p.nama_branch === 'Sushimas Harapan Indah' ? 'Rek CV' : 'REK PT'
        const finalNotes = p.notes || defaultNotes
        return finalNotes.toLowerCase() === notesFilter.toLowerCase()
      })
    }
    
    // Apply date filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(p => {
        if (!(p as any).dibayar_tanggal) return false
        const paymentDate = (p as any).dibayar_tanggal
        if (dateFrom && paymentDate < dateFrom) return false
        if (dateTo && paymentDate > dateTo) return false
        return true
      })
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(p => {
        const defaultNotes = p.nama_branch === 'Sushimas Harapan Indah' ? 'Rek CV' : 'REK PT'
        const finalNotes = p.notes || defaultNotes
        return p.po_number.toLowerCase().includes(query) ||
               p.nama_supplier.toLowerCase().includes(query) ||
               p.nama_branch.toLowerCase().includes(query) ||
               finalNotes.toLowerCase().includes(query)
      })
    }
    
    return filtered
  }, [allFilteredPayments, branchFilter, notesFilter, searchQuery, dateFrom, dateTo])

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Get unique branches and notes for filter
  const branches = useMemo(() => {
    const uniqueBranches = [...new Set(allPayments.map(p => p.nama_branch))].filter(Boolean).sort()
    return uniqueBranches
  }, [allPayments])
  
  const notes = useMemo(() => {
    const notesMap = new Map<string, string>()
    
    allPayments.forEach(p => {
      const defaultNotes = p.nama_branch === 'Sushimas Harapan Indah' ? 'Rek CV' : 'REK PT'
      const finalNotes = p.notes || defaultNotes
      const lowerKey = finalNotes.toLowerCase()
      
      // Keep the first occurrence (case-wise) for display
      if (!notesMap.has(lowerKey)) {
        notesMap.set(lowerKey, finalNotes)
      }
    })
    
    return Array.from(notesMap.values()).sort()
  }, [allPayments])

  // Optimized calculations dengan useMemo
  const { todayPayments, upcomingPayments, overduePayments, totalScheduled, totalToday, statusCounts } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    
    const todayPayments = payments.filter(p => p.tanggal_jatuh_tempo === today)
    const upcomingPayments = payments.filter(p => p.tanggal_jatuh_tempo && p.tanggal_jatuh_tempo > today)
    const overduePayments = payments.filter(p => p.tanggal_jatuh_tempo && p.tanggal_jatuh_tempo < today && p.status !== 'paid')

    const totalScheduled = payments.reduce((sum, p) => sum + p.sisa_bayar, 0)
    const totalToday = todayPayments.reduce((sum, p) => sum + p.sisa_bayar, 0)

    const statusCounts = {
      all: allPayments.length,
      need_submit: allPayments.filter(p => p.status === 'need_submit').length,
      need_approve: allPayments.filter(p => p.status === 'need_approve').length,
      need_payment: allPayments.filter(p => p.status === 'need_payment').length,
      paid: allPayments.filter(p => p.status === 'paid').length,
      rejected: allPayments.filter(p => p.status === 'rejected').length,
    }

    return { todayPayments, upcomingPayments, overduePayments, totalScheduled, totalToday, statusCounts }
  }, [payments, allPayments])

  // Optimized sorting dan pagination
  const { sortedPayments, paginatedPayments, totalPages } = useMemo(() => {
    const sorted = [...payments].sort((a, b) => {
      if (!sortField) return 0
      
      let aVal = (a as any)[sortField]
      let bVal = (b as any)[sortField]
      
      if (sortField.includes('tanggal') || sortField.includes('date')) {
        aVal = aVal ? new Date(aVal).getTime() : 0
        bVal = bVal ? new Date(bVal).getTime() : 0
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    const totalPages = Math.ceil(sorted.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const paginated = sorted.slice(startIndex, startIndex + itemsPerPage)

    return { sortedPayments: sorted, paginatedPayments: paginated, totalPages }
  }, [payments, sortField, sortDirection, currentPage, itemsPerPage])

  const handleSort = useCallback((field: string) => {
    setSortField(field)
    setSortDirection(prev => prev === 'asc' && sortField === field ? 'desc' : 'asc')
    setCurrentPage(1) // Reset ke page 1 saat sorting
  }, [sortField])

  const handlePaymentAction = useCallback(async (payment: ScheduledPayment) => {
    if (payment.status === 'need_approve') {
      if (!confirm(`Yakin ingin approve PO ${payment.po_number} dari ${payment.nama_supplier}?`)) return
      try {
        const { error } = await supabase
          .from('purchase_orders')
          .update({ 
            approval_status: 'approved',
            approved_at: new Date().toISOString()
          })
          .eq('id', payment.id)
        if (error) throw error
        await refetch()
      } catch (error) {
        console.error('Error approving:', error)
        alert('Gagal approve PO')
      }
    } else if (payment.status === 'need_payment') {
      setSelectedPO(payment)
      setShowPaymentModal(true)
    }
  }, [refetch])

  const handlePaymentSuccess = useCallback(() => {
    refetch()
    setShowPaymentModal(false)
    setSelectedPO(null)
  }, [refetch])

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }, [])

  const exportToExcel = useCallback(async () => {
    try {
      const XLSX = await import('xlsx')
      
      const exportData = sortedPayments.map(payment => {
        const defaultNotes = payment.nama_branch === 'Sushimas Harapan Indah' ? 'Rek CV' : 'REK PT'
        const finalNotes = payment.notes || defaultNotes
        
        return {
          'PO Number': payment.po_number,
          'Supplier': payment.nama_supplier,
          'Branch': payment.nama_branch,
          'Notes': finalNotes,
          'Due Date': payment.tanggal_jatuh_tempo ? new Date(payment.tanggal_jatuh_tempo).toLocaleDateString('id-ID') : 'TBD',
          'Payment Date': (payment as any).dibayar_tanggal ? new Date((payment as any).dibayar_tanggal).toLocaleDateString('id-ID') : '-',
          'Total PO': payment.total_po,
          'Total Paid': payment.total_paid,
          'Outstanding': payment.sisa_bayar,
          'Status': payment.status.toUpperCase(),
          'Approval Status': payment.approval_status || '-',
          'Approved At': payment.approved_at ? new Date(payment.approved_at).toLocaleDateString('id-ID') : '-',
          'Rejected At': payment.rejected_at ? new Date(payment.rejected_at).toLocaleDateString('id-ID') : '-',
          'Rejection Notes': payment.rejection_notes || '-'
        }
      })
      
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Calendar')
      
      // Generate filename with current filters
      const filterSuffix = [
        statusFilter !== 'all' ? statusFilter : null,
        branchFilter !== 'all' ? branchFilter.replace(/\s+/g, '-') : null,
        notesFilter !== 'all' ? notesFilter.replace(/\s+/g, '-') : null,
        dateFrom || dateTo ? `${dateFrom || 'start'}-to-${dateTo || 'end'}` : null
      ].filter(Boolean).join('_')
      
      const filename = `payment-calendar${filterSuffix ? `_${filterSuffix}` : ''}_${new Date().toISOString().split('T')[0]}.xlsx`
      
      XLSX.writeFile(workbook, filename)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Gagal export file. Pastikan browser mendukung fitur export.')
    }
  }, [sortedPayments, statusFilter, branchFilter, notesFilter, dateFrom, dateTo])

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-red-600 text-center">
            <p>{error}</p>
            <button 
              onClick={() => refetch()}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageAccessControl pageName="finance">
        <div className="p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Payment Recap</h1>
          </div>

          {/* Summary Cards - Responsive */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="bg-white p-3 md:p-4 rounded-lg shadow border">
              <p className="text-xs md:text-sm text-gray-600">Total Scheduled</p>
              <p className="text-base md:text-lg font-semibold">{formatCurrency(totalScheduled)}</p>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-lg shadow border">
              <p className="text-xs md:text-sm text-gray-600">Today's Payments</p>
              <p className="text-base md:text-lg font-semibold">{formatCurrency(totalToday)}</p>
              <p className="text-xs text-gray-500">{todayPayments.length} payments</p>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-lg shadow border">
              <p className="text-xs md:text-sm text-gray-600">Upcoming</p>
              <p className="text-base md:text-lg font-semibold">{upcomingPayments.length}</p>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-lg shadow border">
              <p className="text-xs md:text-sm text-gray-600">Overdue</p>
              <p className="text-base md:text-lg font-semibold">{overduePayments.length}</p>
            </div>
          </div>

          {/* Search Bar and Date Filter */}
          <div className="bg-white p-4 rounded-lg shadow border mb-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by PO number, supplier, or branch..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setDateFrom('')
                        setDateTo('')
                        setCurrentPage(1)
                      }}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  </div>
                )}
                <div className="flex items-end">
                  <button
                    onClick={exportToExcel}
                    className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm"
                  >
                    <Download size={16} />
                    Export Excel
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Filter Button */}
          {isMobile && (
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="w-full mb-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center gap-2"
            >
              <Filter size={16} />
              Filters ({statusCounts[statusFilter as keyof typeof statusCounts]}{branchFilter !== 'all' ? `, ${branchFilter}` : ''}{notesFilter !== 'all' ? `, ${notesFilter}` : ''})
            </button>
          )}

          {/* Desktop Filters */}
          {!isMobile && (
            <div className="bg-white p-4 rounded-lg shadow border mb-6">
              <div className="flex gap-6 items-start">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(statusCounts).map(([key, count]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setStatusFilter(key)
                          setCurrentPage(1)
                        }}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                          statusFilter === key 
                            ? key === 'all' ? 'bg-gray-800 text-white' 
                              : key === 'need_submit' ? 'bg-pink-600 text-white'
                              : key === 'need_approve' ? 'bg-purple-600 text-white'
                              : key === 'need_payment' ? 'bg-blue-600 text-white'
                              : key === 'paid' ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {key.replace('_', ' ').toUpperCase()} ({count})
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setBranchFilter('all')
                        setCurrentPage(1)
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                        branchFilter === 'all' 
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All Branches
                    </button>
                    {branches.map(branch => (
                      <button
                        key={branch}
                        onClick={() => {
                          setBranchFilter(branch)
                          setCurrentPage(1)
                        }}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                          branchFilter === branch 
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {branch}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setNotesFilter('all')
                        setCurrentPage(1)
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                        notesFilter === 'all' 
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All Notes
                    </button>
                    {notes.map(note => (
                      <button
                        key={note}
                        onClick={() => {
                          setNotesFilter(note || '')
                          setCurrentPage(1)
                        }}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                          notesFilter === note 
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {note}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Today's Payments */}
          {todayPayments.length > 0 && (
            <div className="bg-white rounded-lg shadow border mb-6">
              <div className="px-4 md:px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Today's Payments</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {todayPayments.map(payment => (
                  <div key={payment.id} className="p-4 md:p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-base md:text-lg font-medium text-gray-900">{payment.nama_supplier}</h3>
                        <p className="text-sm text-gray-600">{payment.po_number}</p>
                        <p className="text-sm text-gray-500">{payment.nama_branch}</p>
                        <p className="text-base md:text-lg font-semibold text-gray-900 mt-2">
                          {formatCurrency(payment.sisa_bayar)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Due: {payment.tanggal_jatuh_tempo ? new Date(payment.tanggal_jatuh_tempo).toLocaleDateString('id-ID') : 'TBD'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-sm font-medium ${
                          payment.status === 'need_submit' ? 'text-pink-600' :
                          payment.status === 'need_approve' ? 'text-purple-600' :
                          payment.status === 'need_payment' ? 'text-blue-600' :
                          payment.status === 'rejected' ? 'text-red-600' :
                          'text-green-600'
                        }`}>
                          {payment.status.toUpperCase()}
                        </span>
                        <div className="flex gap-1">
                          {payment.status === 'need_submit' && (
                            <a
                              href={`/finance/purchase-orders/submit-approval?id=${payment.id}`}
                              className="px-3 py-1 bg-pink-600 text-white text-sm rounded hover:bg-pink-700"
                            >
                              Submit
                            </a>
                          )}
                          {(payment.status === 'need_approve' || payment.status === 'need_payment') && (
                            <button
                              onClick={() => handlePaymentAction(payment)}
                              className={`px-3 py-1 text-white text-sm rounded ${
                                payment.status === 'need_approve' 
                                  ? 'bg-purple-600 hover:bg-purple-700' 
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              {payment.status === 'need_approve' ? 'Approve' : 'Pay'}
                            </button>
                          )}
                          {payment.status === 'rejected' && (
                            <div className="text-xs text-red-600">
                              <div>Rejected: {payment.rejected_at ? new Date(payment.rejected_at).toLocaleDateString('id-ID') : 'N/A'}</div>
                              {payment.rejection_notes && (
                                <div className="mt-1">Reason: {payment.rejection_notes}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payments List */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 md:px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                All Scheduled Payments ({paginatedPayments.length} of {sortedPayments.length})
              </h2>
            </div>

            {/* Mobile View */}
            {isMobile ? (
              <div className="p-4">
                {paginatedPayments.map(payment => (
                  <MobilePaymentCard 
                    key={payment.id} 
                    payment={payment} 
                    onAction={handlePaymentAction}
                  />
                ))}
              </div>
            ) : (
              /* Desktop Table View */
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        { key: 'tanggal_jatuh_tempo', label: 'Due Date', width: 'w-20' },
                        { key: 'payment_date', label: 'Payment Date', width: 'w-20' },
                        { key: 'nama_supplier', label: 'Supplier', width: 'w-32' },
                        { key: 'nama_branch', label: 'Branch', width: 'w-24' },
                        { key: 'notes', label: 'Notes', width: 'w-16' },
                        { key: 'total_po', label: 'Total PO', align: 'right', width: 'w-20' },
                        { key: 'sisa_bayar', label: 'Outstanding', align: 'right', width: 'w-20' },
                        { key: 'status', label: 'Status', align: 'center', width: 'w-20' }
                      ].map(({ key, label, align = 'left', width }) => (
                        <th 
                          key={key}
                          className={`${width} px-2 py-2 text-${align} text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100`}
                          onClick={() => handleSort(key)}
                        >
                          <div className="flex items-center gap-1">
                            {label}
                            {sortField === key && (sortDirection === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                          </div>
                        </th>
                      ))}
                      <th className="w-16 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedPayments.map(payment => {
                      const isOverdue = payment.tanggal_jatuh_tempo && 
                        payment.tanggal_jatuh_tempo < new Date().toISOString().split('T')[0] && 
                        payment.status !== 'paid'
                      
                      return (
                        <tr key={payment.id} className={isOverdue ? 'bg-red-50' : ''}>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {payment.status === 'rejected' ? (
                              <div>
                                <div className="text-red-600">Rejected</div>
                                <div className="text-xs text-gray-500">
                                  {payment.rejected_at ? new Date(payment.rejected_at).toLocaleDateString('id-ID') : 'N/A'}
                                </div>
                              </div>
                            ) : (
                              payment.tanggal_jatuh_tempo ? new Date(payment.tanggal_jatuh_tempo).toLocaleDateString('id-ID') : 'TBD'
                            )}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {(payment as any).dibayar_tanggal ? (
                              new Date((payment as any).dibayar_tanggal).toLocaleDateString('id-ID')
                            ) : '-'}
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-900">
                            <div>
                              <p className="font-medium truncate">{payment.nama_supplier}</p>
                              <a 
                                href={`/purchaseorder/received-preview?id=${payment.id}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {payment.po_number}
                              </a>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-500 truncate">
                            {payment.nama_branch}
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-500 truncate">
                            {(() => {
                              const defaultNotes = payment.nama_branch === 'Sushimas Harapan Indah' ? 'Rek CV' : 'REK PT'
                              return payment.notes || defaultNotes
                            })()}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900 text-right">
                            {formatCurrency(payment.total_po)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900 text-right">
                            {formatCurrency(payment.sisa_bayar)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                              payment.status === 'need_submit' ? 'bg-pink-100 text-pink-800' :
                              payment.status === 'need_approve' ? 'bg-purple-100 text-purple-800' :
                              payment.status === 'need_payment' ? 'bg-blue-100 text-blue-800' :
                              payment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {payment.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            <div className="flex justify-center gap-1">
                              {payment.status === 'need_submit' && (
                                <a
                                  href={`/finance/purchase-orders/submit-approval?id=${payment.id}`}
                                  className="px-2 py-1 bg-pink-600 text-white text-xs rounded hover:bg-pink-700"
                                >
                                  Submit
                                </a>
                              )}
                              {(payment.status === 'need_approve' || payment.status === 'need_payment') && (
                                <button
                                  onClick={() => handlePaymentAction(payment)}
                                  className={`px-2 py-1 text-white text-xs rounded ${
                                    payment.status === 'need_approve' 
                                      ? 'bg-purple-600 hover:bg-purple-700' 
                                      : 'bg-blue-600 hover:bg-blue-700'
                                  }`}
                                >
                                  {payment.status === 'need_approve' ? 'Approve' : 'Pay'}
                                </button>
                              )}
                              {payment.status === 'rejected' && (payment as any).rejection_notes && (
                                <button
                                  onClick={() => alert((payment as any).rejection_notes)}
                                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                >
                                  View Notes
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:flex-1 sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, sortedPayments.length)}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedPayments.length)}</span> of{' '}
                    <span className="font-medium">{sortedPayments.length}</span> results
                  </p>
                  
                  <nav className="flex justify-center">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`relative inline-flex items-center px-3 py-2 border text-sm font-medium ${
                              pageNum === currentPage
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </nav>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Filters Modal */}
        <MobileFilters
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          branchFilter={branchFilter}
          setBranchFilter={setBranchFilter}
          notesFilter={notesFilter}
          setNotesFilter={setNotesFilter}
          branches={branches}
          notes={notes}
          statusCounts={statusCounts}
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
        />

        {/* Payment Modal */}
        {showPaymentModal && selectedPO && (
          <PaymentModal
            po={{
              id: selectedPO.id,
              po_number: selectedPO.po_number,
              nama_supplier: selectedPO.nama_supplier,
              total_po: selectedPO.total_po,
              total_paid: selectedPO.total_paid,
              sisa_bayar: selectedPO.sisa_bayar,
              total_tagih: (selectedPO as any).total_tagih || 0
            }}
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