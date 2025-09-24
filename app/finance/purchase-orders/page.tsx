"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { DollarSign, FileText, AlertTriangle, TrendingUp, Search, Plus, Filter, X, ChevronDown, ChevronRight, Calendar, Building, User, CreditCard, Clock, CheckCircle, AlertCircle, Edit, ChevronUp, Download, LinkIcon, Receipt } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import PaymentModal from './PaymentModal'
import BulkPaymentModal from './BulkPaymentModal'


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
  total_tagih: number
}

interface BulkPayment {
  id: number
  bulk_reference: string
  total_amount: number
  payment_date: string
  payment_via: string
  payment_method: string
  notes: string
  created_at: string
  purchase_orders: any[]
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
  const [selectedPOs, setSelectedPOs] = useState<number[]>([])
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false)
  const [bulkPayments, setBulkPayments] = useState<BulkPayment[]>([])
  const [showBulkPaymentDetails, setShowBulkPaymentDetails] = useState<BulkPayment | null>(null)
  
  // Mobile states
  const [isMobileView, setIsMobileView] = useState(false)
  const [selectedMobileItem, setSelectedMobileItem] = useState<FinanceData | null>(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Filter states
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    supplier: '',
    branch: '',
    poStatus: '',
    paymentStatus: '',
    dueDate: '',
    goodsReceived: '',
    approvalStatus: ''
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchFinanceData()
    fetchSuppliers()
    fetchBranches()
    fetchBulkPayments()
  }, [filters])

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('id_supplier, nama_supplier').order('nama_supplier')
    setSuppliers(data || [])
  }

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('id_branch, nama_branch').order('nama_branch')
    setBranches(data || [])
  }

  const fetchBulkPayments = async () => {
    try {
      // First get bulk payments
      const { data: bulkPaymentsData, error: bulkError } = await supabase
        .from('bulk_payments')
        .select('*')
        .order('payment_date', { ascending: false })
      
      if (bulkError) throw bulkError
      
      // Then get related POs for each bulk payment
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
    }
  }

  const fetchRowDetails = async (id: number) => {
    try {
      // Fetch payment history
      const { data: payments } = await supabase
        .from('po_payments')
        .select('*')
        .eq('po_id', id)
        .order('payment_date', { ascending: false })
      
      // Fetch items with product names
      const { data: items } = await supabase
        .from('po_items')
        .select('*')
        .eq('po_id', id)
      
      // Get product names for each item
      const itemsWithNames = await Promise.all(
        (items || []).map(async (item) => {
          const { data: product } = await supabase
            .from('nama_product')
            .select('product_name')
            .eq('id_product', item.product_id)
            .single()
          
          return {
            ...item,
            product_name: product?.product_name || `Product ${item.product_id}`
          }
        })
      )
      
      setRowDetails(prev => ({
        ...prev,
        [id]: { payments, items: itemsWithNames }
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
            if (poItem.actual_price && poItem.received_qty) {
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

          // Get latest payment info and calculate total paid
          const { data: payments } = await supabase
            .from('po_payments')
            .select('payment_amount, payment_date, payment_via, payment_method, reference_number')
            .eq('po_id', item.id)
            .order('payment_date', { ascending: false })

          const totalPaid = payments?.reduce((sum, payment) => sum + payment.payment_amount, 0) || 0
          const latestPayment = payments?.[0] || null

          // Get bulk payment reference
          const { data: poData } = await supabase
            .from('purchase_orders')
            .select('bulk_payment_ref, total_tagih, keterangan, approval_photo, approval_status, approved_at')
            .eq('id', item.id)
            .single()

          // Get invoice number from barang_masuk
          const { data: barangMasuk } = await supabase
            .from('barang_masuk')
            .select('invoice_number')
            .eq('no_po', item.po_number)
            .limit(1)
            .single()

          const invoiceNumber = barangMasuk?.invoice_number || null

          // Get branch badan
          const { data: branchData } = await supabase
            .from('branches')
            .select('badan')
            .eq('id_branch', item.cabang_id)
            .single()

          const totalTagih = poData?.total_tagih || 0
          
          // Calculate sisa_bayar: use total_tagih if > 0, otherwise use correctedTotal
          const basisAmount = totalTagih > 0 ? totalTagih : correctedTotal
          
          // Calculate status considering bulk payments and total_tagih
          let calculatedStatus
          if (poData?.bulk_payment_ref) {
            calculatedStatus = 'paid' // POs with bulk payment reference are considered paid
          } else {
            calculatedStatus = totalPaid === 0 ? 'unpaid' : totalPaid >= basisAmount ? 'paid' : 'partial'
          }
          
          // Apply payment status filter
          if (filters.paymentStatus && calculatedStatus !== filters.paymentStatus) {
            return null
          }

          // Apply approval status filter
          if (filters.approvalStatus && poData?.approval_status !== filters.approvalStatus) {
            return null
          }
          
          let sisaBayar = basisAmount - totalPaid
          
          // For bulk payments, sisa_bayar should be 0
          if (poData?.bulk_payment_ref) {
            sisaBayar = 0
          }

          // Get bulk payment info if exists
          let bulkPaymentInfo = null
          let displayTotalPaid = totalPaid
          
          if (poData?.bulk_payment_ref) {
            const { data: bulkPayment } = await supabase
              .from('bulk_payments')
              .select('payment_date, payment_via, payment_method')
              .eq('bulk_reference', poData.bulk_payment_ref)
              .single()
            bulkPaymentInfo = bulkPayment
            // For display purposes, show the basis amount as paid for bulk payments
            displayTotalPaid = basisAmount
          }

          return {
            ...item,
            total_po: correctedTotal,
            total_paid: displayTotalPaid,
            sisa_bayar: sisaBayar,
            status_payment: calculatedStatus,
            dibayar_tanggal: bulkPaymentInfo?.payment_date || latestPayment?.payment_date || null,
            payment_via: bulkPaymentInfo?.payment_via || latestPayment?.payment_via || null,
            payment_method: bulkPaymentInfo?.payment_method || latestPayment?.payment_method || null,
            payment_reference: latestPayment?.reference_number || null,
            badan: branchData?.badan || null,
            invoice_number: invoiceNumber,
            total_tagih: totalTagih,
            keterangan: poData?.keterangan || '',
            approval_photo: poData?.approval_photo || null,
            approval_status: poData?.approval_status || null,
            approved_at: poData?.approved_at || null,
            bulk_payment_ref: poData?.bulk_payment_ref || null
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
      goodsReceived: '',
      approvalStatus: ''
    })
  }

  const applyFilters = () => {
    setLoading(true)
    setCurrentPage(1)
    fetchFinanceData()
  }

  const summary = {
    totalPO: data.filter(item => item.status_payment !== 'paid').reduce((sum, item) => sum + item.total_po, 0),
    totalPaid: data.filter(item => item.status_payment !== 'paid').reduce((sum, item) => sum + item.total_paid, 0),
    outstanding: data.filter(item => item.status_payment !== 'paid').reduce((sum, item) => sum + item.sisa_bayar, 0),
    overdue: data.filter(item => item.is_overdue && item.status_payment !== 'paid').reduce((sum, item) => sum + item.sisa_bayar, 0),
    totalOrders: data.filter(item => item.status_payment !== 'paid').length,
    overdueOrders: data.filter(item => item.is_overdue && item.status_payment !== 'paid').length
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

  const exportToXLSX = async () => {
    try {
      const XLSX = await import('xlsx')
      
      const worksheetData = allFilteredData.map(item => ({
        'No PO': item.po_number,
        'PO Date': formatDate(item.po_date),
        'CABANG': item.nama_branch,
        'Barang Sampai': (item as any).tanggal_barang_sampai ? formatDate((item as any).tanggal_barang_sampai) : '',
        'PO Status': (item as any).po_status || '',
        'Termin': `${(item as any).termin_days || 30} hari`,
        'Jatuh Tempo': item.tanggal_jatuh_tempo ? formatDate(item.tanggal_jatuh_tempo) : 'Menunggu barang sampai',
        'Total PO': item.total_po,
        'Total Tagihan': (item as any).total_tagih || 0,
        'Invoice': (item as any).invoice_number || '',
        'Supplier': item.nama_supplier,
        'Rekening': (item as any).nomor_rekening ? `${(item as any).bank_penerima} - ${(item as any).nomor_rekening}` : '',
        'Dibayar': item.total_paid,
        'Sisa': item.sisa_bayar,
        'Release Payment': (item as any).dibayar_tanggal ? formatDate((item as any).dibayar_tanggal) : '',
        'Tipe Payment': (item as any).payment_method || '',
        'Payment Via': (item as any).payment_via || '',
        'Payment Status': item.status_payment,
        'Ref. Pembayaran': (item as any).bulk_payment_ref || (item as any).payment_reference || '',
        'Approved Date': (item as any).approved_at ? formatDate((item as any).approved_at) : '',
        'Notes Raymond': notesState[item.id] || 'Rek Michael',
        'Keterangan': (item as any).keterangan || ''
      }))
      
      const worksheet = XLSX.utils.json_to_sheet(worksheetData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Finance Purchase Orders')
      
      XLSX.writeFile(workbook, `finance-purchase-orders-${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (error) {
      console.error('Error exporting to XLSX:', error)
      alert('Gagal export file. Pastikan browser mendukung fitur export.')
    }
  }



  // Mobile Components
  const MobileFinanceCard = ({ item }: { item: FinanceData }) => {
    const isExpanded = expandedRows.includes(item.id)
    const hasDetails = !!rowDetails[item.id]
    
    return (
      <div className={`bg-white rounded-lg shadow border mb-4 overflow-hidden ${
        item.is_overdue ? 'border-red-200' : 'border-gray-200'
      } ${isExpanded ? 'border-blue-200' : ''}`}>
        <div className="p-4">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedPOs.includes(item.id)}
                disabled={item.status_payment === 'paid'}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedPOs([...selectedPOs, item.id])
                  } else {
                    setSelectedPOs(selectedPOs.filter(id => id !== item.id))
                  }
                }}
                className="rounded border-gray-300 mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div>
                <a 
                  href={`/purchaseorder/received-preview?id=${item.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.po_number}
                </a>
                <div className="text-xs text-gray-500 flex items-center mt-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  {formatDate(item.po_date)}
                </div>
              </div>
            </div>
            <button 
              onClick={() => toggleRowExpansion(item.id)}
              className="text-gray-500 hover:text-blue-600 ml-2"
            >
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>

          {/* Status and Supplier */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-500">Supplier</p>
              <p className="text-sm font-medium truncate">{item.nama_supplier}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cabang</p>
              <p className="text-sm font-medium">{item.nama_branch}</p>
            </div>
          </div>

          {/* Payment Status */}
          <div className="mb-3">
            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status_payment)}`}>
              {getStatusIcon(item.status_payment)}
              {item.status_payment.toUpperCase()}
            </span>
            {(item as any).approval_status === 'approved' && (
              <div className="text-xs text-purple-600 mt-1 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Approved {(item as any).approved_at ? `- ${formatDate((item as any).approved_at)}` : ''}
              </div>
            )}
            {(item as any).approval_status === 'pending' && (
              <div className="text-xs text-orange-600 mt-1 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                Wait for Approval
              </div>
            )}
            {item.is_overdue && (
              <div className="text-xs text-red-600 mt-1 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue {item.days_overdue} hari
              </div>
            )}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-gray-50 p-2 rounded">
              <p className="text-xs text-gray-500">Total PO</p>
              <p className="text-sm font-medium">{formatCurrency(item.total_po)}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <p className="text-xs text-gray-500">Dibayar</p>
              <p className="text-sm font-medium">{formatCurrency(item.total_paid)}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <p className="text-xs text-gray-500">Sisa</p>
              <p className="text-sm font-medium">{formatCurrency(item.sisa_bayar)}</p>
            </div>
          </div>

          {/* Due Date and Actions */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500">Jatuh Tempo</p>
              <p className="text-sm">{item.tanggal_jatuh_tempo ? formatDate(item.tanggal_jatuh_tempo) : 'Menunggu barang sampai'}</p>
            </div>
            <div className="flex gap-1">
              <a
                href={`/finance/purchase-orders/submit-approval?id=${item.id}`}
                className="inline-flex items-center p-1 border border-transparent rounded-md text-white bg-green-600 hover:bg-green-700"
                title="Submit Total Tagih"
              >
                <FileText className="h-3 w-3" />
              </a>
              {(item as any).approval_status === 'pending' && (
                <button
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from('purchase_orders')
                        .update({ 
                          approval_status: 'approved',
                          approved_at: new Date().toISOString()
                        })
                        .eq('id', item.id)
                      if (error) throw error
                      fetchFinanceData()
                    } catch (error) {
                      console.error('Error approving:', error)
                    }
                  }}
                  className="inline-flex items-center p-1 border border-transparent rounded-md text-white bg-purple-600 hover:bg-purple-700"
                  title="Approve"
                >
                  <CheckCircle className="h-3 w-3" />
                </button>
              )}
              {(item as any).approval_status === 'approved' && (
                <button
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from('purchase_orders')
                        .update({ 
                          approval_status: 'pending',
                          approved_at: null
                        })
                        .eq('id', item.id)
                      if (error) throw error
                      fetchFinanceData()
                    } catch (error) {
                      console.error('Error undoing approval:', error)
                    }
                  }}
                  className="inline-flex items-center p-1 border border-transparent rounded-md text-white bg-red-600 hover:bg-red-700"
                  title="Undo Approval"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {item.sisa_bayar > 0 && !(item as any).bulk_payment_ref && (
                <button
                  onClick={() => {
                    setSelectedPO(item)
                    setShowPaymentModal(true)
                  }}
                  className="inline-flex items-center p-1 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  title="Bayar"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && hasDetails && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="space-y-4">
              {/* Items List */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Daftar Item
                </h3>
                {rowDetails[item.id]?.items?.length > 0 ? (
                  <div className="space-y-2">
                    {rowDetails[item.id].items.slice(0, 3).map((poItem: any) => (
                      <div key={poItem.id} className="bg-white p-2 rounded border border-gray-200">
                        <p className="text-sm font-medium">{poItem.product_name || `Product ${poItem.product_id}`}</p>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div>
                            <p className="text-xs text-gray-500">Qty</p>
                            <p className="text-xs">{poItem.received_qty ? `${poItem.received_qty}/${poItem.qty}` : poItem.qty}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Harga</p>
                            <p className="text-xs">{formatCurrency(poItem.harga || poItem.actual_price || 0)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {rowDetails[item.id].items.length > 3 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        +{rowDetails[item.id].items.length - 3} item lainnya
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Tidak ada item</p>
                )}
              </div>

              {/* Payment History */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Riwayat Pembayaran
                </h3>
                {rowDetails[item.id]?.payments?.length > 0 ? (
                  <div className="space-y-2">
                    {rowDetails[item.id].payments.slice(0, 2).map((payment: any) => (
                      <div key={payment.id} className="bg-white p-2 rounded border border-gray-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-medium">{formatDate(payment.payment_date)}</p>
                            <p className="text-xs text-gray-500">{payment.payment_method}</p>
                          </div>
                          <p className="text-sm font-medium">{formatCurrency(payment.payment_amount)}</p>
                        </div>
                      </div>
                    ))}
                    {rowDetails[item.id].payments.length > 2 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        +{rowDetails[item.id].payments.length - 2} pembayaran lainnya
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Belum ada riwayat pembayaran</p>
                )}
              </div>

              {/* View More Button */}
              <button
                onClick={() => setSelectedMobileItem(item)}
                className="w-full py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-md border border-blue-200 hover:bg-blue-100"
              >
                Lihat Detail Lengkap
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const MobileDetailView = ({ item }: { item: FinanceData }) => {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <button onClick={() => setSelectedMobileItem(null)} className="p-1">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Detail PO</h2>
          <div className="w-6"></div>
        </div>

        <div className="p-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Informasi Utama</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">No PO</p>
                <p className="text-sm font-medium">{item.po_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tanggal PO</p>
                <p className="text-sm">{formatDate(item.po_date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Supplier</p>
                <p className="text-sm font-medium">{item.nama_supplier}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Cabang</p>
                <p className="text-sm">{item.nama_branch}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Jatuh Tempo</p>
                <p className="text-sm">{item.tanggal_jatuh_tempo ? formatDate(item.tanggal_jatuh_tempo) : 'Menunggu barang sampai'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status Pembayaran</p>
                <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status_payment)}`}>
                  {getStatusIcon(item.status_payment)}
                  {item.status_payment.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Informasi Keuangan</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <p className="text-sm">Total PO</p>
                <p className="text-sm font-medium">{formatCurrency(item.total_po)}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-sm">Total Dibayar</p>
                <p className="text-sm font-medium">{formatCurrency(item.total_paid)}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-sm">Sisa Bayar</p>
                <p className="text-sm font-medium">{formatCurrency(item.sisa_bayar)}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-sm">Total Tagihan</p>
                <p className="text-sm font-medium">{formatCurrency((item as any).total_tagih || 0)}</p>
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Daftar Item
            </h3>
            {rowDetails[item.id]?.items?.length > 0 ? (
              <div className="space-y-3">
                {rowDetails[item.id].items.map((poItem: any) => (
                  <div key={poItem.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium">{poItem.product_name || `Product ${poItem.product_id}`}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="text-xs text-gray-500">Quantity</p>
                        <p className="text-xs">{poItem.received_qty ? `${poItem.received_qty}/${poItem.qty}` : poItem.qty}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Harga</p>
                        <p className="text-xs">{formatCurrency(poItem.harga || poItem.actual_price || 0)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-xs font-medium">
                          {formatCurrency(
                            poItem.actual_price && poItem.received_qty 
                              ? poItem.received_qty * poItem.actual_price
                              : poItem.harga 
                                ? poItem.qty * poItem.harga
                                : 0
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Tidak ada item</p>
            )}
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              Riwayat Pembayaran
            </h3>
            {rowDetails[item.id]?.payments?.length > 0 ? (
              <div className="space-y-3">
                {rowDetails[item.id].payments.map((payment: any) => (
                  <div key={payment.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{formatDate(payment.payment_date)}</p>
                        <p className="text-xs text-gray-500">{payment.payment_method} • {payment.payment_via}</p>
                        {payment.notes && <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>}
                      </div>
                      <p className="text-sm font-medium">{formatCurrency(payment.payment_amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Belum ada riwayat pembayaran</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 sticky bottom-0 bg-white pt-4 pb-6 border-t border-gray-200">
            <a
              href={`/finance/purchase-orders/submit-approval?id=${item.id}`}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <FileText className="h-4 w-4 mr-1" />
              Submit
            </a>
            {(item as any).approval_status === 'pending' && (
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('purchase_orders')
                      .update({ 
                        approval_status: 'approved',
                        approved_at: new Date().toISOString()
                      })
                      .eq('id', item.id)
                    if (error) throw error
                    fetchFinanceData()
                    setSelectedMobileItem(null)
                  } catch (error) {
                    console.error('Error approving:', error)
                  }
                }}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve
              </button>
            )}
            {(item as any).approval_status === 'approved' && (
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('purchase_orders')
                      .update({ 
                        approval_status: 'pending',
                        approved_at: null
                      })
                      .eq('id', item.id)
                    if (error) throw error
                    fetchFinanceData()
                    setSelectedMobileItem(null)
                  } catch (error) {
                    console.error('Error undoing approval:', error)
                  }
                }}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <X className="h-4 w-4 mr-1" />
                Undo Approval
              </button>
            )}
            {item.sisa_bayar > 0 && !(item as any).bulk_payment_ref && (
              <button
                onClick={() => {
                  setSelectedPO(item)
                  setShowPaymentModal(true)
                  setSelectedMobileItem(null)
                }}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Bayar
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const MobileFiltersPanel = () => {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <button onClick={() => setShowMobileFilters(false)} className="p-1">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Filter Data</h2>
          <button 
            onClick={clearFilters}
            className="text-blue-600 text-sm font-medium"
          >
            Reset
          </button>
        </div>

        <div className="p-4">
          <div className="space-y-4">
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
          </div>

          <button
            onClick={() => {
              applyFilters()
              setShowMobileFilters(false)
            }}
            className="w-full mt-6 py-3 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Terapkan Filter
          </button>
        </div>
      </div>
    )
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

  // Render mobile view
  if (isMobileView) {
    return (
      <Layout>
        <PageAccessControl pageName="finance">
          <div className="p-4 bg-gray-50 min-h-screen">
            {/* Summary Cards - Mobile */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white p-3 rounded-lg shadow border border-gray-200">
                <p className="text-xs text-gray-600">Total PO</p>
                <p className="text-sm font-semibold">{formatCurrency(summary.totalPO)}</p>
                <p className="text-xs text-gray-500">{summary.totalOrders} orders</p>
              </div>
              <div className="bg-white p-3 rounded-lg shadow border border-gray-200">
                <p className="text-xs text-gray-600">Outstanding</p>
                <p className="text-sm font-semibold">{formatCurrency(summary.outstanding)}</p>
              </div>
              <div className="bg-white p-3 rounded-lg shadow border border-gray-200">
                <p className="text-xs text-gray-600">Overdue</p>
                <p className="text-sm font-semibold">{formatCurrency(summary.overdue)}</p>
                <p className="text-xs text-gray-500">{summary.overdueOrders} orders</p>
              </div>
              <div className="bg-white p-3 rounded-lg shadow border border-gray-200">
                <div className="flex justify-between items-center h-full">
                  <div>
                    <p className="text-xs text-gray-600">Last Updated</p>
                    <p className="text-xs font-semibold">{new Date().toLocaleDateString('id-ID')}</p>
                  </div>
                  <button 
                    onClick={fetchFinanceData}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedPOs.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-blue-800">
                      {selectedPOs.length} PO dipilih
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowBulkPaymentModal(true)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs"
                    >
                      Bulk Payment
                    </button>
                    <button
                      onClick={() => setSelectedPOs([])}
                      className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-xs"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search and Actions */}
            <div className="bg-white p-3 rounded-lg shadow border border-gray-200 mb-4">
              <div className="flex gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Cari PO..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <button
                  onClick={exportToXLSX}
                  className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  title="Export Excel"
                >
                  <Download size={16} />
                </button>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                >
                  <Filter size={16} />
                  Filter
                </button>
                <div className="text-xs text-gray-500 flex items-center px-3">
                  {allFilteredData.length} items
                </div>
              </div>
            </div>

            {/* PO List */}
            <div>
              {filteredData.map((item) => (
                <MobileFinanceCard key={item.id} item={item} />
              ))}
            </div>

            {/* Pagination - Mobile */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 mt-4 rounded-lg shadow">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}

            {allFilteredData.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200 mt-4">
                <FileText className="h-8 w-8 mx-auto text-gray-400" />
                <p className="mt-2">Tidak ada data yang ditemukan</p>
                <p className="text-xs">Coba ubah filter pencarian Anda</p>
              </div>
            )}
          </div>

          {/* Mobile Detail View */}
          {selectedMobileItem && <MobileDetailView item={selectedMobileItem} />}

          {/* Mobile Filters Panel */}
          {showMobileFilters && <MobileFiltersPanel />}

          {/* Payment Modal */}
          {showPaymentModal && selectedPO && (
            <PaymentModal
              po={{
                ...selectedPO,
                total_tagih: (selectedPO as any).total_tagih || 0
              }}
              onClose={() => {
                setShowPaymentModal(false)
                setSelectedPO(null)
              }}
              onSuccess={handlePaymentSuccess}
            />
          )}

          {/* Bulk Payment Modal */}
          {showBulkPaymentModal && (
            <BulkPaymentModal
              isOpen={showBulkPaymentModal}
              availablePOs={data.filter(item => selectedPOs.includes(item.id))}
              onClose={() => setShowBulkPaymentModal(false)}
              onSuccess={() => {
                setShowBulkPaymentModal(false)
                setSelectedPOs([])
                fetchFinanceData()
                fetchBulkPayments()
              }}
            />
          )}
        </PageAccessControl>
      </Layout>
    )
  }

  // Desktop view
  return (
    <Layout>
      <PageAccessControl pageName="finance">
        <div className="p-3 md:p-6 bg-gray-50 min-h-screen">
          {/* Summary Cards - Mobile Optimized */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 md:gap-3 mb-4 md:mb-6">
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

          {/* Bulk Actions */}
          {selectedPOs.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4 mb-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span className="text-sm font-medium text-blue-800">
                    {selectedPOs.length} PO dipilih
                  </span>
                  <span className="text-xs sm:text-sm text-blue-600">
                    Total: {formatCurrency(data.filter(item => selectedPOs.includes(item.id)).reduce((sum, item) => sum + (item.total_tagih || item.sisa_bayar), 0))}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const updatePromises = selectedPOs.map(poId => 
                          supabase
                            .from('purchase_orders')
                            .update({ 
                              approval_status: 'approved',
                              approved_at: new Date().toISOString()
                            })
                            .eq('id', poId)
                        )
                        await Promise.all(updatePromises)
                        fetchFinanceData()
                        alert(`${selectedPOs.length} PO berhasil di-approve`)
                      } catch (error) {
                        console.error('Error bulk approving:', error)
                        alert('Gagal melakukan bulk approval')
                      }
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-xs sm:text-sm"
                    disabled={!data.filter(item => selectedPOs.includes(item.id)).some(item => (item as any).approval_status === 'pending')}
                  >
                    <span className="hidden sm:inline">Bulk </span>Approve
                  </button>
                  <button
                    onClick={() => setShowBulkPaymentModal(true)}
                    className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs sm:text-sm"
                    disabled={!data.filter(item => selectedPOs.includes(item.id)).every(item => (item as any).approval_status === 'approved')}
                  >
                    <span className="hidden sm:inline">Bulk </span>Payment
                  </button>
                  <button
                    onClick={() => setSelectedPOs([])}
                    className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-xs sm:text-sm"
                  >
                    <X size={16} className="sm:hidden" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search and Filter Section */}
          <div className="bg-white p-3 md:p-4 rounded-lg shadow border border-gray-200 mb-4">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Cari PO, supplier, cabang..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1 text-sm whitespace-nowrap"
                >
                  <Filter size={16} />
                  <span className="hidden sm:inline">Filter</span>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportToXLSX}
                  className="flex-1 sm:flex-none px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2 text-sm"
                >
                  <Download size={16} />
                  Export Excel
                </button>
                <div className="text-xs text-gray-500 flex items-center">
                  {allFilteredData.length} items
                </div>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Approval Status</label>
                    <select
                      value={filters.approvalStatus}
                      onChange={(e) => setFilters({...filters, approvalStatus: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Semua</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
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
                    onClick={() => { clearFilters(); fetchFinanceData(); }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 text-sm"
                  >
                    <X size={16} />
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden">
            {filteredData.map((item) => {
              const isExpanded = expandedRows.includes(item.id)
              return (
                <div key={item.id} className="bg-white rounded-lg shadow border border-gray-200 mb-3 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedPOs.includes(item.id)}
                        disabled={item.status_payment === 'paid'}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPOs([...selectedPOs, item.id])
                          } else {
                            setSelectedPOs(selectedPOs.filter(id => id !== item.id))
                          }
                        }}
                        className="rounded border-gray-300 disabled:opacity-50"
                      />
                      <button 
                        onClick={() => toggleRowExpansion(item.id)}
                        className="text-gray-500 hover:text-blue-600"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <a 
                        href={`/purchaseorder/received-preview?id=${item.id}`}
                        className="text-sm font-bold text-blue-600 hover:text-blue-800"
                        target="_blank"
                      >
                        {item.po_number}
                      </a>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status_payment)}`}>
                      {item.status_payment.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-gray-500">Cabang:</span>
                      <p className="font-medium">{item.nama_branch}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Supplier:</span>
                      <p className="font-medium">{item.nama_supplier}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Total PO:</span>
                      <p className="font-medium">{formatCurrency(item.total_po)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Sisa:</span>
                      <p className="font-medium text-red-600">{formatCurrency(item.sisa_bayar)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Jatuh Tempo:</span>
                      <p className={`font-medium ${item.is_overdue ? 'text-red-600' : ''}`}>
                        {item.tanggal_jatuh_tempo ? formatDate(item.tanggal_jatuh_tempo) : 'Menunggu barang sampai'}
                        {item.is_overdue && <span className="ml-1 text-xs">(Overdue {item.days_overdue}d)</span>}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status PO:</span>
                      <span className={`inline-flex px-1 py-0.5 text-xs font-semibold rounded ${
                        (item as any).po_status === 'Barang sampai' ? 'bg-green-100 text-green-800' :
                        (item as any).po_status === 'Sedang diproses' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {(item as any).po_status}
                      </span>
                    </div>
                  </div>
                  
                  {(item as any).tanggal_barang_sampai && (
                    <div className="text-xs text-green-600 mb-2 flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Barang sampai: {formatDate((item as any).tanggal_barang_sampai)}
                    </div>
                  )}
                  
                  {(item as any).dibayar_tanggal && (
                    <div className="text-xs text-blue-600 mb-2 flex items-center">
                      <CreditCard className="h-3 w-3 mr-1" />
                      Dibayar: {formatDate((item as any).dibayar_tanggal)} via {(item as any).payment_via}
                    </div>
                  )}
                  
                  {/* Expanded Details for Mobile */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                      {/* Items List */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-900 mb-2 flex items-center">
                          <FileText className="h-3 w-3 mr-1" />
                          Daftar Item
                        </h4>
                        {rowDetails[item.id]?.items?.length > 0 ? (
                          <div className="bg-gray-50 rounded p-2">
                            {rowDetails[item.id].items.map((poItem: any) => (
                              <div key={poItem.id} className="flex justify-between items-center py-1 text-xs border-b border-gray-200 last:border-b-0">
                                <div className="flex-1">
                                  <p className="font-medium">{poItem.product_name}</p>
                                  <p className="text-gray-500">Qty: {poItem.received_qty ? `${poItem.received_qty}/${poItem.qty}` : poItem.qty}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">{formatCurrency(poItem.harga || poItem.actual_price || 0)}</p>
                                  <p className="text-gray-500">{formatCurrency(
                                    poItem.actual_price && poItem.received_qty 
                                      ? poItem.received_qty * poItem.actual_price
                                      : poItem.harga 
                                        ? poItem.qty * poItem.harga
                                        : 0
                                  )}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Tidak ada item</p>
                        )}
                      </div>
                      
                      {/* Payment History */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-900 mb-2 flex items-center">
                          <CreditCard className="h-3 w-3 mr-1" />
                          Riwayat Pembayaran
                        </h4>
                        {rowDetails[item.id]?.payments?.length > 0 ? (
                          <div className="bg-gray-50 rounded p-2">
                            {rowDetails[item.id].payments.map((payment: any) => (
                              <div key={payment.id} className="flex justify-between items-center py-1 text-xs border-b border-gray-200 last:border-b-0">
                                <div>
                                  <p className="font-medium">{formatDate(payment.payment_date)}</p>
                                  <p className="text-gray-500">{payment.payment_method}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">{formatCurrency(payment.payment_amount)}</p>
                                  <p className="text-gray-500">{payment.notes || '-'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Belum ada riwayat pembayaran</p>
                        )}
                      </div>
                      
                      {/* Approval Photo */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-900 mb-2 flex items-center">
                          <FileText className="h-3 w-3 mr-1" />
                          Foto Approval
                        </h4>
                        {(item as any).approval_photo ? (
                          <div className="bg-gray-50 rounded p-2">
                            <img 
                              src={`${supabase.storage.from('po-photos').getPublicUrl((item as any).approval_photo).data.publicUrl}`}
                              alt="Approval Photo"
                              className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80"
                              onClick={() => window.open(`${supabase.storage.from('po-photos').getPublicUrl((item as any).approval_photo).data.publicUrl}`, '_blank')}
                            />
                            <div className="mt-2 text-xs text-gray-500">
                              <p>Status: {(item as any).approval_status || 'pending'}</p>
                              <p>Total Tagih: {formatCurrency((item as any).total_tagih || 0)}</p>
                              {(item as any).keterangan && <p>Keterangan: {(item as any).keterangan}</p>}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Belum ada foto approval</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-1 mt-2">
                    <a
                      href={`/finance/purchase-orders/submit-approval?id=${item.id}`}
                      className="flex-1 text-center px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      Submit
                    </a>
                    {(item as any).approval_status === 'pending' && (
                      <button
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('purchase_orders')
                              .update({ 
                                approval_status: 'approved',
                                approved_at: new Date().toISOString()
                              })
                              .eq('id', item.id)
                            if (error) throw error
                            fetchFinanceData()
                          } catch (error) {
                            console.error('Error approving:', error)
                          }
                        }}
                        className="flex-1 text-center px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                      >
                        Approve
                      </button>
                    )}
                    {(item as any).approval_status === 'approved' && (
                      <button
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('purchase_orders')
                              .update({ 
                                approval_status: 'pending',
                                approved_at: null
                              })
                              .eq('id', item.id)
                            if (error) throw error
                            fetchFinanceData()
                          } catch (error) {
                            console.error('Error undoing approval:', error)
                          }
                        }}
                        className="flex-1 text-center px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      >
                        Undo
                      </button>
                    )}
                    {item.sisa_bayar > 0 && !(item as any).bulk_payment_ref && (
                      <button
                        onClick={() => {
                          setSelectedPO(item)
                          setShowPaymentModal(true)
                        }}
                        className="flex-1 text-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Bayar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="w-8 px-2 py-3 sticky left-0 bg-gray-50 z-20">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            const unpaidPOs = filteredData.filter(item => item.status_payment !== 'paid').map(item => item.id)
                            setSelectedPOs(unpaidPOs)
                          } else {
                            setSelectedPOs([])
                          }
                        }}
                        checked={selectedPOs.length > 0 && selectedPOs.length === filteredData.filter(item => item.status_payment !== 'paid').length}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="w-8 px-2 py-3 sticky left-8 bg-gray-50 z-20"></th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 sticky left-16 bg-gray-50 z-20" onClick={() => handleSort('po_number')}>No PO {sortField === 'po_number' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nama_branch')}>CABANG {sortField === 'nama_branch' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tanggal_barang_sampai')}>Barang Sampai {sortField === 'tanggal_barang_sampai' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PO Status</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Termin</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tanggal_jatuh_tempo')}>Jatuh Tempo {sortField === 'tanggal_jatuh_tempo' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total_po')}>Total PO {sortField === 'total_po' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Total Tagihan</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Invoice</th>                                      
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nama_supplier')}>Supplier {sortField === 'nama_supplier' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rekening</th>  
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total_paid')}>Dibayar {sortField === 'total_paid' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('sisa_bayar')}>Sisa {sortField === 'sisa_bayar' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>                    
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('dibayar_tanggal')}>Release Payment {sortField === 'dibayar_tanggal' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Tipe Payment</th>                    
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Payment Via</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status_payment')}>Payment Status {sortField === 'status_payment' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>                                        
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ref. Pembayaran</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('approved_at')}>Approved Date {sortField === 'approved_at' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}</th>                                                  
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Notes Raymond</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Keterangan</th>
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
                          <td className="px-2 py-4 whitespace-nowrap sticky left-0 bg-white z-10">
                            <input
                              type="checkbox"
                              checked={selectedPOs.includes(item.id)}
                              disabled={item.status_payment === 'paid'}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPOs([...selectedPOs, item.id])
                                } else {
                                  setSelectedPOs(selectedPOs.filter(id => id !== item.id))
                                }
                              }}
                              className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap sticky left-8 bg-white z-10">
                            <button 
                              onClick={() => toggleRowExpansion(item.id)}
                              className="text-gray-500 hover:text-blue-600"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap sticky left-16 bg-white z-10">
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
                              {item.nama_branch}
                            </div>
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
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).termin_days || 30} hari
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.tanggal_jatuh_tempo ? (
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                                {formatDate(item.tanggal_jatuh_tempo)}
                              </div>
                            ) : (
                              <span className="text-gray-400">Menunggu barang sampai</span>
                            )}
                            {item.last_payment_date && (
                              <div className="text-xs text-gray-500">
                                Last: {formatDate(item.last_payment_date)}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(item.total_po)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency((item as any).total_tagih || 0)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).invoice_number || <span className="text-gray-400">-</span>}
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
                            {formatCurrency(item.total_paid)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(item.sisa_bayar)}
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
                            {(item as any).payment_method || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).payment_via || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status_payment)}`}>
                              {getStatusIcon(item.status_payment)}
                              {item.status_payment.toUpperCase()}
                            </span>
                            {(item as any).approval_status === 'pending' && (
                              <div className="text-xs text-orange-600 mt-1 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Wait for Approval
                              </div>
                            )}
                            {item.is_overdue && (
                              <div className="text-xs text-red-600 mt-1 flex items-center">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Overdue {item.days_overdue} hari
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).bulk_payment_ref ? (
                              <button
                                onClick={() => {
                                  const bulkPayment = bulkPayments.find(
                                    bp => bp.bulk_reference === (item as any).bulk_payment_ref
                                  )
                                  if (bulkPayment) {
                                    setShowBulkPaymentDetails(bulkPayment)
                                  }
                                }}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
                                title="Lihat detail pembayaran bulk"
                              >
                                <LinkIcon className="h-3 w-3 mr-1" />
                                {(item as any).bulk_payment_ref}
                              </button>
                            ) : (item as any).payment_reference ? (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md">
                                <Receipt className="h-3 w-3 mr-1" />
                                {(item as any).payment_reference}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).approved_at ? (
                              <div className="flex items-center">
                                <CheckCircle className="h-4 w-4 text-purple-500 mr-1" />
                                {formatDate((item as any).approved_at)}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
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
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="text-xs text-gray-700">
                              {(item as any).keterangan || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-center">
                            <div className="flex gap-1 justify-center">
                              <a
                                href={`/finance/purchase-orders/submit-approval?id=${item.id}`}
                                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                title="Submit Total Tagih"
                              >
                                <FileText className="h-3 w-3" />
                              </a>
                              {(item as any).approval_status === 'pending' && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const { error } = await supabase
                                        .from('purchase_orders')
                                        .update({ 
                                          approval_status: 'approved',
                                          approved_at: new Date().toISOString()
                                        })
                                        .eq('id', item.id)
                                      if (error) throw error
                                      fetchFinanceData()
                                    } catch (error) {
                                      console.error('Error approving:', error)
                                    }
                                  }}
                                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                  title="Approve"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </button>
                              )}
                              {(item as any).approval_status === 'approved' && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const { error } = await supabase
                                        .from('purchase_orders')
                                        .update({ 
                                          approval_status: 'pending',
                                          approved_at: null
                                        })
                                        .eq('id', item.id)
                                      if (error) throw error
                                      fetchFinanceData()
                                    } catch (error) {
                                      console.error('Error undoing approval:', error)
                                    }
                                  }}
                                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                  title="Undo Approval"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                              {item.sisa_bayar > 0 && !(item as any).bulk_payment_ref && (
                                <button
                                  onClick={() => {
                                    setSelectedPO(item)
                                    setShowPaymentModal(true)
                                  }}
                                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                  title="Bayar"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              )}
                              {((item.total_paid > 0 && !(item as any).bulk_payment_ref) || (item as any).bulk_payment_ref) && (
                                <button
                                  onClick={() => {
                                    if ((item as any).bulk_payment_ref) {
                                      // For bulk payments, redirect to bulk payments page
                                      window.open('/finance/bulk-payments', '_blank')
                                    } else {
                                      // For single payments, open payment modal
                                      setSelectedPO(item)
                                      setShowPaymentModal(true)
                                    }
                                  }}
                                  className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                  title={`${(item as any).bulk_payment_ref ? 'View Bulk Payment' : 'Edit Payment'}`}
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded Row with Details - Desktop Only */}
                        {isExpanded && (
                          <tr className="bg-blue-50">
                            <td colSpan={24} className="px-4 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                                                {formatCurrency(
                                                  poItem.actual_price && poItem.received_qty 
                                                    ? poItem.received_qty * poItem.actual_price
                                                    : poItem.harga 
                                                      ? poItem.qty * poItem.harga
                                                      : 0
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">Tidak ada item</p>
                                  )}
                                </div>
                                
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
                                
                                {/* Approval Photo */}
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Foto Approval
                                  </h3>
                                  {(item as any).approval_photo ? (
                                    <div className="bg-white rounded-md border border-gray-200 p-3">
                                      <img 
                                        src={`${supabase.storage.from('po-photos').getPublicUrl((item as any).approval_photo).data.publicUrl}`}
                                        alt="Approval Photo"
                                        className="m-full h-40 object-cover rounded-md cursor-pointer hover:opacity-80"
                                        onClick={() => window.open(`${supabase.storage.from('po-photos').getPublicUrl((item as any).approval_photo).data.publicUrl}`, '_blank')}
                                      />
                                      <div className="mt-2 text-xs text-gray-500">
                                        <p>Status: {(item as any).approval_status || 'pending'}</p>
                                        <p>Total Tagih: {formatCurrency((item as any).total_tagih || 0)}</p>
                                        {(item as any).keterangan && <p>Keterangan: {(item as any).keterangan}</p>}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">Belum ada foto approval</p>
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

          {/* Mobile Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 mt-4 rounded-lg shadow">
              {/* Mobile pagination */}
              <div className="flex-1 flex justify-between md:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700 flex items-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              
              {/* Desktop pagination */}
              <div className="hidden md:flex-1 md:flex md:items-center md:justify-between">
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
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page
                      if (totalPages <= 5) {
                        page = i + 1
                      } else if (currentPage <= 3) {
                        page = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i
                      } else {
                        page = currentPage - 2 + i
                      }
                      return (
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
                      )
                    })}
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

          {/* Empty State */}
          {allFilteredData.length === 0 && !loading && (
            <div className="text-center py-8 md:py-12 text-gray-500 bg-white rounded-lg border border-gray-200 mt-4">
              <FileText className="h-8 w-8 md:h-12 md:w-12 mx-auto text-gray-400" />
              <p className="mt-2 text-sm md:text-base">Tidak ada data yang ditemukan</p>
              <p className="text-xs md:text-sm">Coba ubah filter pencarian Anda</p>
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedPO && (
          <PaymentModal
            po={{
              ...selectedPO,
              total_tagih: (selectedPO as any).total_tagih || 0
            }}
            onClose={() => {
              setShowPaymentModal(false)
              setSelectedPO(null)
            }}
            onSuccess={handlePaymentSuccess}
          />
        )}

        {/* Bulk Payment Modal */}
        {showBulkPaymentModal && (
          <BulkPaymentModal
            isOpen={showBulkPaymentModal}
            availablePOs={data.filter(item => selectedPOs.includes(item.id))}
            onClose={() => setShowBulkPaymentModal(false)}
            onSuccess={() => {
              setShowBulkPaymentModal(false)
              setSelectedPOs([])
              fetchFinanceData()
              fetchBulkPayments()
            }}
          />
        )}

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

