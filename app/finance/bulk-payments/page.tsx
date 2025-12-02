"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Receipt, FileText, Search, Filter, X, Calendar, Building, User, CreditCard, Download, LinkIcon, Eye, ChevronDown, ChevronUp, Menu, Plus } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

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
  const [expandedPayment, setExpandedPayment] = useState<number | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
      
      // Early return if no data
      if (!bulkPaymentsData || bulkPaymentsData.length === 0) {
        setBulkPayments([])
        return
      }
      
      // Optimized: Get all related data in bulk to avoid N+1 queries
      const bulkReferences = (bulkPaymentsData || []).map(bp => bp.bulk_reference)
      
      // Bulk fetch all POs
      const { data: allPOs } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total_tagih, supplier_id, bulk_payment_ref')
        .in('bulk_payment_ref', bulkReferences)
      
      // Get PO numbers to fetch invoice numbers from barang_masuk
      const poNumbers = allPOs?.map(po => po.po_number) || []
      const { data: barangMasukData } = await supabase
        .from('barang_masuk')
        .select('no_po, invoice_number')
        .in('no_po', poNumbers)
      
      // Create invoice lookup map
      const invoiceMap = new Map(barangMasukData?.map(bm => [bm.no_po, bm.invoice_number]) || [])
      
      // Get unique supplier IDs and fetch supplier data separately
      const supplierIds = [...new Set(allPOs?.map(po => po.supplier_id) || [])]
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id_supplier, nama_supplier')
        .in('id_supplier', supplierIds)
      
      // Create supplier lookup map
      const supplierMap = new Map(suppliers?.map(s => [s.id_supplier, s.nama_supplier]) || [])
      
      // Group POs by bulk_payment_ref for O(1) lookup
      const posMap = new Map<string, any[]>()
      allPOs?.forEach(po => {
        if (!posMap.has(po.bulk_payment_ref)) {
          posMap.set(po.bulk_payment_ref, [])
        }
        posMap.get(po.bulk_payment_ref)?.push({
          id: po.id,
          po_number: po.po_number,
          total_tagih: po.total_tagih,
          supplier_id: po.supplier_id,
          nama_supplier: supplierMap.get(po.supplier_id) || 'Unknown Supplier',
          invoice_number: invoiceMap.get(po.po_number) || null
        })
      })
      
      // Transform data efficiently
      const formattedData = (bulkPaymentsData || []).map(bulkPayment => ({
        ...bulkPayment,
        purchase_orders: posMap.get(bulkPayment.bulk_reference) || []
      }))
      
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

  const exportBulkPaymentPDF = async (bulkPayment: BulkPayment) => {
    try {
      const jsPDF = (await import('jspdf')).default
      const doc = new jsPDF()
      
      // Get company name from first PO's branch
      let companyName = 'PT. Suryamas Pratama'
      if (bulkPayment.purchase_orders.length > 0) {
        const firstPO = bulkPayment.purchase_orders[0]
        const { data: poData } = await supabase
          .from('purchase_orders')
          .select('cabang_id')
          .eq('id', firstPO.id)
          .single()
        
        if (poData?.cabang_id) {
          const { data: branchData } = await supabase
            .from('branches')
            .select('badan')
            .eq('id_branch', poData.cabang_id)
            .single()
          
          if (branchData?.badan) {
            companyName = branchData.badan
          }
        }
      }
      
      const bankInfo = `${bulkPayment.payment_method} - ${bulkPayment.payment_via}`
      
      // Header - centered like single payment
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(companyName, 105, 20, { align: 'center' })
      
      doc.setFontSize(14)
      doc.text('BUKTI PENGELUARAN', 105, 35, { align: 'center' })
      
      // Payment info - same format as single payment
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Tanggal: ${formatDate(bulkPayment.payment_date)}`, 20, 50)
      // Get supplier names for display
      const supplierNames = [...new Set(bulkPayment.purchase_orders.map((po: any) => po.nama_supplier))]
      const supplierText = supplierNames.length > 3 
        ? `${supplierNames.slice(0, 3).join(', ')} & ${supplierNames.length - 3} lainnya`
        : supplierNames.join(', ')
      
      doc.text(`Supplier: ${supplierText}`, 20, 60)
      doc.text('Nomor Bukti: _______________', 20, 70)
      
      // Table Header - adjusted column widths
      const tableStartY = 90
      doc.setFont('helvetica', 'bold')
      doc.rect(20, tableStartY, 170, 10)
      doc.text('COA', 25, tableStartY + 7)
      doc.text('Deskripsi', 85, tableStartY + 7)
      doc.text('Nominal', 170, tableStartY + 7)
      
      // Table Content - each PO as a row with pagination
      doc.setFont('helvetica', 'normal')
      let currentRowY = tableStartY + 10
      const maxRowsPerPage = 12 // Max rows that fit on one page
      let currentPage = 1
      let rowCount = 0
      
      bulkPayment.purchase_orders.forEach((po: any, index: number) => {
        // Check if we need a new page
        if (rowCount >= maxRowsPerPage) {
          // Add page number
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.text(`Halaman ${currentPage}`, 180, 280)
          
          // New page
          doc.addPage()
          currentPage++
          rowCount = 0
          
          // Repeat header on new page
          doc.setFontSize(16)
          doc.setFont('helvetica', 'bold')
          doc.text(companyName, 105, 20, { align: 'center' })
          doc.setFontSize(14)
          doc.text('BUKTI PENGELUARAN (Lanjutan)', 105, 35, { align: 'center' })
          
          // Table header
          const newTableStartY = 50
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.rect(20, newTableStartY, 170, 10)
          doc.text('COA', 25, newTableStartY + 7)
          doc.text('Deskripsi', 85, newTableStartY + 7)
          doc.text('Nominal', 170, newTableStartY + 7)
          
          currentRowY = newTableStartY + 10
          doc.setFont('helvetica', 'normal')
        }
        
        doc.rect(20, currentRowY, 170, 15)
        doc.text('', 25, currentRowY + 10) // Nama COA (blank)
        console.log('PO:', po.po_number, 'Invoice:', po.invoice_number) // Debug
        const description = po.invoice_number 
          ? `Pembayaran untuk invoice ${po.invoice_number} dari supplier ${po.nama_supplier}`
          : `${po.po_number} - ${po.nama_supplier}`
        doc.text(description, 50, currentRowY + 10) // Deskripsi
        doc.text(formatCurrency(po.total_tagih), 170, currentRowY + 10) // Nominal
        currentRowY += 15
        rowCount++
      })
      
      // Total - same format as single payment
      const finalTotalY = currentRowY + 5
      doc.rect(20, finalTotalY, 170, 10)
      doc.setFont('helvetica', 'bold')
      doc.text('TOTAL', 55, finalTotalY + 7)
      doc.text(formatCurrency(bulkPayment.total_amount), 170, finalTotalY + 7)
      
      // Signature Section - same format as single payment
      const signY = finalTotalY + 40
      doc.setFont('helvetica', 'normal')
      doc.text('Dibuat,', 30, signY)
      doc.text('Disetujui,', 90, signY)
      doc.text('Bank,', 150, signY)
      doc.text(bankInfo, 150, signY + 10)
      
      // Signature lines
      doc.line(20, signY + 30, 70, signY + 30)
      doc.line(80, signY + 30, 130, signY + 30)
      doc.line(140, signY + 30, 190, signY + 30)
      
      // Names under signature lines
      doc.text('Khoirun Nisa', 30, signY + 40)
      doc.text('Raymond', 90, signY + 40)
      
      // Add final page number
      doc.setFontSize(8)
      doc.text(`Halaman ${currentPage}`, 180, 280)
      
      doc.save(`bukti-pengeluaran-bulk-${bulkPayment.bulk_reference}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Gagal generate PDF')
    }
  }

  const summary = {
    totalPayments: filteredData.length,
    totalAmount: filteredData.reduce((sum, item) => sum + item.total_amount, 0),
    completedPayments: filteredData.filter(item => item.status === 'completed').length,
    pendingPayments: filteredData.filter(item => item.status === 'pending').length,
    reconciledPayments: filteredData.filter(item => item.status === 'reconciled').length
  }

  const togglePaymentExpansion = (id: number) => {
    if (expandedPayment === id) {
      setExpandedPayment(null)
    } else {
      setExpandedPayment(id)
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
        <div className="p-4 bg-gray-50 min-h-screen">
          {/* Mobile Header */}
          <div className="md:hidden bg-white p-3 rounded-lg shadow border border-gray-200 mb-4 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-800">Bulk Payments</h1>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md bg-gray-100"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden bg-white p-4 rounded-lg shadow border border-gray-200 mb-4">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setShowFilters(!showFilters); setIsMobileMenuOpen(false); }}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 text-sm justify-center"
                >
                  <Filter size={16} />
                  Filter
                </button>
                <button
                  onClick={() => { exportToXLSX(); setIsMobileMenuOpen(false); }}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm justify-center"
                >
                  <Download size={16} />
                  Export Excel
                </button>
              </div>
            </div>
          )}

          {/* Search and Filter Section */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-4">
            <div className="flex flex-col gap-4">
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
              
              <div className="hidden md:flex gap-2">
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



          {/* Bulk Payments List - Mobile View */}
          <div className="md:hidden space-y-3">
            {filteredData.map((bulkPayment) => (
              <div key={bulkPayment.id} className="bg-white rounded-lg shadow border border-gray-200 p-3">
                <div 
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => togglePaymentExpansion(bulkPayment.id)}
                >
                  <div>
                    <p className="font-medium text-blue-600">{bulkPayment.bulk_reference}</p>
                    <p className="text-sm text-gray-500 flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(bulkPayment.payment_date)}
                    </p>
                  </div>
                  <div>
                    {expandedPayment === bulkPayment.id ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </div>
                
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="text-sm font-medium">{formatCurrency(bulkPayment.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(bulkPayment.status)}`}>
                      {bulkPayment.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Method</p>
                    <p className="text-sm">{bulkPayment.payment_method}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">PO Count</p>
                    <p className="text-sm">{bulkPayment.purchase_orders.length} PO</p>
                  </div>
                </div>
                
                {expandedPayment === bulkPayment.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="mb-2">
                      <p className="text-xs text-gray-500">Payment Via</p>
                      <p className="text-sm flex items-center">
                        <Building className="h-3 w-3 mr-1 text-gray-400" />
                        {bulkPayment.payment_via}
                      </p>
                    </div>
                    
                    <div className="mb-2">
                      <p className="text-xs text-gray-500">Notes</p>
                      <p className="text-sm">{bulkPayment.notes || '-'}</p>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Purchase Orders</p>
                      <div className="space-y-1">
                        {bulkPayment.purchase_orders.map((po: any) => (
                          <div key={po.id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                            <div>
                              <a 
                                href={`/purchaseorder/received-preview?id=${po.id}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {po.po_number}
                              </a>
                              <p className="text-xs text-gray-500">{po.nama_supplier}</p>
                            </div>
                            <p className="font-medium">{formatCurrency(po.total_tagih)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBulkPaymentDetails(bulkPayment)}
                        className="flex-1 inline-flex items-center justify-center px-2 py-1 text-xs text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Detail
                      </button>
                      <button
                        onClick={() => exportBulkPaymentPDF(bulkPayment)}
                        className="flex-1 inline-flex items-center justify-center px-2 py-1 text-xs text-green-700 bg-green-100 rounded-md hover:bg-green-200"
                        title="Export PDF"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Export
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Yakin ingin menghapus bulk payment ${bulkPayment.bulk_reference}? PO akan dikembalikan ke status unpaid.`)) {
                            try {
                              // Reset PO bulk_payment_ref
                              const { error: updateError } = await supabase
                                .from('purchase_orders')
                                .update({ bulk_payment_ref: null })
                                .eq('bulk_payment_ref', bulkPayment.bulk_reference)
                              
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
                        className="flex-1 inline-flex items-center justify-center px-2 py-1 text-xs text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                        title="Cancel bulk payment"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bulk Payments Table - Desktop View */}
          <div className="hidden md:block bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
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
                            onClick={() => exportBulkPaymentPDF(bulkPayment)}
                            className="inline-flex items-center px-2 py-1 text-xs text-green-700 bg-green-100 rounded-md hover:bg-green-200"
                            title="Export PDF"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Export
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Yakin ingin menghapus bulk payment ${bulkPayment.bulk_reference}? PO akan dikembalikan ke status unpaid.`)) {
                                try {
                                  // Reset PO bulk_payment_ref
                                  const { error: updateError } = await supabase
                                    .from('purchase_orders')
                                    .update({ bulk_payment_ref: null })
                                    .eq('bulk_payment_ref', bulkPayment.bulk_reference)
                                  
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Detail Pembayaran Bulk</h3>
                <button onClick={() => setShowBulkPaymentDetails(null)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                <div className="max-h-60 overflow-y-auto">
                  {showBulkPaymentDetails.purchase_orders.map((po: any) => (
                    <div key={po.id} className="p-3 border-b last:border-b-0 flex justify-between items-center">
                      <div>
                        <a 
                          href={`/purchaseorder/received-preview?id=${po.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {po.po_number}
                        </a>
                        <p className="text-xs text-gray-500">{po.nama_supplier}</p>
                      </div>
                      <p className="text-sm font-medium">{formatCurrency(po.total_tagih)}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => exportBulkPaymentPDF(showBulkPaymentDetails)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                >
                  <Download size={16} />
                  Export PDF
                </button>
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