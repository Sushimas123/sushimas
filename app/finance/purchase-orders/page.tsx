"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/src/lib/supabaseClient'
import { DollarSign, FileText, AlertTriangle, TrendingUp, Search, Plus, Filter, X, ChevronDown, ChevronRight, Calendar, Building, User, CreditCard, Clock, CheckCircle, AlertCircle, Edit, ChevronUp, Download, LinkIcon, Receipt } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import PaymentModal from './PaymentModal'
import BulkPaymentModal from './BulkPaymentModal'
import { TableSkeleton, MobileCardSkeleton, StatsSkeleton } from '../../../components/SkeletonLoader'
import { calculatePODueDate, updatePODueDate, getPOPaymentTermDisplay } from '@/src/utils/purchaseOrderPaymentTerms'

// Debounce hook for search optimization
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Modal Component untuk Reject
const RejectModal = ({ po, onClose, onSuccess }: { 
  po: FinanceData, 
  onClose: () => void, 
  onSuccess: () => void 
}) => {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReject = async () => {
    if (!notes.trim()) {
      alert('Harap masukkan alasan penolakan')
      return
    }

    setLoading(true)
    try {
      // amazonq-ignore-next-line
      // Get current user from localStorage or Supabase Auth
      let currentUser = null
      try {
        const { data: { user } } = await supabase.auth.getUser()
        currentUser = user
      } catch (authError) {
        console.warn('Auth error, using localStorage:', authError)
      }
      
      if (!currentUser) {
        const localUser = JSON.parse(localStorage.getItem('user') || '{}')
        currentUser = { id: localUser.auth_id || null }
      }
      
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          approval_status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_notes: notes.trim(),
          rejected_by: currentUser?.id || null
        })
        .eq('id', po.id)

      if (error) throw error
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error rejecting approval:', error)
      alert('Gagal menolak approval')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg p-4 md:p-6 w-full max-w-md mx-4 md:mx-0">
        <h3 className="text-lg font-semibold mb-4">Tolak Approval PO</h3>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">PO: <strong>{po.po_number}</strong></p>
          <p className="text-sm text-gray-600">Supplier: <strong>{po.nama_supplier}</strong></p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Alasan Penolakan *
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Masukkan alasan penolakan..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
            disabled={loading}
          >
            Batal
          </button>
          <button
            onClick={handleReject}
            disabled={loading || !notes.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
          >
            {loading ? 'Memproses...' : 'Tolak Approval'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal Component untuk melihat Rejection Notes
const ViewRejectionNotesModal = ({ po, onClose }: { 
  po: FinanceData, 
  onClose: () => void 
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg p-4 md:p-6 w-full max-w-md mx-4 md:mx-0">
        <h3 className="text-lg font-semibold mb-4 text-red-600">Catatan Penolakan</h3>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">PO: <strong>{po.po_number}</strong></p>
          <p className="text-sm text-gray-600 mb-2">Supplier: <strong>{po.nama_supplier}</strong></p>
          <p className="text-sm text-gray-600 mb-2">Ditolak: <strong>{po.rejected_at ? formatDate(po.rejected_at) : '-'}</strong></p>
          {po.rejected_by_name && (
            <p className="text-sm text-gray-600">Ditolak oleh: <strong>{po.rejected_by_name}</strong></p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Alasan Penolakan:
          </label>
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">{po.rejection_notes || 'Tidak ada catatan'}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

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
  rejection_notes?: string
  rejected_at?: string
  rejected_by?: string
  rejected_by_name?: string
  approved_by?: number
  approved_by_name?: string
  invoice_number?: string
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

// amazonq-ignore-next-line
function FinancePurchaseOrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<FinanceData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 800)
  const [selectedPO, setSelectedPO] = useState<FinanceData | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [expandedRows, setExpandedRows] = useState<number[]>([])
  const [rowDetails, setRowDetails] = useState<Record<number, any>>({})
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 30
  const [notesState, setNotesState] = useState<Record<number, string>>({})
  const [selectedPOs, setSelectedPOs] = useState<number[]>([])
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false)
  const [bulkPayments, setBulkPayments] = useState<BulkPayment[]>([])
  const [showBulkPaymentDetails, setShowBulkPaymentDetails] = useState<BulkPayment | null>(null)
  
  // Reject modal states
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectPO, setRejectPO] = useState<FinanceData | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  
  // View rejection notes modal states
  const [showViewRejectionModal, setShowViewRejectionModal] = useState(false)
  const [viewRejectionPO, setViewRejectionPO] = useState<FinanceData | null>(null)
  
  // Mobile states
  const [isMobileView, setIsMobileView] = useState(false)
  const [selectedMobileItem, setSelectedMobileItem] = useState<FinanceData | null>(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showImageModal, setShowImageModal] = useState<string | null>(null)
  
  // Scroll sync refs
  const topScrollRef = useRef<HTMLDivElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  // Filter states
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    supplier: '',
    selectedSuppliers: [] as string[],
    supplierSearch: '',
    showSupplierDropdown: false,
    branch: '',
    poStatus: '',
    paymentStatus: '',
    dueDate: '',
    goodsReceived: '',
    approvalStatus: ''
  })
  const [showFilters, setShowFilters] = useState(false)

  // Update URL when filters change
  const updateURL = useCallback(() => {
    const params = new URLSearchParams()
    
    if (search) params.set('search', search)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.supplier) params.set('supplier', filters.supplier)
    if (filters.selectedSuppliers.length > 0) params.set('suppliers', filters.selectedSuppliers.join(','))
    if (filters.branch) params.set('branch', filters.branch)
    if (filters.poStatus) params.set('poStatus', filters.poStatus)
    if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
    if (filters.dueDate) params.set('dueDate', filters.dueDate)
    if (filters.goodsReceived) params.set('goodsReceived', filters.goodsReceived)
    if (filters.approvalStatus) params.set('approvalStatus', filters.approvalStatus)
    if (currentPage > 1) params.set('page', currentPage.toString())
    
    const newUrl = params.toString() ? `?${params.toString()}` : '/finance/purchase-orders'
    router.replace(newUrl, { scroll: false })
  }, [search, filters, currentPage, router])

  // Preload critical data on mount
  useEffect(() => {
    // Preload suppliers and branches first (smaller datasets)
    Promise.all([fetchSuppliers(), fetchBranches()])
    
    // Check if returning from submit page
    const returnUrl = sessionStorage.getItem('finance_po_return_url')
    if (returnUrl && window.location.pathname + window.location.search === returnUrl) {
      // Restore filter state from sessionStorage
      const savedFilters = sessionStorage.getItem('finance_po_filters')
      const savedSearch = sessionStorage.getItem('finance_po_search')
      const savedPage = sessionStorage.getItem('finance_po_page')
      
      if (savedFilters) {
        setFilters(JSON.parse(savedFilters))
      }
      if (savedSearch) {
        setSearch(savedSearch)
      }
      if (savedPage) {
        setCurrentPage(parseInt(savedPage))
      }
      
      // Clear the return URL after restoring
      sessionStorage.removeItem('finance_po_return_url')
      sessionStorage.removeItem('finance_po_filters')
      sessionStorage.removeItem('finance_po_search')
      sessionStorage.removeItem('finance_po_page')
    }
    
    fetchBulkPayments()
  }, [])

  // Initialize filters from URL parameters
  useEffect(() => {
    if (!searchParams) return
    
    const urlFilters = {
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      supplier: searchParams.get('supplier') || '',
      selectedSuppliers: searchParams.get('suppliers') ? searchParams.get('suppliers')!.split(',') : [],
      supplierSearch: '',
      showSupplierDropdown: false,
      branch: searchParams.get('branch') || '',
      poStatus: searchParams.get('poStatus') || '',
      paymentStatus: searchParams.get('paymentStatus') || '',
      dueDate: searchParams.get('dueDate') || '',
      goodsReceived: searchParams.get('goodsReceived') || '',
      approvalStatus: searchParams.get('approvalStatus') || ''
    }
    
    const urlSearch = searchParams.get('search') || ''
    const urlPage = parseInt(searchParams.get('page') || '1')
    
    setFilters(urlFilters)
    setSearch(urlSearch)
    setCurrentPage(urlPage)
  }, [searchParams])

  // Fetch data when filters change
  useEffect(() => {
    if (suppliers.length > 0) { // Only fetch when suppliers are loaded
      fetchFinanceData()
    }
  }, [filters, suppliers])



  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Close supplier dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filters.showSupplierDropdown) {
        const target = event.target as Element
        if (!target.closest('.supplier-dropdown')) {
          setFilters(prev => ({...prev, showSupplierDropdown: false}))
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [filters.showSupplierDropdown])



  const fetchSuppliers = useCallback(async () => {
    const { data } = await supabase.from('suppliers').select('id_supplier, nama_supplier').order('nama_supplier')
    
    // Remove duplicates based on case-insensitive name comparison
    const uniqueSuppliers = (data || []).reduce((acc: any[], supplier) => {
      const normalizedName = supplier.nama_supplier.toLowerCase().trim()
      const existing = acc.find(s => s.nama_supplier.toLowerCase().trim() === normalizedName)
      
      if (existing) {
        // If duplicate found, combine the IDs
        existing.combined_ids = existing.combined_ids || [existing.id_supplier]
        existing.combined_ids.push(supplier.id_supplier)
      } else {
        acc.push({
          ...supplier,
          combined_ids: [supplier.id_supplier]
        })
      }
      return acc
    }, [])
    
    setSuppliers(uniqueSuppliers)
  }, [])

  const fetchBranches = useCallback(async () => {
    const { data } = await supabase.from('branches').select('id_branch, nama_branch').order('nama_branch')
    setBranches(data || [])
  }, [])

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
        .select('*, qty_tagih, harga_tagih')
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

  const toggleRowExpansion = useCallback(async (id: number) => {
    if (expandedRows.includes(id)) {
      setExpandedRows(expandedRows.filter(rowId => rowId !== id))
    } else {
      setExpandedRows([...expandedRows, id])
      if (!rowDetails[id]) {
        await fetchRowDetails(id)
      }
    }
  }, [expandedRows, rowDetails])

  // Save state whenever search changes
  useEffect(() => {
    if (search !== '') {
      const currentUrl = new URL(window.location.href)
      sessionStorage.setItem('finance_po_return_url', currentUrl.pathname + currentUrl.search)
      sessionStorage.setItem('finance_po_filters', JSON.stringify(filters))
      sessionStorage.setItem('finance_po_search', search)
      sessionStorage.setItem('finance_po_page', currentPage.toString())
    }
  }, [search, filters, currentPage])

  // Update URL when filters or search change
  // amazonq-ignore-next-line
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateURL()
    }, 800) // Debounce URL updates
    
    return () => clearTimeout(timeoutId)
  }, [updateURL])

  // Memoized filtered data for better performance
  // amazonq-ignore-next-line
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = debouncedSearch === '' || 
        item.po_number.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (item.nama_supplier || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (item.nama_branch || '').toLowerCase().includes(debouncedSearch.toLowerCase())
      
      return matchesSearch
    })
  }, [data, debouncedSearch])

  // Memoized paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredData, currentPage, itemsPerPage])

  const fetchFinanceData = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('finance_dashboard_view')
        .select('*')
        .order('po_date', { ascending: false })

      // Apply filters
      if (filters.dateFrom) query = query.gte('po_date', filters.dateFrom)
      if (filters.dateTo) query = query.lte('po_date', filters.dateTo)
      if (filters.supplier) query = query.eq('supplier_id', filters.supplier)
      if (filters.selectedSuppliers.length > 0) {
        // Get all combined IDs from selected suppliers
        const allSupplierIds = filters.selectedSuppliers.flatMap(selectedId => {
          const supplier = suppliers.find(s => s.id_supplier.toString() === selectedId)
          // amazonq-ignore-next-line
          console.log('Processing selected supplier ID:', selectedId, 'Found supplier:', supplier)
          return supplier?.combined_ids || [parseInt(selectedId)]
        })
        console.log('Selected suppliers:', filters.selectedSuppliers)
        console.log('All supplier IDs for filter:', allSupplierIds)
        if (allSupplierIds.length > 0) {
          query = query.in('supplier_id', allSupplierIds)
        }
      }
      if (filters.branch) query = query.eq('cabang_id', filters.branch)
      if (filters.poStatus) query = query.eq('po_status', filters.poStatus)
      if (filters.dueDate === 'overdue') query = query.eq('is_overdue', true)
      if (filters.goodsReceived === 'received') query = query.not('tanggal_barang_sampai', 'is', null)
      if (filters.goodsReceived === 'not_received') query = query.is('tanggal_barang_sampai', null)

      const { data: financeData, error } = await query
      if (error) throw error

      // Batch queries - ambil semua data sekaligus
      const poIds = financeData.map(item => item.id)
      const poNumbers = financeData.map(item => item.po_number)
      
      // Split poIds into chunks to avoid Supabase limit
      const chunkSize = 50
      const poIdChunks = []
      for (let i = 0; i < poIds.length; i += chunkSize) {
        poIdChunks.push(poIds.slice(i, i + chunkSize))
      }
      
      // Fetch po_items in chunks
      const itemsDataChunks = await Promise.all(
        poIdChunks.map(chunk => 
          supabase.from('po_items').select('po_id, qty, harga, actual_price, received_qty, product_id, qty_tagih, harga_tagih').in('po_id', chunk)
        )
      )
      
      // Combine all items data
      const allItemsData = itemsDataChunks.reduce((acc: any[], chunk) => {
        if (chunk.data) acc.push(...chunk.data)
        return acc
      }, [])
      
      const itemsData = { data: allItemsData, error: null }
      
      // amazonq-ignore-next-line
      const [paymentsData, poDetailsData, barangMasukData, bulkPaymentsData, paymentTermsData, usersData] = await Promise.all([
        supabase.from('po_payments').select('po_id, payment_amount, payment_date, payment_via, payment_method, reference_number, status').in('po_id', poIds).order('payment_date', { ascending: false }),
        supabase.from('purchase_orders').select('id, bulk_payment_ref, total_tagih, keterangan, approval_photo, approval_status, approved_at, rejected_at, rejection_notes, id_payment_term, approved_by, rejected_by').in('id', poIds),
        supabase.from('barang_masuk').select('no_po, invoice_number').in('no_po', poNumbers).not('invoice_number', 'is', null),
        supabase.from('bulk_payments').select('*'),
        supabase.from('payment_terms').select('id_payment_term, term_name, calculation_type, days'),
        supabase.from('users').select('id_user, nama_lengkap')
      ])
      

      


      // Group data by po_id
      const itemsByPO: Record<number, any[]> = {}
      itemsData.data?.forEach(item => {
        if (!itemsByPO[item.po_id]) itemsByPO[item.po_id] = []
        itemsByPO[item.po_id].push(item)
      })

      const paymentsByPO: Record<number, any[]> = {}
      paymentsData.data?.forEach(payment => {
        if (payment.status === 'completed') {
          if (!paymentsByPO[payment.po_id]) paymentsByPO[payment.po_id] = []
          paymentsByPO[payment.po_id].push(payment)
        }
      })

      const poDetailsMap: Record<number, any> = {}
      poDetailsData.data?.forEach(po => { poDetailsMap[po.id] = po })

      const invoiceMap: Record<string, string> = {}
      barangMasukData.data?.forEach(bm => { 
        if (bm.invoice_number && bm.invoice_number.trim()) {
          // Always use the latest invoice (overwrite if exists)
          invoiceMap[bm.no_po] = bm.invoice_number 
        }
      })
      


      // Create bulk payments map
      const bulkPaymentsMap: Record<string, any> = {}
      bulkPaymentsData.data?.forEach(bp => { bulkPaymentsMap[bp.bulk_reference] = bp })

      // Create payment terms map
      const paymentTermsMap: Record<number, any> = {}
      paymentTermsData.data?.forEach(pt => { paymentTermsMap[pt.id_payment_term] = pt })
      
      // Create users map
      const usersMap: Record<number, any> = {}
      usersData.data?.forEach(user => { usersMap[user.id_user] = user })
      


      // Process data dengan perhitungan KAMU (tidak berubah)
      const correctedData = financeData.map((item: any) => {
        const items = itemsByPO[item.id] || []
        const payments = paymentsByPO[item.id] || []
        const poData = poDetailsMap[item.id]
        const invoiceNumber = invoiceMap[item.po_number]

        // Calculate total PO using original PO price (harga), not actual_price
        const correctedTotal = items.reduce((sum, poItem) => {
          const qty = parseFloat(poItem.qty) || 0
          const harga = parseFloat(poItem.harga) || 0
          const itemTotal = qty * harga
          return sum + itemTotal
        }, 0)
        


        // Calculate payments (logic kamu)
        const totalPaid = payments.reduce((sum, p) => sum + p.payment_amount, 0)
        const latestPayment = payments[0] || null
        const totalTagih = poData?.total_tagih || 0
        const basisAmount = totalTagih > 0 ? totalTagih : correctedTotal
        
        // Calculate status (logic kamu)
        let calculatedStatus = 'unpaid'
        if (poData?.bulk_payment_ref) {
          calculatedStatus = 'paid'
        } else {
          calculatedStatus = totalPaid === 0 ? 'unpaid' : totalPaid >= basisAmount ? 'paid' : 'partial'
        }
        
        // Apply filters (logic kamu)
        if (filters.paymentStatus && calculatedStatus !== filters.paymentStatus) return null
        if (filters.approvalStatus && poData?.approval_status !== filters.approvalStatus) return null
        
        let sisaBayar = basisAmount - totalPaid
        let displayTotalPaid = totalPaid
        
        if (poData?.bulk_payment_ref) {
          sisaBayar = 0
          displayTotalPaid = basisAmount
        }

        // Get payment info from bulk payment if exists, otherwise from latest payment
        const bulkPayment = poData?.bulk_payment_ref ? bulkPaymentsMap[poData.bulk_payment_ref] : null
        
        // Get payment term info
        const paymentTerm = poData?.id_payment_term ? paymentTermsMap[poData.id_payment_term] : null
        
        return {
          ...item,
          total_po: correctedTotal,
          total_paid: displayTotalPaid,
          sisa_bayar: sisaBayar,
          status_payment: calculatedStatus,
          is_overdue: calculatedStatus === 'paid' ? false : item.is_overdue,
          days_overdue: calculatedStatus === 'paid' ? 0 : item.days_overdue,
          dibayar_tanggal: bulkPayment?.payment_date || latestPayment?.payment_date || null,
          payment_via: bulkPayment?.payment_via || latestPayment?.payment_via || null,
          payment_method: bulkPayment?.payment_method || latestPayment?.payment_method || null,
          payment_reference: poData?.bulk_payment_ref || latestPayment?.reference_number || null,
          invoice_number: invoiceNumber || '',
          total_tagih: totalTagih,
          keterangan: poData?.keterangan || '',
          approval_photo: poData?.approval_photo || null,
          approval_status: poData?.approval_status || null,
          approved_at: poData?.approved_at || null,
          approved_by: poData?.approved_by || null,
          approved_by_name: poData?.approved_by ? (usersMap[poData.approved_by]?.nama_lengkap || `User ${poData.approved_by} (not found)`) : null,
          rejected_at: poData?.rejected_at || null,
          rejected_by: poData?.rejected_by || null,
          rejected_by_name: null, // Will be populated separately
          rejection_notes: poData?.rejection_notes || null,
          bulk_payment_ref: poData?.bulk_payment_ref || null,
          payment_term_name: paymentTerm?.term_name || null,
          payment_term_type: paymentTerm?.calculation_type || null
        }
      }).filter(item => item !== null)

      // Get rejected_by names for rejected POs
      const rejectedPOs = correctedData.filter(item => item.rejected_by)
      if (rejectedPOs.length > 0) {
        const rejectedByIds = [...new Set(rejectedPOs.map(item => item.rejected_by))]
        const { data: rejectedUsers } = await supabase
          .from('users')
          .select('auth_id, nama_lengkap')
          .in('auth_id', rejectedByIds)
        
        const rejectedUsersMap: Record<string, string> = {}
        rejectedUsers?.forEach(user => {
          rejectedUsersMap[user.auth_id] = user.nama_lengkap
        })
        
        // Update rejected_by_name
        correctedData.forEach(item => {
          if (item.rejected_by) {
            item.rejected_by_name = rejectedUsersMap[item.rejected_by] || null
          }
        })
      }
      
      setData(correctedData)

      // Initialize notes
      const newNotesState: Record<number, string> = {}
      correctedData.forEach(item => {
        const defaultNotes = item.nama_branch === 'Sushimas Harapan Indah' ? 'Rek CV' : 'Rek PT'
        newNotesState[item.id] = item.notes || defaultNotes
      })
      setNotesState(newNotesState)
      
    } catch (error) {
      console.error('Error:', error)
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
                         (item.nama_supplier || '').toLowerCase().includes(search.toLowerCase()) ||
                         (item.nama_branch || '').toLowerCase().includes(search.toLowerCase())
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
  const currentPageData = allFilteredData.slice(startIndex, startIndex + itemsPerPage)

  const clearFilters = () => {
    const clearedFilters = {
      dateFrom: '',
      dateTo: '',
      supplier: '',
      selectedSuppliers: [],
      supplierSearch: '',
      showSupplierDropdown: false,
      branch: '',
      poStatus: '',
      paymentStatus: '',
      dueDate: '',
      goodsReceived: '',
      approvalStatus: ''
    }
    setFilters(clearedFilters)
    setSearch('')
    setCurrentPage(1)
    
    // Clear URL parameters
    router.replace('/finance/purchase-orders', { scroll: false })
  }

  const applyFilters = () => {
    console.log('Applying filters:', filters)
    console.log('Available suppliers:', suppliers)
    setLoading(true)
    setCurrentPage(1)
    
    // Save current state whenever filters are applied
    const currentUrl = new URL(window.location.href)
    sessionStorage.setItem('finance_po_return_url', currentUrl.pathname + currentUrl.search)
    sessionStorage.setItem('finance_po_filters', JSON.stringify(filters))
    sessionStorage.setItem('finance_po_search', search)
    sessionStorage.setItem('finance_po_page', '1')
    
    // Update URL immediately when applying filters
    updateURL()
    
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

  // Approval Photo Thumbnail Component
  const ApprovalPhotoThumbnail = ({ po }: { po: any }) => {
    if (!po.approval_photo) {
      return <span className="text-gray-400 text-xs">-</span>
    }

    const imageUrl = `${supabase.storage.from('po-photos').getPublicUrl(po.approval_photo).data.publicUrl}`

    return (
      <div 
        className="cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setShowImageModal(po.id.toString())}
      >
        <img 
          src={imageUrl}
          alt="Approval"
          className="w-12 h-12 object-cover rounded border border-gray-300"
        />
        <div className="text-xs text-gray-500 mt-1 text-center">
          📷 View
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    // amazonq-ignore-next-line
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
        'Payment Term': (item as any).payment_term_name || `${(item as any).termin_days || 30} hari`,
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
    // amazonq-ignore-next-line
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
        item.is_overdue && item.status_payment !== 'paid' ? 'border-red-200' : 'border-gray-200'
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
            {(item as any).approval_status === 'rejected' && (
              <div className="text-xs text-red-600 mt-1 flex items-center">
                <X className="h-3 w-3 mr-1" />
                Rejected {(item as any).rejected_at ? `- ${formatDate((item as any).rejected_at)}` : ''}
                {(item as any).rejection_notes && (
                  <span className="ml-1" title={(item as any).rejection_notes}>
                    (Ada catatan)
                  </span>
                )}
              </div>
            )}
            {item.is_overdue && item.status_payment !== 'paid' && (
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
              <button
                onClick={() => {
                  // Save current state before navigating
                  const currentUrl = new URL(window.location.href)
                  sessionStorage.setItem('finance_po_return_url', currentUrl.pathname + currentUrl.search)
                  sessionStorage.setItem('finance_po_filters', JSON.stringify(filters))
                  sessionStorage.setItem('finance_po_search', search)
                  sessionStorage.setItem('finance_po_page', currentPage.toString())
                  window.location.href = `/finance/purchase-orders/submit-approval?id=${item.id}`
                }}
                className="inline-flex items-center p-1 border border-transparent rounded-md text-white bg-green-600 hover:bg-green-700"
                title="Submit Total Tagih"
              >
                <FileText className="h-3 w-3" />
              </button>
              {(item as any).approval_status === 'pending' && (
                <>
                  <button
                    onClick={async () => {
                      try {
                        // Get current user from Supabase Auth
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) throw new Error('User not authenticated')
                        
                        // Get user ID from users table using email
                        const { data: userData, error: userError } = await supabase
                          .from('users')
                          .select('id_user')
                          .eq('email', user.email)
                          .single()
                        
                        if (userError) throw userError
                        
                        const { error } = await supabase
                          .from('purchase_orders')
                          .update({ 
                            approval_status: 'approved',
                            approved_at: new Date().toISOString(),
                            approved_by: userData?.id_user || null,
                            rejection_notes: null,
                            rejected_at: null
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
                  <button
                    onClick={() => {
                      setRejectPO(item)
                      setShowRejectModal(true)
                    }}
                    className="inline-flex items-center p-1 border border-transparent rounded-md text-white bg-red-600 hover:bg-red-700"
                    title="Reject"
                  >
                    <AlertCircle className="h-3 w-3" />
                  </button>
                </>
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
              {((item.total_paid > 0 && !(item as any).bulk_payment_ref) || (item as any).bulk_payment_ref) && (
                <button
                  onClick={() => {
                    if ((item as any).bulk_payment_ref) {
                      // For bulk payments, redirect to bulk payments page with ref parameter
                      router.push(`/finance/bulk-payments?ref=${(item as any).bulk_payment_ref}`)
                    } else {
                      // For single payments, open payment modal
                      setSelectedPO(item)
                      setShowPaymentModal(true)
                    }
                  }}
                  className="inline-flex items-center p-1 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  title={`${(item as any).bulk_payment_ref ? 'View Bulk Payment' : 'Edit Payment'}`}
                >
                  <Edit className="h-3 w-3" />
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
                  Items yang Diterima
                </h3>
                {rowDetails[item.id]?.items?.length > 0 ? (
                  <div className="bg-white rounded border border-gray-200 overflow-hidden">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium text-gray-500">Produk</th>
                          <th className="px-2 py-1 text-center font-medium text-gray-500">Qty PO</th>
                          <th className="px-2 py-1 text-center font-medium text-gray-500">Qty Diterima</th>
                          <th className="px-2 py-1 text-right font-medium text-gray-500">Harga PO</th>
                          <th className="px-2 py-1 text-right font-medium text-gray-500">Harga Aktual</th>
                          <th className="px-2 py-1 text-right font-medium text-gray-500">Total</th>
                          <th className="px-2 py-1 text-left font-medium text-gray-500">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {rowDetails[item.id].items.slice(0, 3).map((poItem: any) => (
                          <tr key={poItem.id}>
                            <td className="px-2 py-1 font-medium">{poItem.product_name || `Product ${poItem.product_id}`}</td>
                            <td className="px-2 py-1 text-center">{poItem.qty}</td>
                            <td className="px-2 py-1 text-center">{poItem.received_qty || poItem.qty}</td>
                            <td className="px-2 py-1 text-right">{formatCurrency(poItem.harga || 0)}</td>
                            <td className="px-2 py-1 text-right">{formatCurrency(poItem.actual_price || poItem.harga || 0)}</td>
                            <td className="px-2 py-1 text-right font-medium">{formatCurrency((poItem.received_qty || poItem.qty) * (poItem.actual_price || poItem.harga || 0))}</td>
                            <td className="px-2 py-1">Status: {poItem.received_qty ? 'received' : 'pending'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 border-t border-gray-300">
                        <tr>
                          <td className="px-2 py-1 text-xs font-bold" colSpan={5}>Total PO:</td>
                          <td className="px-2 py-1 text-right text-xs font-bold">
                            {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                              sum + (parseFloat(poItem.qty) || 0) * (parseFloat(poItem.harga) || 0), 0
                            ))}
                          </td>
                          <td className="px-2 py-1"></td>
                        </tr>
                        <tr>
                          <td className="px-2 py-1 text-xs font-bold" colSpan={5}>Total Aktual:</td>
                          <td className="px-2 py-1 text-right text-xs font-bold">
                            {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                              sum + (parseFloat(poItem.received_qty) || parseFloat(poItem.qty) || 0) * (parseFloat(poItem.actual_price) || parseFloat(poItem.harga) || 0), 0
                            ))}
                          </td>
                          <td className="px-2 py-1"></td>
                        </tr>
                      </tfoot>
                    </table>
                    {rowDetails[item.id].items.length > 3 && (
                      <p className="text-xs text-gray-500 text-center py-2">
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

              {/* Foto Approval */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Foto Approval
                </h3>
                {(item as any).approval_photo ? (
                  <div className="bg-white rounded border border-gray-200 overflow-hidden">
                    <img 
                      src={`${supabase.storage.from('po-photos').getPublicUrl((item as any).approval_photo).data.publicUrl}`}
                      alt="Approval Photo"
                      className="w-full h-32 object-cover cursor-pointer hover:opacity-80"
                      onClick={() => window.open(`${supabase.storage.from('po-photos').getPublicUrl((item as any).approval_photo).data.publicUrl}`, '_blank')}
                    />
                    <div className="p-2 text-xs text-gray-500">
                      <p>Status: {(item as any).approval_status || 'pending'}</p>
                      <p>Total Tagih: {formatCurrency((item as any).total_tagih || 0)}</p>
                      {(item as any).keterangan && <p>Keterangan: {(item as any).keterangan}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Belum ada foto approval</p>
                )}
              </div>

              {/* Rincian Items PO */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Rincian Items PO
                </h3>
                {rowDetails[item.id]?.items?.length > 0 ? (
                  <div className="bg-white rounded border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium text-gray-500">Produk</th>
                            <th className="px-2 py-1 text-center font-medium text-gray-500">Qty PO</th>
                            <th className="px-2 py-1 text-center font-medium text-gray-500">Qty Diterima</th>
                            <th className="px-2 py-1 text-center font-medium text-gray-500">Qty Tagih</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-500">Harga PO</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-500">Harga Diterima</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-500">Harga Tagih</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-500">Total PO</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-500">Total Aktual</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-500">Total Tagih</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {rowDetails[item.id].items.map((poItem: any) => (
                            <tr key={poItem.id}>
                              <td className="px-2 py-1 font-medium">{poItem.product_name || `Product ${poItem.product_id}`}</td>
                              <td className="px-2 py-1 text-center">{poItem.qty}</td>
                              <td className="px-2 py-1 text-center">{poItem.received_qty || poItem.qty}</td>
                              <td className="px-2 py-1 text-center">{poItem.qty_tagih || poItem.received_qty || poItem.qty}</td>
                              <td className="px-2 py-1 text-right">{formatCurrency(poItem.harga || 0)}</td>
                              <td className="px-2 py-1 text-right">{formatCurrency(poItem.actual_price || poItem.harga || 0)}</td>
                              <td className="px-2 py-1 text-right">{formatCurrency(poItem.harga_tagih || poItem.actual_price || poItem.harga || 0)}</td>
                              <td className="px-2 py-1 text-right font-medium">{formatCurrency((poItem.qty) * (poItem.harga || 0))}</td>
                              <td className="px-2 py-1 text-right font-medium">{formatCurrency((poItem.received_qty || poItem.qty) * (poItem.actual_price || poItem.harga || 0))}</td>
                              <td className="px-2 py-1 text-right font-medium">{formatCurrency((poItem.qty_tagih || poItem.received_qty || poItem.qty) * (poItem.harga_tagih || poItem.actual_price || poItem.harga || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t border-gray-300">
                          <tr>
                            <td className="px-2 py-1 text-xs font-bold" colSpan={7}>TOTAL:</td>
                            <td className="px-2 py-1 text-right text-xs font-bold">
                              {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                                sum + (parseFloat(poItem.qty) || 0) * (parseFloat(poItem.harga) || 0), 0
                              ))}
                            </td>
                            <td className="px-2 py-1 text-right text-xs font-bold">
                              {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                                sum + (parseFloat(poItem.received_qty) || parseFloat(poItem.qty) || 0) * (parseFloat(poItem.actual_price) || parseFloat(poItem.harga) || 0), 0
                              ))}
                            </td>
                            <td className="px-2 py-1 text-right text-xs font-bold">
                              {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                                sum + (parseFloat(poItem.qty_tagih) || parseFloat(poItem.received_qty) || parseFloat(poItem.qty) || 0) * (parseFloat(poItem.harga_tagih) || parseFloat(poItem.actual_price) || parseFloat(poItem.harga) || 0), 0
                              ))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Tidak ada item</p>
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
              Items yang Diterima
            </h3>
            {rowDetails[item.id]?.items?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border border-gray-200 rounded">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 border-b">Produk</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500 border-b">Qty PO</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500 border-b">Qty Diterima</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 border-b">Harga PO</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 border-b">Harga Aktual</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 border-b">Total</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 border-b">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rowDetails[item.id].items.map((poItem: any) => (
                      <tr key={poItem.id}>
                        <td className="px-3 py-2 font-medium">{poItem.product_name || `Product ${poItem.product_id}`}</td>
                        <td className="px-3 py-2 text-center">{poItem.qty}</td>
                        <td className="px-3 py-2 text-center">{poItem.received_qty || poItem.qty}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(poItem.harga || 0)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(poItem.actual_price || poItem.harga || 0)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency((poItem.received_qty || poItem.qty) * (poItem.actual_price || poItem.harga || 0))}</td>
                        <td className="px-3 py-2">Status: {poItem.received_qty ? 'received' : 'pending'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t border-gray-300">
                    <tr>
                      <td className="px-3 py-2 text-xs font-bold" colSpan={4}>Total PO:</td>
                      <td className="px-3 py-2 text-right text-xs font-bold">
                        {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                          sum + (parseFloat(poItem.qty) || 0) * (parseFloat(poItem.harga) || 0), 0
                        ))}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold">
                        {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                          sum + (parseFloat(poItem.received_qty) || parseFloat(poItem.qty) || 0) * (parseFloat(poItem.actual_price) || parseFloat(poItem.harga) || 0), 0
                        ))}
                      </td>
                      <td className="px-3 py-2"></td>
                    </tr>
                  </tfoot>
                </table>
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
            {item.total_paid > 0 && (
              <button
                onClick={async () => {
                  try {
                    const jsPDF = (await import('jspdf')).default
                    const doc = new jsPDF()
                    
                    // Get company data from branches table
                    const { data: branchData } = await supabase
                      .from('branches')
                      .select('badan')
                      .eq('id_branch', (item as any).cabang_id)
                      .single()
                    
                    const companyName = branchData?.badan || 'PT. Suryamas Pratama'
                    const paymentDate = (item as any).dibayar_tanggal 
                      ? formatDate((item as any).dibayar_tanggal)
                      : new Date().toLocaleDateString('id-ID')
                    
                    const bankInfo = (item as any).payment_method && (item as any).payment_via
                      ? `${(item as any).payment_method} - ${(item as any).payment_via}`
                      : ''
                    
                    // Header
                    doc.setFontSize(16)
                    doc.setFont('helvetica', 'bold')
                    doc.text(companyName, 105, 20, { align: 'center' })
                    
                    doc.setFontSize(14)
                    doc.text('BUKTI PENGELUARAN', 105, 35, { align: 'center' })
                    
                    doc.setFont('helvetica', 'normal')
                    doc.setFontSize(10)
                    doc.text(`Tanggal: ${paymentDate}`, 20, 50)
                    doc.text(`Supplier: ${item.nama_supplier}`, 20, 60)
                    doc.text('Nomor Bukti: _______________', 20, 70)
                    
                    // Table Header
                    const tableStartY = 90
                    doc.setFont('helvetica', 'bold')
                    doc.rect(20, tableStartY, 170, 10)
                    doc.text('COA', 25, tableStartY + 7)
                    doc.text('Deskripsi', 85, tableStartY + 7)
                    doc.text('Nominal', 170, tableStartY + 7)
                    
                    // Table Content
                    doc.setFont('helvetica', 'normal')
                    const rowY = tableStartY + 10
                    doc.rect(20, rowY, 170, 15)
                    doc.text('', 25, rowY + 10)
                    const description = (item as any).invoice_number 
                      ? `Pembayaran untuk invoice ${(item as any).invoice_number} dari supplier ${item.nama_supplier}`
                      : `${item.po_number} - ${item.nama_supplier}`
                    doc.text(description, 50, rowY + 10)
                    doc.text(formatCurrency(item.total_paid), 168, rowY + 10)
                    
                    // Total
                    const totalY = rowY + 15
                    doc.rect(20, totalY, 170, 10)
                    doc.setFont('helvetica', 'bold')
                    doc.text('TOTAL', 55, totalY + 7)
                    doc.text(formatCurrency(item.total_paid), 168, totalY + 7)
                    
                    // Signature Section
                    const signY = totalY + 40
                    doc.setFont('helvetica', 'normal')
                    doc.text('Dibuat,', 30, signY)
                    doc.text('Disetujui,', 90, signY)
                    doc.text('Bank,', 150, signY)
                    if (bankInfo) {
                      doc.text(bankInfo, 150, signY + 10)
                    }
                    
                    // Signature lines
                    doc.line(20, signY + 30, 70, signY + 30)
                    doc.line(80, signY + 30, 130, signY + 30)
                    doc.line(140, signY + 30, 190, signY + 30)
                    
                    // Names under signature lines
                    doc.text('Khoirun Nisa', 30, signY + 40)
                    doc.text('Raymond', 90, signY + 40)
                    
                    doc.save(`bukti-pengeluaran-${item.po_number}-${new Date().toISOString().split('T')[0]}.pdf`)
                  } catch (error) {
                    console.error('Error exporting PDF:', error)
                    alert('Gagal export PDF')
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 flex items-center justify-center"
              >
                <Download className="h-4 w-4 mr-1" />
                Export PDF
              </button>
            )}
            <button
              onClick={() => {
                // Save current state before navigating
                const currentUrl = new URL(window.location.href)
                sessionStorage.setItem('finance_po_return_url', currentUrl.pathname + currentUrl.search)
                sessionStorage.setItem('finance_po_filters', JSON.stringify(filters))
                sessionStorage.setItem('finance_po_search', search)
                sessionStorage.setItem('finance_po_page', currentPage.toString())
                window.location.href = `/finance/purchase-orders/submit-approval?id=${item.id}`
              }}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="h-4 w-4 mr-1" />
              Submit
            </button>
            {(item as any).approval_status === 'pending' && (
              <>
                <button
                  onClick={async () => {
                    try {
                      // Get current user from localStorage or Supabase Auth
                      let userId = null
                      try {
                        const { data: { user } } = await supabase.auth.getUser()
                        if (user) {
                          const { data: userData } = await supabase
                            .from('users')
                            .select('id_user')
                            .eq('email', user.email)
                            .single()
                          userId = userData?.id_user
                        }
                      } catch (authError) {
                        console.warn('Auth error, using localStorage:', authError)
                      }
                      
                      if (!userId) {
                        const localUser = JSON.parse(localStorage.getItem('user') || '{}')
                        userId = localUser.id_user || null
                      }
                      
                      const { error } = await supabase
                        .from('purchase_orders')
                        .update({ 
                          approval_status: 'approved',
                          approved_at: new Date().toISOString(),
                          approved_by: userId,
                          rejection_notes: null,
                          rejected_at: null
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
                <button
                  onClick={() => {
                    setRejectPO(item)
                    setShowRejectModal(true)
                    setSelectedMobileItem(null)
                  }}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Reject
                </button>
              </>
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
            {((item.total_paid > 0 && !(item as any).bulk_payment_ref) || (item as any).bulk_payment_ref) && (
              <button
                onClick={() => {
                  if ((item as any).bulk_payment_ref) {
                    // For bulk payments, redirect to bulk payments page with ref parameter
                    router.push(`/finance/bulk-payments?ref=${(item as any).bulk_payment_ref}`)
                  } else {
                    // For single payments, open payment modal
                    setSelectedPO(item)
                    setShowPaymentModal(true)
                    setSelectedMobileItem(null)
                  }
                }}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="h-4 w-4 mr-1" />
                {(item as any).bulk_payment_ref ? 'View Bulk' : 'Edit Payment'}
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
              <div className="relative supplier-dropdown">
                <button
                  type="button"
                  onClick={() => setFilters({...filters, showSupplierDropdown: !filters.showSupplierDropdown})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm text-left bg-white flex items-center justify-between"
                >
                  <span className="truncate">
                    {filters.selectedSuppliers.length === 0 
                      ? 'Pilih Supplier' 
                      : `${filters.selectedSuppliers.length} supplier dipilih`
                    }
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                
                {filters.showSupplierDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-gray-200">
                      <input
                        type="text"
                        placeholder="Cari supplier..."
                        value={filters.supplierSearch}
                        onChange={(e) => setFilters({...filters, supplierSearch: e.target.value})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {suppliers
                        .filter(supplier => 
                          supplier.nama_supplier.toLowerCase().includes(filters.supplierSearch.toLowerCase())
                        )
                        .map(supplier => (
                          <label key={supplier.id_supplier} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filters.selectedSuppliers.includes(supplier.id_supplier.toString())}
                              onChange={(e) => {
                                const supplierId = supplier.id_supplier.toString()
                                console.log('Checkbox changed:', supplierId, e.target.checked)
                                if (e.target.checked) {
                                  const newSelected = [...filters.selectedSuppliers, supplierId]
                                  console.log('New selected suppliers:', newSelected)
                                  setFilters({
                                    ...filters,
                                    selectedSuppliers: newSelected
                                  })
                                } else {
                                  const newSelected = filters.selectedSuppliers.filter(id => id !== supplierId)
                                  console.log('New selected suppliers after removal:', newSelected)
                                  setFilters({
                                    ...filters,
                                    selectedSuppliers: newSelected
                                  })
                                }
                              }}
                              className="rounded border-gray-300 mr-2"
                            />
                            <span className="text-sm truncate">{supplier.nama_supplier}</span>
                          </label>
                        ))
                      }
                      {suppliers.filter(supplier => 
                        supplier.nama_supplier.toLowerCase().includes(filters.supplierSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Tidak ada supplier ditemukan</div>
                      )}
                    </div>
                    <div className="p-2 border-t border-gray-200 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFilters({...filters, selectedSuppliers: []})}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Clear All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const allSupplierIds = suppliers.map(s => s.id_supplier.toString())
                          setFilters({...filters, selectedSuppliers: allSupplierIds})
                        }}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Select All
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                    <div className="text-xs text-blue-700 mt-1">
                      Total: {formatCurrency(selectedPOs.reduce((sum, poId) => {
                        const po = data.find(item => item.id === poId)
                        return sum + (po?.sisa_bayar || 0)
                      }, 0))}
                    </div>
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
              
              {/* Quick Filter Buttons - Mobile */}
              <div className="flex flex-col gap-3 mb-3">
                {/* Status Filter Buttons */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Status PO:</label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => {
                        const newFilters = {...filters, poStatus: ''}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.poStatus === '' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, poStatus: 'Pending'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.poStatus === 'Pending' 
                          ? 'bg-yellow-600 text-white border-yellow-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, poStatus: 'Sedang diproses'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.poStatus === 'Sedang diproses' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Diproses
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, poStatus: 'Barang sampai'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.poStatus === 'Barang sampai' 
                          ? 'bg-green-600 text-white border-green-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Sampai
                    </button>
                  </div>
                </div>
                
                {/* Payment Status Filter Buttons */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Payment Status:</label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => {
                        const newFilters = {...filters, paymentStatus: ''}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.paymentStatus === '' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, paymentStatus: 'unpaid'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.paymentStatus === 'unpaid' 
                          ? 'bg-red-600 text-white border-red-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Unpaid
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, paymentStatus: 'partial'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.paymentStatus === 'partial' 
                          ? 'bg-yellow-600 text-white border-yellow-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Partial
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, paymentStatus: 'paid'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.paymentStatus === 'paid' 
                          ? 'bg-green-600 text-white border-green-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Paid
                    </button>
                  </div>
                </div>
                
                {/* Approval Status Filter Buttons */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Approval Status:</label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => {
                        const newFilters = {...filters, approvalStatus: ''}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.approvalStatus === '' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, approvalStatus: 'pending'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.approvalStatus === 'pending' 
                          ? 'bg-orange-600 text-white border-orange-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, approvalStatus: 'approved'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.approvalStatus === 'approved' 
                          ? 'bg-purple-600 text-white border-purple-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Approved
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, approvalStatus: 'rejected'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.approvalStatus === 'rejected' 
                          ? 'bg-red-600 text-white border-red-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Rejected
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                >
                  <Filter size={16} />
                  More Filters
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

          {/* Reject Modal - Mobile */}
          {showRejectModal && rejectPO && (
            <RejectModal
              po={rejectPO}
              onClose={() => {
                setShowRejectModal(false)
                setRejectPO(null)
                setRejectNotes('')
              }}
              onSuccess={() => {
                fetchFinanceData()
              }}
            />
          )}

          {/* View Rejection Notes Modal - Mobile */}
          {showViewRejectionModal && viewRejectionPO && (
            <ViewRejectionNotesModal
              po={viewRejectionPO}
              onClose={() => {
                setShowViewRejectionModal(false)
                setViewRejectionPO(null)
              }}
            />
          )}

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
                        // Get current user from localStorage or Supabase Auth
                        let userId = null
                        try {
                          const { data: { user } } = await supabase.auth.getUser()
                          if (user) {
                            const { data: userData, error: userError } = await supabase
                              .from('users')
                              .select('id_user')
                              .eq('email', user.email)
                              .single()
                            
                            if (!userError && userData) {
                              userId = userData.id_user
                            }
                          }
                        } catch (authError) {
                          console.warn('Auth error, using localStorage:', authError)
                        }
                        
                        if (!userId) {
                          const localUser = JSON.parse(localStorage.getItem('user') || '{}')
                          userId = localUser.id_user || null
                        }
                        
                        if (!userId) {
                          throw new Error('User not authenticated. Please login again.')
                        }
                        
                        const updatePromises = selectedPOs.map(poId => 
                          supabase
                            .from('purchase_orders')
                            .update({ 
                              approval_status: 'approved',
                              approved_at: new Date().toISOString(),
                              approved_by: userId,
                              rejection_notes: null,
                              rejected_at: null
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
                    onClick={async () => {
                      try {
                        const notes = prompt('Masukkan alasan penolakan untuk semua PO yang dipilih:')
                        if (notes === null) return // User cancelled
                        
                        if (!notes.trim()) {
                          alert('Harap masukkan alasan penolakan')
                          return
                        }

                        // Get current user from localStorage or Supabase Auth
                        let currentUser = null
                        try {
                          const { data: { user } } = await supabase.auth.getUser()
                          currentUser = user
                        } catch (authError) {
                          console.warn('Auth error, using localStorage:', authError)
                        }
                        
                        if (!currentUser) {
                          const localUser = JSON.parse(localStorage.getItem('user') || '{}')
                          currentUser = { id: localUser.auth_id || null }
                        }
                        
                        if (!currentUser?.id) {
                          throw new Error('User not authenticated. Please login again.')
                        }
                        
                        const updatePromises = selectedPOs.map(poId => 
                          supabase
                            .from('purchase_orders')
                            .update({ 
                              approval_status: 'rejected',
                              rejected_at: new Date().toISOString(),
                              rejection_notes: notes.trim(),
                              rejected_by: currentUser.id
                            })
                            .eq('id', poId)
                        )
                        await Promise.all(updatePromises)
                        fetchFinanceData()
                        alert(`${selectedPOs.length} PO berhasil ditolak`)
                      } catch (error) {
                        console.error('Error bulk rejecting:', error)
                        alert('Gagal melakukan bulk rejection')
                      }
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs sm:text-sm"
                    disabled={!data.filter(item => selectedPOs.includes(item.id)).some(item => (item as any).approval_status === 'pending')}
                  >
                    <span className="hidden sm:inline">Bulk </span>Reject
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
              
              {/* Quick Filter Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter Buttons */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Status PO:</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const newFilters = {...filters, poStatus: ''}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.poStatus === '' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, poStatus: 'Pending'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.poStatus === 'Pending' 
                          ? 'bg-yellow-600 text-white border-yellow-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, poStatus: 'Sedang diproses'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.poStatus === 'Sedang diproses' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Diproses
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, poStatus: 'Barang sampai'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.poStatus === 'Barang sampai' 
                          ? 'bg-green-600 text-white border-green-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Sampai
                    </button>
                  </div>
                </div>
                
                {/* Payment Status Filter Buttons */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Payment Status:</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const newFilters = {...filters, paymentStatus: ''}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.paymentStatus === '' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, paymentStatus: 'unpaid'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.paymentStatus === 'unpaid' 
                          ? 'bg-red-600 text-white border-red-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Unpaid
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, paymentStatus: 'partial'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.paymentStatus === 'partial' 
                          ? 'bg-yellow-600 text-white border-yellow-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Partial
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, paymentStatus: 'paid'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.paymentStatus === 'paid' 
                          ? 'bg-green-600 text-white border-green-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Paid
                    </button>
                  </div>
                </div>
                
                {/* Approval Status Filter Buttons */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Approval Status:</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const newFilters = {...filters, approvalStatus: ''}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.approvalStatus === '' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, approvalStatus: 'pending'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.approvalStatus === 'pending' 
                          ? 'bg-orange-600 text-white border-orange-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, approvalStatus: 'approved'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.approvalStatus === 'approved' 
                          ? 'bg-purple-600 text-white border-purple-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Approved
                    </button>
                    <button
                      onClick={() => {
                        const newFilters = {...filters, approvalStatus: 'rejected'}
                        setFilters(newFilters)
                        setCurrentPage(1)
                        setTimeout(() => updateURL(), 0)
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filters.approvalStatus === 'rejected' 
                          ? 'bg-red-600 text-white border-red-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Rejected
                    </button>
                  </div>
                </div>
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
                    <div className="relative supplier-dropdown">
                      <button
                        type="button"
                        onClick={() => setFilters({...filters, showSupplierDropdown: !filters.showSupplierDropdown})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm text-left bg-white flex items-center justify-between"
                      >
                        <span className="truncate">
                          {filters.selectedSuppliers.length === 0 
                            ? 'Pilih Supplier' 
                            : `${filters.selectedSuppliers.length} supplier dipilih`
                          }
                        </span>
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </button>
                      
                      {filters.showSupplierDropdown && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                          <div className="p-2 border-b border-gray-200">
                            <input
                              type="text"
                              placeholder="Cari supplier..."
                              value={filters.supplierSearch}
                              onChange={(e) => setFilters({...filters, supplierSearch: e.target.value})}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {suppliers
                              .filter(supplier => 
                                supplier.nama_supplier.toLowerCase().includes(filters.supplierSearch.toLowerCase())
                              )
                              .map(supplier => (
                                <div key={supplier.id_supplier} className="flex items-center px-3 py-2 hover:bg-gray-50">
                                  <input
                                    type="checkbox"
                                    checked={filters.selectedSuppliers.includes(supplier.id_supplier.toString())}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      const supplierId = supplier.id_supplier.toString()
                                      console.log('Desktop checkbox changed:', supplierId, e.target.checked)
                                      if (e.target.checked) {
                                        const newSelected = [...filters.selectedSuppliers, supplierId]
                                        console.log('Desktop new selected suppliers:', newSelected)
                                        setFilters({
                                          ...filters,
                                          selectedSuppliers: newSelected
                                        })
                                      } else {
                                        const newSelected = filters.selectedSuppliers.filter(id => id !== supplierId)
                                        console.log('Desktop new selected suppliers after removal:', newSelected)
                                        setFilters({
                                          ...filters,
                                          selectedSuppliers: newSelected
                                        })
                                      }
                                    }}
                                    className="rounded border-gray-300 mr-2"
                                  />
                                  <span className="text-sm truncate">{supplier.nama_supplier}</span>
                                </div>
                              ))
                            }
                            {suppliers.filter(supplier => 
                              supplier.nama_supplier.toLowerCase().includes(filters.supplierSearch.toLowerCase())
                            ).length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500">Tidak ada supplier ditemukan</div>
                            )}
                          </div>
                          <div className="p-2 border-t border-gray-200 flex gap-2">
                            <button
                              type="button"
                              onClick={() => setFilters({...filters, selectedSuppliers: []})}
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Clear All
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const allSupplierIds = suppliers.map(s => s.id_supplier.toString())
                                console.log('Select All clicked, all supplier IDs:', allSupplierIds)
                                setFilters({...filters, selectedSuppliers: allSupplierIds})
                              }}
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Select All
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
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
                      <option value="rejected">Rejected</option>
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
                    onClick={() => { 
                      clearFilters()
                      fetchFinanceData()
                    }}
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
            {currentPageData.map((item) => {
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
                          Items yang Diterima
                        </h4>
                        {rowDetails[item.id]?.items?.length > 0 ? (
                          <div className="bg-gray-50 rounded p-2 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-300">
                                  <th className="text-left py-1 font-medium">Produk</th>
                                  <th className="text-center py-1 font-medium">Qty PO</th>
                                  <th className="text-center py-1 font-medium">Qty Diterima</th>
                                  <th className="text-right py-1 font-medium">Harga PO</th>
                                  <th className="text-right py-1 font-medium">Harga Aktual</th>
                                  <th className="text-right py-1 font-medium">Total</th>
                                  <th className="text-left py-1 font-medium">Keterangan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rowDetails[item.id].items.map((poItem: any) => (
                                  <tr key={poItem.id} className="border-b border-gray-200 last:border-b-0">
                                    <td className="py-1 font-medium">{poItem.product_name}</td>
                                    <td className="py-1 text-center">{poItem.qty}</td>
                                    <td className="py-1 text-center">{poItem.received_qty || poItem.qty}</td>
                                    <td className="py-1 text-right">{formatCurrency(poItem.harga || 0)}</td>
                                    <td className="py-1 text-right">{formatCurrency(poItem.actual_price || poItem.harga || 0)}</td>
                                    <td className="py-1 text-right font-medium">{formatCurrency((poItem.received_qty || poItem.qty) * (poItem.actual_price || poItem.harga || 0))}</td>
                                    <td className="py-1">Status: {poItem.received_qty ? 'received' : 'pending'}</td>
                                  </tr>
                                ))}
                                <tr className="bg-gray-100 border-t border-gray-300">
                                  <td className="py-1 text-xs font-bold" colSpan={6}>Total PO Asli (qty po × harga):</td>
                                  <td className="py-1 text-right text-xs font-bold">
                                    {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                                      sum + (parseFloat(poItem.qty) || 0) * (parseFloat(poItem.harga) || 0), 0
                                    ))}
                                  </td>
                                </tr>
                                <tr className="bg-gray-100">
                                  <td className="py-1 text-xs font-bold" colSpan={6}>Total Aktual (qty diterima × harga aktual):</td>
                                  <td className="py-1 text-right text-xs font-bold">
                                    {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                                      sum + (parseFloat(poItem.received_qty) || parseFloat(poItem.qty) || 0) * (parseFloat(poItem.actual_price) || parseFloat(poItem.harga) || 0), 0
                                    ))}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
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
                    <button
                      onClick={() => {
                        // Save current state before navigating
                        const currentUrl = new URL(window.location.href)
                        sessionStorage.setItem('finance_po_return_url', currentUrl.pathname + currentUrl.search)
                        sessionStorage.setItem('finance_po_filters', JSON.stringify(filters))
                        sessionStorage.setItem('finance_po_search', search)
                        sessionStorage.setItem('finance_po_page', currentPage.toString())
                        window.location.href = `/finance/purchase-orders/submit-approval?id=${item.id}`
                      }}
                      className="flex-1 text-center px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      Submit
                    </button>
                    {(item as any).approval_status === 'pending' && (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              // Get current user from Supabase Auth
                              const { data: { user } } = await supabase.auth.getUser()
                              if (!user) throw new Error('User not authenticated')
                              
                              // Get user ID from users table using email
                              const { data: userData, error: userError } = await supabase
                                .from('users')
                                .select('id_user')
                                .eq('email', user.email)
                                .single()
                              
                              if (userError) throw userError
                              
                              const { error } = await supabase
                                .from('purchase_orders')
                                .update({ 
                                  approval_status: 'approved',
                                  approved_at: new Date().toISOString(),
                                  approved_by: userData?.id_user || null,
                                  rejection_notes: null,
                                  rejected_at: null
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
                        <button
                          onClick={() => {
                            setRejectPO(item)
                            setShowRejectModal(true)
                          }}
                          className="flex-1 text-center px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </>
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
                    {((item.total_paid > 0 && !(item as any).bulk_payment_ref) || (item as any).bulk_payment_ref) && (
                      <button
                        onClick={() => {
                          if ((item as any).bulk_payment_ref) {
                            // For bulk payments, redirect to bulk payments page with ref parameter
                            router.push(`/finance/bulk-payments?ref=${(item as any).bulk_payment_ref}`)
                          } else {
                            // For single payments, open payment modal
                            setSelectedPO(item)
                            setShowPaymentModal(true)
                          }
                        }}
                        className="flex-1 text-center px-2 py-1 border border-gray-300 text-gray-700 bg-white text-xs rounded hover:bg-gray-50"
                        title={`${(item as any).bulk_payment_ref ? 'View Bulk Payment' : 'Edit Payment'}`}
                      >
                        <Edit className="h-3 w-3 mx-auto" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            {/* Top horizontal scrollbar */}
            <div 
              ref={topScrollRef}
              className="overflow-x-auto border-b border-gray-200 bg-gray-50"
              onScroll={(e) => {
                if (tableScrollRef.current) {
                  tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
                }
              }}
            >
              <div className="h-4" style={{width: '1800px'}}></div>
            </div>
            <div 
              ref={tableScrollRef}
              className="overflow-x-auto max-h-[70vh]"
              onScroll={(e) => {
                if (topScrollRef.current) {
                  topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
                }
              }}
            >
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-20">
                  <tr>
                    <th className="w-6 px-1 py-2 sticky left-0 bg-gray-50 z-20">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            const unpaidPOs = currentPageData.filter(item => item.status_payment !== 'paid').map(item => item.id)
                            setSelectedPOs(unpaidPOs)
                          } else {
                            setSelectedPOs([])
                          }
                        }}
                        checked={selectedPOs.length > 0 && selectedPOs.length === currentPageData.filter(item => item.status_payment !== 'paid').length}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="w-6 px-1 py-2 sticky left-6 bg-gray-50 z-20"></th>
                    <th className="w-20 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 sticky left-12 bg-gray-50 z-20" onClick={() => handleSort('po_number')}>No PO</th>
                    <th className="w-24 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nama_branch')}>Cabang</th>                    
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tanggal_barang_sampai')}>Tgl Sampai</th>
                    <th className="w-20 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nama_supplier')}>Supplier</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">No Rek</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total_po')}>Total PO</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tagihan</th>
                    <th className="w-14 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tanggal_jatuh_tempo')}>J.Tempo</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Term</th>
                    <th className="w-14 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total_paid')}>Dibayar</th>
                    <th className="w-14 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('sisa_bayar')}>Sisa</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('dibayar_tanggal')}>Release</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status_payment')}>Pay Status</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('approved_at')}>Approved</th>
                    <th className="w-12 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                    <th className="w-12 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ref</th>

                    <th className="w-14 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                    <th className="w-16 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentPageData.map((item) => {
                    const isExpanded = expandedRows.includes(item.id)
                    const rowClass = `hover:bg-gray-50 ${item.is_overdue && item.status_payment !== 'paid' ? 'bg-red-50' : ''} ${isExpanded ? 'bg-blue-50' : ''}`
                    
                    return (
                      <React.Fragment key={item.id}>
                        <tr className={rowClass}>
                          <td className="px-1 py-2 whitespace-nowrap sticky left-0 bg-white z-10">
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
                          <td className="px-1 py-2 whitespace-nowrap sticky left-6 bg-white z-10">
                            <button 
                              onClick={() => toggleRowExpansion(item.id)}
                              className="text-gray-500 hover:text-blue-600"
                            >
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap sticky left-12 bg-white z-10">
                            <div>
                              <a 
                                href={`/purchaseorder/received-preview?id=${item.id}`}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {item.po_number}
                              </a>
                              <div className="text-xs text-gray-500">
                                {formatDate(item.po_date)}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className={`inline-flex px-1 py-0.5 text-xs rounded ${
                              (item as any).po_status === 'Barang sampai' ? 'bg-green-100 text-green-800' :
                              (item as any).po_status === 'Sedang diproses' ? 'bg-blue-100 text-blue-800' :
                              (item as any).po_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {(item as any).po_status}
                            </span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {item.nama_branch}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {(item as any).tanggal_barang_sampai ? (
                              <div className="text-green-600">
                                {formatDate((item as any).tanggal_barang_sampai)}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
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
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(item.total_po)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency((item as any).total_tagih || 0)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.invoice_number && item.invoice_number.trim() ? (
                              <span className="font-medium text-blue-600">{item.invoice_number}</span>
                            ) : (
                              <span className="text-gray-400 italic">Belum ada</span>
                            )}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {item.tanggal_jatuh_tempo ? (
                              formatDate(item.tanggal_jatuh_tempo)
                            ) : (
                              <span className="text-gray-400">Tunggu</span>
                            )}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {(item as any).payment_term_name || `${(item as any).termin_days || 30}d`}
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
                            {(item as any).approval_status === 'rejected' && (
                              <div className="text-xs text-red-600 mt-1 flex items-center">
                                <X className="h-3 w-3 mr-1" />
                                Rejected {(item as any).rejected_at ? `- ${formatDate((item as any).rejected_at)}` : ''}
                                {(item as any).rejection_notes && (
                                  <button 
                                    onClick={() => {
                                      setViewRejectionPO(item)
                                      setShowViewRejectionModal(true)
                                    }}
                                    className="ml-1 text-blue-600 hover:text-blue-800 underline"
                                  >
                                    (Ada catatan)
                                  </button>
                                )}
                              </div>
                            )}
                            {item.is_overdue && item.status_payment !== 'paid' && (
                              <div className="text-xs text-red-600 mt-1 flex items-center">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Overdue {item.days_overdue} hari
              </div>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).approved_at ? (
                              <div>
                                <div className="flex items-center">
                                  <CheckCircle className="h-4 w-4 text-purple-500 mr-1" />
                                  {formatDate((item as any).approved_at)}
                                </div>
                                {item.approved_by_name && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {item.approved_by_name}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>  
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).payment_method || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).payment_via || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(item as any).bulk_payment_ref ? (
                              <button
                                onClick={() => {
                                  router.push(`/finance/bulk-payments?ref=${(item as any).bulk_payment_ref}`)
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
                              <button
                                onClick={() => {
                                  // Save current state before navigating
                                  const currentUrl = new URL(window.location.href)
                                  sessionStorage.setItem('finance_po_return_url', currentUrl.pathname + currentUrl.search)
                                  sessionStorage.setItem('finance_po_filters', JSON.stringify(filters))
                                  sessionStorage.setItem('finance_po_search', search)
                                  sessionStorage.setItem('finance_po_page', currentPage.toString())
                                  window.location.href = `/finance/purchase-orders/submit-approval?id=${item.id}`
                                }}
                                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                title="Submit Total Tagih"
                              >
                                <FileText className="h-3 w-3" />
                              </button>
                              {(item as any).approval_status === 'pending' && (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        // Get current user from localStorage or Supabase Auth
                                        let userId = null
                                        try {
                                          const { data: { user } } = await supabase.auth.getUser()
                                          if (user) {
                                            // Get user ID from users table using email
                                            const { data: userData, error: userError } = await supabase
                                              .from('users')
                                              .select('id_user')
                                              .eq('email', user.email)
                                              .single()
                                            
                                            if (!userError && userData) {
                                              userId = userData.id_user
                                            }
                                          }
                                        } catch (authError) {
                                          console.warn('Auth error, using localStorage:', authError)
                                        }
                                        
                                        // Fallback to localStorage
                                        if (!userId) {
                                          const localUser = JSON.parse(localStorage.getItem('user') || '{}')
                                          userId = localUser.id_user || null
                                        }
                                        
                                        if (!userId) {
                                          throw new Error('User not authenticated. Please login again.')
                                        }
                                        
                                        const { error } = await supabase
                                          .from('purchase_orders')
                                          .update({ 
                                            approval_status: 'approved',
                                            approved_at: new Date().toISOString(),
                                            approved_by: userId,
                                            rejection_notes: null,
                                            rejected_at: null
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
                                  <button
                                    onClick={() => {
                                      setRejectPO(item)
                                      setShowRejectModal(true)
                                    }}
                                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    title="Reject"
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                  </button>
                                </>
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
                                      // For bulk payments, redirect to bulk payments page with ref parameter
                                      router.push(`/finance/bulk-payments?ref=${(item as any).bulk_payment_ref}`)
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
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                {/* Items List */}
                                <div className="md:col-span-4">
                                  <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Items yang Diterima
                                  </h3>
                                  {rowDetails[item.id]?.items?.length > 0 ? (
                                    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty PO</th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty Diterima</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Harga PO</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Harga Aktual</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {rowDetails[item.id].items.map((poItem: any) => (
                                            <tr key={poItem.id}>
                                              <td className="px-3 py-2 text-sm">{poItem.product_name || `Product ${poItem.product_id}`}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{poItem.qty}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{poItem.received_qty || poItem.qty}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(poItem.harga || 0)}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(poItem.actual_price || poItem.harga || 0)}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-right">
                                                {formatCurrency((poItem.received_qty || poItem.qty) * (poItem.actual_price || poItem.harga || 0))}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm">Status: {poItem.received_qty ? 'received' : 'pending'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot className="bg-gray-100 border-t border-gray-300">
                                          <tr>
                                            <td className="px-3 py-2 text-sm font-bold" colSpan={6}>Total PO Asli (qty po × harga):</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-bold">
                                              {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                                                sum + (parseFloat(poItem.qty) || 0) * (parseFloat(poItem.harga) || 0), 0
                                              ))}
                                            </td>
                                          </tr>
                                          <tr>
                                            <td className="px-3 py-2 text-sm font-bold" colSpan={6}>Total Aktual (qty diterima × harga aktual):</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-bold">
                                              {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                                                sum + (parseFloat(poItem.received_qty) || parseFloat(poItem.qty) || 0) * (parseFloat(poItem.actual_price) || parseFloat(poItem.harga) || 0), 0
                                              ))}
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">Tidak ada item</p>
                                  )}
                                </div>
                                
                                {/* Payment History */}
                                <div className="md:col-span-2">
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
                                <div className="md:col-span-1">
                                  <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Approval
                                  </h3>
                                  <div className="bg-white rounded-md border border-gray-200 p-3">
                                    <div className="flex justify-center">
                                      <ApprovalPhotoThumbnail po={item} />
                                    </div>
                                    <div className="mt-2 space-y-1 text-xs text-center">
                                      <p>Status: <span className="font-medium">{(item as any).approval_status || 'pending'}</span></p>
                                      <p>Total Tagih: <span className="font-medium">{formatCurrency((item as any).total_tagih || 0)}</span></p>
                                      {(item as any).keterangan && (
                                        <p>Keterangan: {(item as any).keterangan}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Rincian Items PO */}
                                <div className="md:col-span-5">
                                  <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Rincian Items PO
                                  </h3>
                                  {rowDetails[item.id]?.items?.length > 0 ? (
                                    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty PO</th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty Diterima</th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty Tagih</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Harga PO</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Harga Diterima</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Harga Tagih</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total PO</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Aktual</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Tagih</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {rowDetails[item.id].items.map((poItem: any) => (
                                            <tr key={poItem.id}>
                                              <td className="px-3 py-2 text-sm">{poItem.product_name || `Product ${poItem.product_id}`}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{poItem.qty}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{poItem.received_qty || poItem.qty}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{poItem.qty_tagih || poItem.received_qty || poItem.qty}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(poItem.harga || 0)}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(poItem.actual_price || poItem.harga || 0)}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(poItem.harga_tagih || poItem.actual_price || poItem.harga || 0)}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-right">{formatCurrency((poItem.qty) * (poItem.harga || 0))}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-right">{formatCurrency((poItem.received_qty || poItem.qty) * (poItem.actual_price || poItem.harga || 0))}</td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-right">{formatCurrency((poItem.qty_tagih || poItem.received_qty || poItem.qty) * (poItem.harga_tagih || poItem.actual_price || poItem.harga || 0))}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot className="bg-gray-100 border-t border-gray-300">
                                          <tr>
                                            <td className="px-3 py-2 text-sm font-bold" colSpan={7}>TOTAL:</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-bold">
                                              {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                                                sum + (parseFloat(poItem.qty) || 0) * (parseFloat(poItem.harga) || 0), 0
                                              ))}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-bold">
                                              {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                                                sum + (parseFloat(poItem.received_qty) || parseFloat(poItem.qty) || 0) * (parseFloat(poItem.actual_price) || parseFloat(poItem.harga) || 0), 0
                                              ))}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-bold">
                                              {formatCurrency(rowDetails[item.id].items.reduce((sum: number, poItem: any) => 
                                                sum + (parseFloat(poItem.qty_tagih) || parseFloat(poItem.received_qty) || parseFloat(poItem.qty) || 0) * (parseFloat(poItem.harga_tagih) || parseFloat(poItem.actual_price) || parseFloat(poItem.harga) || 0), 0
                                              ))}
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">Tidak ada item</p>
                                  )}
                                </div>
                                
                                {/* Rejection Notes */}
                                {(item as any).approval_status === 'rejected' && (item as any).rejection_notes && (
                                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                    <p className="text-xs font-medium text-red-800">Alasan Penolakan:</p>
                                    <p className="text-xs text-red-700 mt-1">{(item as any).rejection_notes}</p>
                                  </div>
                                )}
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

        {/* Reject Modal */}
        {showRejectModal && rejectPO && (
          <RejectModal
            po={rejectPO}
            onClose={() => {
              setShowRejectModal(false)
              setRejectPO(null)
              setRejectNotes('')
            }}
            onSuccess={() => {
              fetchFinanceData()
            }}
          />
        )}

        {/* View Rejection Notes Modal */}
        {showViewRejectionModal && viewRejectionPO && (
          <ViewRejectionNotesModal
            po={viewRejectionPO}
            onClose={() => {
              setShowViewRejectionModal(false)
              setViewRejectionPO(null)
            }}
          />
        )}

        {/* Image Modal */}
        {showImageModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 max-w-4xl max-h-[90vh]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Foto Approval - {data.find(po => po.id.toString() === showImageModal)?.po_number}
                </h3>
                <button 
                  onClick={() => setShowImageModal(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
              {(() => {
                const po = data.find(p => p.id.toString() === showImageModal)
                if (!po || !(po as any).approval_photo) return null
                const imageUrl = `${supabase.storage.from('po-photos').getPublicUrl((po as any).approval_photo).data.publicUrl}`
                return (
                  <>
                    <img 
                      src={imageUrl}
                      alt="Approval Photo Full Size"
                      className="max-w-full max-h-[70vh] object-contain"
                    />
                    <div className="mt-4 text-sm text-gray-600">
                      <p>Status: <span className={`font-medium ${
                        (po as any).approval_status === 'approved' ? 'text-green-600' : 
                        (po as any).approval_status === 'rejected' ? 'text-red-600' : 'text-orange-600'
                      }`}>
                        {(po as any).approval_status || 'pending'}
                      </span></p>
                      <p>Total Tagih: {formatCurrency((po as any).total_tagih || 0)}</p>
                      {(po as any).keterangan && <p>Keterangan: {(po as any).keterangan}</p>}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}

      </PageAccessControl>
    </Layout>
  )
}

export default function FinancePurchaseOrders() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FinancePurchaseOrdersContent />
    </Suspense>
  )
}