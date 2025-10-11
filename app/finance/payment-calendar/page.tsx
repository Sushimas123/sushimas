"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Calendar, Clock, CheckCircle, X, DollarSign, Filter, ChevronDown, ChevronUp } from 'lucide-react'
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
      
      // Bulk fetch all related data in parallel
      const [poItemsResult, paymentsResult, poDataResult] = await Promise.all([
        supabase
          .from('po_items')
          .select(`
            po_id,
            qty,
            harga,
            actual_price,
            received_qty,
            product_id,
            nama_product!inner(
              harga
            )
          `)
          .in('po_id', poIds),
        supabase
          .from('po_payments')
          .select('po_id, payment_amount, payment_date')
          .in('po_id', poIds),
        supabase
          .from('purchase_orders')
          .select('id, bulk_payment_ref, total_tagih, approval_status, approved_at')
          .in('id', poIds)
      ])
      
      // Create lookup maps for O(1) access
      const itemsMap = new Map<number, any[]>()
      const paymentsMap = new Map<number, any[]>()
      const poDataMap = new Map<number, any>()
      
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
      
      // Transform data efficiently
      const correctedData = (financeData || []).map((item: any) => {
        const items = itemsMap.get(item.id) || []
        const payments = paymentsMap.get(item.id) || []
        const poData = poDataMap.get(item.id)
        
        // Calculate corrected total - Fixed untuk handle null values
        let correctedTotal = 0
        items.forEach(poItem => {
          const actualPrice = poItem.actual_price || 0
          const originalPrice = poItem.harga || 0
          const receivedQty = poItem.received_qty || 0
          const originalQty = poItem.qty || 0
          const productHarga = (poItem.nama_product as any)?.harga || 0
          
          if (actualPrice > 0 && receivedQty > 0) {
            correctedTotal += receivedQty * actualPrice
          } else if (originalPrice > 0 && originalQty > 0) {
            correctedTotal += originalQty * originalPrice
          } else if (productHarga > 0 && originalQty > 0) {
            correctedTotal += originalQty * productHarga
          }
        })
        
        // Fallback: jika correctedTotal masih 0, gunakan total dari finance_dashboard_view
        if (correctedTotal === 0 && item.total_po) {
          correctedTotal = item.total_po
        }
        
        // Debug logging untuk troubleshoot
        if (correctedTotal === 0) {
          console.log(`Payment Calendar - PO ${item.po_number} has 0 total:`, {
            itemsCount: items.length,
            items: items.map(i => ({
              actual_price: i.actual_price,
              harga: i.harga,
              received_qty: i.received_qty,
              qty: i.qty,
              product_harga: (i.nama_product as any)?.harga
            })),
            originalTotal: item.total_po
          })
        }
        
        const totalPaid = payments.reduce((sum, payment) => sum + payment.payment_amount, 0)
        const totalTagih = poData?.total_tagih || 0
        
        // Calculate amounts
        const basisAmount = totalTagih > 0 ? totalTagih : correctedTotal
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
          total_po: correctedTotal,
          total_paid: displayTotalPaid,
          sisa_bayar: sisaBayar,
          status_payment: calculatedStatus,
          status,
          total_tagih: totalTagih,
          approval_status: poData?.approval_status,
          approved_at: poData?.approved_at
        }
      })
      
      // Filter data yang sudah sampai
      const goodsArrivedData = correctedData.filter((item: any) => item.tanggal_barang_sampai)
      
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
        Due: {payment.tanggal_jatuh_tempo ? new Date(payment.tanggal_jatuh_tempo).toLocaleDateString('id-ID') : 'TBD'}
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
  statusCounts,
  isOpen,
  onClose 
}: {
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  statusCounts: any;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Filter Status</h3>
          <button onClick={onClose} className="p-1">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-2">
          {[
            { key: 'all', label: 'All Status', color: 'gray' },
            { key: 'need_submit', label: 'Need Submit', color: 'pink' },
            { key: 'need_approve', label: 'Need Approve', color: 'purple' },
            { key: 'need_payment', label: 'Need Payment', color: 'blue' },
            { key: 'paid', label: 'Paid', color: 'green' }
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => {
                setStatusFilter(key)
                onClose()
              }}
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
    </div>
  )
}

export default function PaymentCalendar() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedPO, setSelectedPO] = useState<ScheduledPayment | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const itemsPerPage = 20

  const { payments, allPayments, loading, error, refetch } = useScheduledPayments(statusFilter)

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

          {/* Mobile Filter Button */}
          {isMobile && (
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="w-full mb-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center gap-2"
            >
              <Filter size={16} />
              Filter Status ({statusCounts[statusFilter as keyof typeof statusCounts]})
            </button>
          )}

          {/* Desktop Filters */}
          {!isMobile && (
            <div className="bg-white p-4 rounded-lg shadow border mb-6">
              <div className="flex gap-2 flex-wrap">
                {Object.entries(statusCounts).map(([key, count]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setStatusFilter(key)
                      setCurrentPage(1)
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      statusFilter === key 
                        ? key === 'all' ? 'bg-gray-800 text-white' 
                          : key === 'need_submit' ? 'bg-pink-600 text-white'
                          : key === 'need_approve' ? 'bg-purple-600 text-white'
                          : key === 'need_payment' ? 'bg-blue-600 text-white'
                          : 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {key.replace('_', ' ').toUpperCase()} ({count})
                  </button>
                ))}
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
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        { key: 'tanggal_jatuh_tempo', label: 'Due Date' },
                        { key: 'nama_supplier', label: 'Supplier' },
                        { key: 'nama_branch', label: 'Branch' },
                        { key: 'total_po', label: 'Total PO', align: 'right' },
                        { key: 'sisa_bayar', label: 'Outstanding', align: 'right' },
                        { key: 'status', label: 'Status', align: 'center' }
                      ].map(({ key, label, align = 'left' }) => (
                        <th 
                          key={key}
                          className={`px-6 py-3 text-${align} text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100`}
                          onClick={() => handleSort(key)}
                        >
                          <div className="flex items-center gap-1">
                            {label}
                            {sortField === key && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                          </div>
                        </th>
                      ))}
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedPayments.map(payment => {
                      const isOverdue = payment.tanggal_jatuh_tempo && 
                        payment.tanggal_jatuh_tempo < new Date().toISOString().split('T')[0] && 
                        payment.status !== 'paid'
                      
                      return (
                        <tr key={payment.id} className={isOverdue ? 'bg-red-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.tanggal_jatuh_tempo ? new Date(payment.tanggal_jatuh_tempo).toLocaleDateString('id-ID') : 'TBD'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div>
                              <p className="font-medium">{payment.nama_supplier}</p>
                              <a 
                                href={`/purchaseorder/received-preview?id=${payment.id}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {payment.po_number}
                              </a>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {payment.nama_branch}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(payment.total_po)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(payment.sisa_bayar)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              payment.status === 'need_submit' ? 'bg-pink-100 text-pink-800' :
                              payment.status === 'need_approve' ? 'bg-purple-100 text-purple-800' :
                              payment.status === 'need_payment' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {payment.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex justify-center gap-1">
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