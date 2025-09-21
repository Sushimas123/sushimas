"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Receipt, FileText, Search, Filter, X, Calendar, Building, User, CreditCard, Download, LinkIcon, Eye } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import { insertWithAudit, updateWithAudit, deleteWithAudit, logAuditTrail } from '@/src/utils/auditTrail';

interface BulkPayment {
  id: number
  bulk_reference: string
  total_amount: number
  payment_date: string
  payment_via: string
  payment_method: string
  notes: string
  status: string
  created_at: string
  purchase_orders: any[]
}

export default function BulkPaymentsPage() {
  const [bulkPayments, setBulkPayments] = useState<BulkPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showBulkPaymentDetails, setShowBulkPaymentDetails] = useState<BulkPayment | null>(null)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    paymentVia: '',
    paymentMethod: '',
    status: ''
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchBulkPayments()
  }, [filters])

  const fetchBulkPayments = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('bulk_payments')
        .select('*')
        .order('payment_date', { ascending: false })

      // Apply filters
      if (filters.dateFrom) query = query.gte('payment_date', filters.dateFrom)
      if (filters.dateTo) query = query.lte('payment_date', filters.dateTo)
      if (filters.paymentVia) query = query.ilike('payment_via', `%${filters.paymentVia}%`)
      if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
      if (filters.status) query = query.eq('status', filters.status)

      const { data: bulkPaymentsData, error: bulkError } = await query
      
      if (bulkError) throw bulkError
      
      // Get related POs for each bulk payment
      const formattedData = await Promise.all(
        (bulkPaymentsData || []).map(async (bulkPayment) => {
          const { data: relatedPOs } = await supabase
            .from('purchase_orders')
            .select('id, po_number, total_tagih, supplier_id')
            .eq('bulk_payment_ref', bulkPayment.bulk_reference)
          
          // Get supplier names for each PO
          const formattedPOs = await Promise.all(
            (relatedPOs || []).map(async (po) => {
              const { data: supplier } = await supabase
                .from('suppliers')
                .select('nama_supplier')
                .eq('id_supplier', po.supplier_id)
                .single()
              
              return {
                ...po,
                nama_supplier: supplier?.nama_supplier || 'Unknown Supplier'
              }
            })
          )
          
          return {
            ...bulkPayment,
            purchase_orders: formattedPOs
          }
        })
      )
      
      setBulkPayments(formattedData)
    } catch (error) {
      console.error('Error fetching bulk payments:', error)
      setBulkPayments([])
    } finally {
      setLoading(false)
    }
  }

  const filteredData = bulkPayments.filter(item => {
    const matchesSearch = item.bulk_reference.toLowerCase().includes(search.toLowerCase()) ||
                         item.payment_via.toLowerCase().includes(search.toLowerCase()) ||
                         item.notes?.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

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
      case 'completed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'reconciled': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const exportToXLSX = async () => {
    try {
      const XLSX = await import('xlsx')
      
      const worksheetData = filteredData.map(item => ({
        'Bulk Reference': item.bulk_reference,
        'Payment Date': formatDate(item.payment_date),
        'Total Amount': item.total_amount,
        'Payment Via': item.payment_via,
        'Payment Method': item.payment_method,
        'Status': item.status,
        'PO Count': item.purchase_orders.length,
        'Notes': item.notes || '',
        'Created At': formatDate(item.created_at)
      }))
      
      const worksheet = XLSX.utils.json_to_sheet(worksheetData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bulk Payments')
      
      XLSX.writeFile(workbook, `bulk-payments-${new Date().toISOString().split('T')[0]}.xlsx`)
      await logAuditTrail({ table_name: 'export', record_id: 0, action: 'EXPORT' })
    } catch (error) {
      console.error('Error exporting to XLSX:', error)
      alert('Gagal export file. Pastikan browser mendukung fitur export.')
    }
  }

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      paymentVia: '',
      paymentMethod: '',
      status: ''
    })
  }

  const summary = {
    totalPayments: filteredData.length,
    totalAmount: filteredData.reduce((sum, item) => sum + item.total_amount, 0),
    completedPayments: filteredData.filter(item => item.status === 'completed').length,
    pendingPayments: filteredData.filter(item => item.status === 'pending').length,
    reconciledPayments: filteredData.filter(item => item.status === 'reconciled').length
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


          {/* Search and Filter Section */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Cari bulk reference, payment via, atau notes..."
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
                <button
                  onClick={exportToXLSX}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm"
                >
                  <Download size={16} />
                  Export Excel
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Via</label>
                    <input
                      type="text"
                      value={filters.paymentVia}
                      onChange={(e) => setFilters({...filters, paymentVia: e.target.value})}
                      placeholder="e.g., BCA, Mandiri"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select
                      value={filters.paymentMethod}
                      onChange={(e) => setFilters({...filters, paymentMethod: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Semua Metode</option>
                      <option value="Transfer">Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Check">Check</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({...filters, status: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Semua Status</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="reconciled">Reconciled</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={fetchBulkPayments}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Terapkan Filter
                  </button>
                  <button
                    onClick={() => { clearFilters(); fetchBulkPayments(); }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 text-sm"
                  >
                    <X size={16} />
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bulk Payments Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bulk Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Via</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Count</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredData.map((bulkPayment) => (
                    <tr key={bulkPayment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-medium text-blue-600">
                        {bulkPayment.bulk_reference}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                          {formatDate(bulkPayment.payment_date)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {formatCurrency(bulkPayment.total_amount)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <div className="flex items-center">
                          <Building className="h-4 w-4 text-gray-400 mr-1" />
                          {bulkPayment.payment_via}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {bulkPayment.payment_method}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          {bulkPayment.purchase_orders.length} PO
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(bulkPayment.status)}`}>
                          {bulkPayment.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {bulkPayment.notes || '-'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => setShowBulkPaymentDetails(bulkPayment)}
                            className="inline-flex items-center px-2 py-1 text-xs text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Detail
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Yakin ingin menghapus bulk payment ${bulkPayment.bulk_reference}? PO akan dikembalikan ke status unpaid.`)) {
                                try {
                                  // Reset PO bulk_payment_ref and status
                                  const { error: updateError } = await updateWithAudit('purchase_orders', { 
                                      bulk_payment_ref: null,
                                      status_pembayaran: 'Unpaid'
                                    }, {'bulk_payment_ref': bulkPayment.bulk_reference})
                                  
                                  if (updateError) throw updateError
                                  
                                  // Delete bulk payment
                                  const { error: deleteError } = await supabase
                                    .from('bulk_payments')
                                    .delete()
                                    .eq('id', bulkPayment.id)
                                  
                                  if (deleteError) throw deleteError
                                  
                                  fetchBulkPayments()
                                  alert('Bulk payment berhasil dihapus')
                                } catch (error) {
                                  console.error('Error deleting bulk payment:', error)
                                  alert('Gagal menghapus bulk payment: ' + (error as Error).message)
                                }
                              }
                            }}
                            className="inline-flex items-center px-2 py-1 text-xs text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                            title="Cancel bulk payment"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredData.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200 mt-4">
              <Receipt className="h-12 w-12 mx-auto text-gray-400" />
              <p className="mt-2">Tidak ada bulk payments yang ditemukan</p>
              <p className="text-sm">Coba ubah filter pencarian Anda</p>
            </div>
          )}
        </div>

        {/* Bulk Payment Details Modal */}
        {showBulkPaymentDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Detail Pembayaran Bulk</h3>
                <button onClick={() => setShowBulkPaymentDetails(null)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Referensi</p>
                  <p className="font-medium">{showBulkPaymentDetails.bulk_reference}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tanggal Pembayaran</p>
                  <p className="font-medium">{formatDate(showBulkPaymentDetails.payment_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="font-medium">{formatCurrency(showBulkPaymentDetails.total_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Metode Pembayaran</p>
                  <p className="font-medium">{showBulkPaymentDetails.payment_method} via {showBulkPaymentDetails.payment_via}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(showBulkPaymentDetails.status)}`}>
                    {showBulkPaymentDetails.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created At</p>
                  <p className="font-medium">{formatDate(showBulkPaymentDetails.created_at)}</p>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600">Catatan</p>
                <p className="font-medium">{showBulkPaymentDetails.notes || '-'}</p>
              </div>
              
              <h4 className="font-medium mb-2">Purchase Orders yang termasuk:</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {showBulkPaymentDetails.purchase_orders.map((po: any) => (
                      <tr key={po.id}>
                        <td className="px-3 py-2 text-sm">
                          <a 
                            href={`/purchaseorder/received-preview?id=${po.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {po.po_number}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-sm">{po.nama_supplier}</td>
                        <td className="px-3 py-2 text-sm font-medium">{formatCurrency(po.total_tagih)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={() => setShowBulkPaymentDetails(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </PageAccessControl>
    </Layout>
  )
}