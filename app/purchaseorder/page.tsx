"use client"

import React, { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Search, Filter, Plus, Eye, Edit, Trash2, Calendar, Building2, User, Package, ChevronDown, ChevronUp, Download, AlertTriangle, ShoppingCart, CheckCheck, CheckIcon, BookCheck, SquareCheckIcon, Check, Image } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useSearchParams } from 'next/navigation'
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'
import { canPerformActionSync } from '@/src/utils/rolePermissions'


interface PurchaseOrder {
  id: number
  po_number: string
  status: string
  priority?: string
  supplier_name: string
  branch_name: string
  created_at: string
  created_by_name: string
  tanggal_barang_sampai?: string
  total_harga: number
  items: Array<{product_name: string, qty: number}>
}

interface FilterOptions {
  branches: Array<{id_branch: number, nama_branch: string}>
  suppliers: Array<{id_supplier: number, nama_supplier: string}>
  statuses: string[]
  priorities: string[]
}

function PurchaseOrderPageContent() {
  const searchParams = useSearchParams()
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [userRole, setUserRole] = useState('')
  
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role || 'guest')
    }
  }, [])
  const [stockAlerts, setStockAlerts] = useState<any[]>([])
  const [filteredStockAlerts, setFilteredStockAlerts] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [showStockAlerts, setShowStockAlerts] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    cabang_id: '',
    supplier_id: '',
    status: '',
    priority: ''
  })
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    branches: [],
    suppliers: [],
    statuses: ['Pending', 'Sedang diproses', 'Barang sampai', 'Sampai Sebagian', 'Dibatalkan'],
    priorities: ['biasa', 'sedang', 'tinggi']
  })
  const [expandedPO, setExpandedPO] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [allowedBranches, setAllowedBranches] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const itemsPerPage = 10

  useEffect(() => {
    const init = async () => {
      await initializeUserData()
      fetchFilterOptions()
      fetchPurchaseOrders()
      fetchStockAlerts()
    }
    init()
    
    // Check if coming from stock alert
    const fromAlert = searchParams?.get('from')
    const showAlerts = searchParams?.get('showAlerts')
    if (fromAlert === 'stock_alert' || showAlerts === 'true') {
      setShowStockAlerts(true)
    }
  }, [])

  useEffect(() => {
    if (userRole) {
      fetchFilterOptions()
      fetchPurchaseOrders()
      fetchStockAlerts()
    }
  }, [userRole])

  useEffect(() => {
    setCurrentPage(1)
    fetchPurchaseOrders()
  }, [filters, search])

  useEffect(() => {
    fetchPurchaseOrders()
  }, [currentPage])

  const initializeUserData = async () => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role)
      
      if (user.role === 'super admin' || user.role === 'admin') {
        setAllowedBranches([])
        localStorage.removeItem('user_branch_ids')
      } else {
        if (user.id_user) {
          const { data: userBranches, error } = await supabase
            .from('user_branches')
            .select(`
              kode_branch, 
              branches!inner(id_branch, nama_branch)
            `)
            .eq('id_user', user.id_user)
            .eq('is_active', true)
          
          if (error) {
            console.error('Error fetching user branches:', error)
          }
          
          if (userBranches && userBranches.length > 0) {
            const branchNames = userBranches.map(ub => (ub.branches as any).nama_branch)
            const branchIds = userBranches.map(ub => (ub.branches as any).id_branch)
            setAllowedBranches(branchNames)
            localStorage.setItem('user_branch_ids', JSON.stringify(branchIds))
          } else {
            const fallbackBranch = user.cabang || ''
            setAllowedBranches([fallbackBranch].filter(Boolean))
          }
        }
      }
    }
  }

  const fetchFilterOptions = async () => {
    try {
      // Get user branch IDs from localStorage if available
      const userBranchIdsStr = localStorage.getItem('user_branch_ids')
      const userBranchIds = userBranchIdsStr ? JSON.parse(userBranchIdsStr) : []
      
      // Fetch branches
      let branchQuery = supabase
        .from('branches')
        .select('id_branch, nama_branch')
        .order('nama_branch')
      
      // Filter branches for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && userBranchIds.length > 0) {
        branchQuery = branchQuery.in('id_branch', userBranchIds)
      }
      
      const { data: branches } = await branchQuery

      // Fetch suppliers with distinct names
      const { data: suppliersRaw } = await supabase
        .from('suppliers')
        .select('id_supplier, nama_supplier')
        .order('nama_supplier')
      
      // Remove duplicates based on nama_supplier (case insensitive)
      const uniqueSuppliers = suppliersRaw?.reduce((acc: any[], current) => {
        const existing = acc.find(item => item.nama_supplier.toLowerCase() === current.nama_supplier.toLowerCase())
        if (!existing) {
          acc.push(current)
        }
        return acc
      }, []) || []

      setFilterOptions({
        branches: branches || [],
        suppliers: uniqueSuppliers,
        statuses: ['Pending', 'Sedang diproses', 'Barang sampai', 'Sampai Sebagian', 'Di Gudang', 'Dibatalkan'],
        priorities: ['biasa', 'sedang', 'tinggi']
      })
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  const fetchPurchaseOrders = async () => {
    setLoading(true)
    try {
      // Get user branch IDs from localStorage if available
      const userBranchIdsStr = localStorage.getItem('user_branch_ids')
      const userBranchIds = userBranchIdsStr ? JSON.parse(userBranchIdsStr) : []
      
      // Get IDs for search filters if search exists
      let searchSupplierIds: number[] = []
      let searchBranchIds: number[] = []
      let searchPOIds: number[] = []
      
      if (search) {
        const searchPattern = `%${search}%`
        
        // Search in suppliers
        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('id_supplier')
          .ilike('nama_supplier', searchPattern)
        searchSupplierIds = suppliers?.map(s => s.id_supplier) || []
        
        // Search in branches
        const { data: branches } = await supabase
          .from('branches')
          .select('id_branch')
          .ilike('nama_branch', searchPattern)
        searchBranchIds = branches?.map(b => b.id_branch) || []
        
        // Search in PO numbers
        const { data: pos } = await supabase
          .from('purchase_orders')
          .select('id')
          .ilike('po_number', searchPattern)
        searchPOIds = pos?.map(p => p.id) || []
        
        // Search in products and get related PO IDs
        const { data: products } = await supabase
          .from('nama_product')
          .select('id_product')
          .ilike('product_name', searchPattern)
        
        if (products && products.length > 0) {
          const productIds = products.map(p => p.id_product)
          const { data: poItems } = await supabase
            .from('po_items')
            .select('po_id')
            .in('product_id', productIds)
          
          if (poItems) {
            const productPOIds = poItems.map(item => item.po_id)
            searchPOIds = [...new Set([...searchPOIds, ...productPOIds])]
          }
        }
      }
      
      // Count total records first
      let countQuery = supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })

      // Apply filters to count query
      if (filters.cabang_id) {
        countQuery = countQuery.eq('cabang_id', filters.cabang_id)
      }
      if (filters.supplier_id) {
        countQuery = countQuery.eq('supplier_id', filters.supplier_id)
      }
      if (filters.status) {
        countQuery = countQuery.eq('status', filters.status)
      }
      if (filters.priority) {
        countQuery = countQuery.eq('priority', filters.priority)
      }
      
      // Filter by allowed branches for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && userBranchIds.length > 0) {
        countQuery = countQuery.in('cabang_id', userBranchIds)
      }
      
      // Apply search filters
      if (search && (searchPOIds.length > 0 || searchSupplierIds.length > 0 || searchBranchIds.length > 0)) {
        const orConditions = []
        if (searchPOIds.length > 0) orConditions.push(`id.in.(${searchPOIds.join(',')})`)
        if (searchSupplierIds.length > 0) orConditions.push(`supplier_id.in.(${searchSupplierIds.join(',')})`)
        if (searchBranchIds.length > 0) orConditions.push(`cabang_id.in.(${searchBranchIds.join(',')})`)
        
        if (orConditions.length > 0) {
          countQuery = countQuery.or(orConditions.join(','))
        }
      }

      const { count } = await countQuery
      setTotalCount(count || 0)

      // Query purchase_orders with pagination
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

      let query = supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)

      // Apply filters
      if (filters.cabang_id) {
        query = query.eq('cabang_id', filters.cabang_id)
      }
      if (filters.supplier_id) {
        query = query.eq('supplier_id', filters.supplier_id)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority)
      }
      
      // Filter by allowed branches for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && userBranchIds.length > 0) {
        query = query.in('cabang_id', userBranchIds)
      }
      
      // Apply search filters
      if (search && (searchPOIds.length > 0 || searchSupplierIds.length > 0 || searchBranchIds.length > 0)) {
        const orConditions = []
        if (searchPOIds.length > 0) orConditions.push(`id.in.(${searchPOIds.join(',')})`)
        if (searchSupplierIds.length > 0) orConditions.push(`supplier_id.in.(${searchSupplierIds.join(',')})`)
        if (searchBranchIds.length > 0) orConditions.push(`cabang_id.in.(${searchBranchIds.join(',')})`)
        
        if (orConditions.length > 0) {
          query = query.or(orConditions.join(','))
        }
      }

      const { data: poData, error } = await query

      if (error) throw error
      
      // Bulk fetch all related data to avoid N+1 queries
      const poIds = (poData || []).map(po => po.id)
      const supplierIds = [...new Set((poData || []).map(po => po.supplier_id))]
      const branchIds = [...new Set((poData || []).map(po => po.cabang_id))]
      
      // Parallel bulk queries
      const [suppliersResult, branchesResult, itemsResult] = await Promise.all([
        supplierIds.length > 0 ? supabase.from('suppliers').select('id_supplier, nama_supplier').in('id_supplier', supplierIds) : { data: [] },
        branchIds.length > 0 ? supabase.from('branches').select('id_branch, nama_branch').in('id_branch', branchIds) : { data: [] },
        poIds.length > 0 ? supabase.from('po_items').select('po_id, qty, product_id, actual_price, received_qty, harga').in('po_id', poIds) : { data: [] }
      ])
      
      const suppliers = suppliersResult.data || []
      const branches = branchesResult.data || []
      const allItems = itemsResult.data || []
      
      // Get unique product IDs and bulk fetch products
      const productIds = [...new Set(allItems.map(item => item.product_id))]
      const { data: products } = productIds.length > 0 
        ? await supabase.from('nama_product').select('id_product, product_name, harga').in('id_product', productIds)
        : { data: [] }
      
      // Create lookup maps
      const supplierMap = new Map(suppliers.map(s => [s.id_supplier, s.nama_supplier]))
      const branchMap = new Map(branches.map(b => [b.id_branch, b.nama_branch]))
      const productMap = new Map((products || []).map(p => [p.id_product, p]))
      const itemsMap = new Map<number, any[]>()
      
      // Group items by PO ID
      allItems.forEach(item => {
        if (!itemsMap.has(item.po_id)) {
          itemsMap.set(item.po_id, [])
        }
        itemsMap.get(item.po_id)?.push(item)
      })
      
      // Transform data
      const transformedData = (poData || []).map((po: any) => {
        const items = itemsMap.get(po.id) || []
        let totalHarga = 0
        
        const poItems = items.map(item => {
          const product = productMap.get(item.product_id)
          const priceToUse = item.actual_price || item.harga || product?.harga || 0
          const qtyToUse = item.received_qty || item.qty
          
          totalHarga += priceToUse * qtyToUse
          
          return {
            product_name: product?.product_name || 'Unknown Product',
            qty: item.received_qty || item.qty
          }
        })
        
        return {
          id: po.id,
          po_number: po.po_number,
          status: po.status,
          priority: po.priority,
          supplier_name: supplierMap.get(po.supplier_id) || 'Unknown',
          branch_name: branchMap.get(po.cabang_id) || 'Unknown',
          created_at: po.created_at,
          created_by_name: 'System',
          tanggal_barang_sampai: po.tanggal_barang_sampai,
          total_harga: totalHarga,
          items: poItems
        }
      })
      
      setPurchaseOrders(transformedData)
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800'
      case 'Sedang diproses': return 'bg-blue-100 text-blue-800'
      case 'Barang sampai': return 'bg-purple-100 text-purple-800'
      case 'Sampai Sebagian': return 'bg-green-100 text-green-800'
      case 'Di Gudang': return 'bg-emerald-100 text-emerald-800'
      case 'Dibatalkan': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'tinggi': return 'bg-red-100 text-red-800'
      case 'sedang': return 'bg-yellow-100 text-yellow-800'
      case 'biasa': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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

  const handleDeletePO = async (poId: number, poNumber: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus PO ${poNumber}? Semua data barang masuk, gudang, dan price history terkait juga akan dihapus.`)) {
      return
    }

    try {
      // First delete related po_price_history records
      const { error: poPriceHistoryError } = await supabase
        .from('po_price_history')
        .delete()
        .eq('po_number', poNumber)

      if (poPriceHistoryError) {
        console.error('Error deleting PO price history:', poPriceHistoryError)
        throw poPriceHistoryError
      }

      // Then delete related price history records
      const { error: priceHistoryError } = await supabase
        .from('po_price_history')
        .delete()
        .eq('po_number', poNumber)

      if (priceHistoryError) {
        console.error('Error deleting price history:', priceHistoryError)
        console.error('Price history error details:', JSON.stringify(priceHistoryError, null, 2))
        const errorMessage = priceHistoryError?.message || priceHistoryError?.details || priceHistoryError?.hint || 'Unknown price history deletion error'
        throw new Error(errorMessage)
      }

      // Then delete related gudang records
      const { error: gudangError } = await supabase
        .from('gudang')
        .delete()
        .eq('source_type', 'PO')
        .eq('source_reference', poNumber)

      if (gudangError) {
        console.error('Error deleting gudang records:', gudangError)
        throw gudangError
      }

      // Then delete related barang_masuk records
      const { error: barangMasukError } = await supabase
        .from('barang_masuk')
        .delete()
        .eq('no_po', poNumber)

      if (barangMasukError) {
        console.error('Error deleting barang masuk:', barangMasukError)
        throw barangMasukError
      }

      // Finally delete the PO
      const { error: poError } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', poId)

      if (poError) throw poError

      alert('PO dan semua data barang masuk, gudang & price history terkait berhasil dihapus!')
      fetchPurchaseOrders()
    } catch (error) {
      console.error('Error deleting PO:', error)
      alert('Gagal menghapus PO')
    }
  }

  const toggleExpandPO = (id: number) => {
    if (expandedPO === id) {
      setExpandedPO(null)
    } else {
      setExpandedPO(id)
    }
  }

  const fetchStockAlerts = async () => {
    try {
      // Try new function first, fallback to original if it fails
      let { data, error } = await supabase.rpc('get_stock_alerts_with_po_status')
      
      if (error) {
        const result = await supabase.rpc('get_products_needing_po')
        data = result.data
        error = result.error

        
        // Add default PO status fields for compatibility
        if (data) {
          data = data.map((alert: any) => ({
            ...alert,
            po_status: 'NONE',
            po_number: null,
            po_created_at: null
          }))
        }
      }
      
      if (!error && data) {
        let filteredData = data
        
        // Filter by allowed branches for non-admin users
        if (userRole !== 'super admin' && userRole !== 'admin') {
          const userBranchIdsStr = localStorage.getItem('user_branch_ids')
          const userBranchIds = userBranchIdsStr ? JSON.parse(userBranchIdsStr) : []
          
          if (userBranchIds.length > 0) {
            // Get branch names from IDs
            const { data: userBranches } = await supabase
              .from('branches')
              .select('nama_branch')
              .in('id_branch', userBranchIds)
            
            if (userBranches) {
              const userBranchNames = userBranches.map(b => b.nama_branch)
              filteredData = data.filter((alert: any) => 
                userBranchNames.includes(alert.branch_name)
              )
            }
          }
        }
        setStockAlerts(filteredData)
        setFilteredStockAlerts(filteredData)
      }
    } catch (error) {
      console.error('Error fetching stock alerts:', error)
    }
  }

  const handleCreatePOFromAlert = () => {
    window.location.href = '/purchaseorder/stock-alert'
  }



  const handleExport = async () => {
    try {
      // Fetch all purchase orders without pagination for export
      let query = supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply current filters
      if (filters.cabang_id) {
        query = query.eq('cabang_id', filters.cabang_id)
      }
      if (filters.supplier_id) {
        query = query.eq('supplier_id', filters.supplier_id)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority)
      }

      const { data: poData, error } = await query
      if (error) throw error

      // Optimized export: bulk fetch related data
      const poIds = (poData || []).map(po => po.id)
      const supplierIds = [...new Set((poData || []).map(po => po.supplier_id))]
      const branchIds = [...new Set((poData || []).map(po => po.cabang_id))]
      
      // Bulk fetch all related data
      const [suppliersResult, branchesResult, itemsResult] = await Promise.all([
        supabase.from('suppliers').select('id_supplier, nama_supplier').in('id_supplier', supplierIds),
        supabase.from('branches').select('id_branch, nama_branch').in('id_branch', branchIds),
        supabase.from('po_items').select(`
          po_id, qty, actual_price, received_qty, harga,
          nama_product!inner(product_name, harga)
        `).in('po_id', poIds)
      ])
      
      // Create lookup maps
      const supplierMap = new Map(suppliersResult.data?.map(s => [s.id_supplier, s.nama_supplier]) || [])
      const branchMap = new Map(branchesResult.data?.map(b => [b.id_branch, b.nama_branch]) || [])
      const itemsMap = new Map<number, any[]>()
      
      itemsResult.data?.forEach(item => {
        if (!itemsMap.has(item.po_id)) {
          itemsMap.set(item.po_id, [])
        }
        itemsMap.get(item.po_id)?.push(item)
      })
      
      // Transform data for export
      const exportData = (poData || []).map((po: any) => {
        const items = itemsMap.get(po.id) || []
        let totalHarga = 0
        const itemNames: string[] = []
        const quantities: number[] = []
        
        items.forEach(item => {
          const priceToUse = item.actual_price || item.harga || (item.nama_product as any)?.harga || 0
          const qtyToUse = item.received_qty || item.qty
          totalHarga += priceToUse * qtyToUse
          
          itemNames.push((item.nama_product as any)?.product_name || 'Unknown')
          quantities.push(item.received_qty || item.qty)
        })
        
        return {
          'PO Number': po.po_number,
          'Status': po.status,
          'Priority': po.priority || 'biasa',
          'Supplier': supplierMap.get(po.supplier_id) || 'Unknown',
          'Branch': branchMap.get(po.cabang_id) || 'Unknown',
          'Items': itemNames.join(', '),
          'Quantities': quantities.join(', '),
          'Total Amount': totalHarga,
          'Created Date': new Date(po.created_at).toLocaleDateString('id-ID'),
          'Arrival Date': po.tanggal_barang_sampai ? new Date(po.tanggal_barang_sampai).toLocaleDateString('id-ID') : '-'
        }
      })

      // Create and download Excel file
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders')
      XLSX.writeFile(wb, `purchase_orders_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data')
    }
  }

  return (
    <div className="p-3 md:p-4 space-y-3">
          {/* Stock Alerts Banner */}
          {stockAlerts.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="text-red-400 mr-2" size={20} />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">
                      {filteredStockAlerts.length} Products Need Immediate Attention
                      {selectedBranch && ` (${selectedBranch})`}
                    </h3>
                    <p className="text-sm text-red-700">
                      Stock levels are below safety threshold. Create PO now to avoid stockout.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowStockAlerts(!showStockAlerts)}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                >
                  {showStockAlerts ? 'Hide' : 'Show'} Alerts
                </button>
              </div>
            </div>
          )}

          {/* Stock Alerts List */}
          {showStockAlerts && stockAlerts.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-gray-800 flex items-center gap-2">
                    <ShoppingCart className="text-red-600" size={18} />
                    Stock Alerts - Products Needing PO
                  </h3>
                  <select
                    value={selectedBranch}
                    className="border border-gray-300 rounded px-3 py-1 text-sm"
                    onChange={(e) => {
                      const branch = e.target.value
                      setSelectedBranch(branch)
                      const filtered = branch === '' 
                        ? stockAlerts 
                        : stockAlerts.filter(alert => alert.branch_name === branch)
                      setFilteredStockAlerts(filtered)
                    }}
                  >
                    <option value="">All Branches</option>
                    {[...new Set(stockAlerts
                      .filter(alert => allowedBranches.length === 0 || allowedBranches.includes(alert.branch_name))
                      .map(alert => alert.branch_name)
                    )].map(branchName => (
                      <option key={branchName} value={branchName}>{branchName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                {filteredStockAlerts.map((alert, index) => (
                  <div key={`${alert.id_product}-${alert.branch_code}`} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{alert.product_name}</h4>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            alert.po_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            alert.po_status === 'Sedang diproses' ? 'bg-blue-100 text-blue-800' :
                            alert.urgency_level === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {alert.po_status === 'Pending' ? 'PO PENDING' :
                             alert.po_status === 'Sedang diproses' ? 'ON ORDER' :
                             alert.urgency_level}
                          </span>
                          {alert.po_number && (
                            <span className="text-xs text-blue-600 font-medium">
                              {alert.po_number}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          <span className="font-medium">{alert.branch_name}</span> • {alert.sub_category}
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-sm">
                          <span className="text-red-600">
                            Current: {alert.current_stock}
                          </span>
                          <span className="text-gray-600">
                            Safety: {alert.safety_stock}
                          </span>
                          <span className="text-blue-600">
                            Reorder: {alert.reorder_point}
                          </span>
                          <span className="text-orange-600">
                            Shortage: {alert.shortage_qty}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleCreatePOFromAlert}
                        className="ml-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 text-sm"
                      >
                        <ShoppingCart size={16} />
                        Go to Stock Alert PO
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="text-blue-600" size={20} />
                Purchase Orders
                {stockAlerts.length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full ml-2">
                    {filteredStockAlerts.length} alerts
                  </span>
                )}
              </h1>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden bg-gray-200 text-gray-700 px-3 py-2 rounded-lg flex items-center gap-2"
              >
                <Filter size={16} />
                Filter
              </button>
              <button
                onClick={handleExport}
                className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download size={16} />
                <span className="hidden md:inline">Export</span>
              </button>
              {canPerformActionSync(userRole, 'purchaseorder', 'create') && (
                <a href="/purchaseorder/create" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 flex-1 md:flex-none justify-center">
                  <Plus size={16} />
                  <span className="hidden md:inline">Buat PO Baru</span>
                  <span className="md:hidden">PO Baru</span>
                </a>
              )}
            </div>
          </div>

          {/* Filters - Mobile */}
          {showFilters && (
            <div className="md:hidden bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-500" />
                  <h3 className="font-medium text-gray-800">Filter</h3>
                </div>
                <button 
                  onClick={() => setShowFilters(false)}
                  className="text-gray-500"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Cari PO, supplier, cabang, produk..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                  <select
                    value={filters.cabang_id}
                    onChange={(e) => setFilters({...filters, cabang_id: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Semua Cabang</option>
                    {filterOptions.branches.map(branch => (
                      <option key={branch.id_branch} value={branch.id_branch}>{branch.nama_branch}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select
                    value={filters.supplier_id}
                    onChange={(e) => setFilters({...filters, supplier_id: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Semua Supplier</option>
                    {filterOptions.suppliers.map(supplier => (
                      <option key={supplier.id_supplier} value={supplier.id_supplier}>{supplier.nama_supplier}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={filters.priority}
                    onChange={(e) => setFilters({...filters, priority: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Semua Priority</option>
                    {filterOptions.priorities.map(priority => (
                      <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Semua Status</option>
                    {filterOptions.statuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({cabang_id: '', supplier_id: '', status: '', priority: ''})}
                    className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 text-sm flex-1"
                  >
                    Reset Filter
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm flex-1"
                  >
                    Terapkan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search and Filter Section */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Cari PO, supplier, cabang, produk..."
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
              
              {/* Status Filter Buttons */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setFilters({...filters, status: ''})}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    filters.status === ''
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setFilters({...filters, status: 'Pending'})}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    filters.status === 'Pending'
                      ? 'bg-yellow-600 text-white border-yellow-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setFilters({...filters, status: 'Sedang diproses'})}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    filters.status === 'Sedang diproses'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Diproses
                </button>
                <button
                  onClick={() => setFilters({...filters, status: 'Barang sampai'})}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    filters.status === 'Barang sampai'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Sampai
                </button>
                <button
                  onClick={() => setFilters({...filters, status: 'Dibatalkan'})}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    filters.status === 'Dibatalkan'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Batal
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Cabang</label>
                    <select
                      value={filters.cabang_id}
                      onChange={(e) => setFilters({...filters, cabang_id: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                    >
                      <option value="">Semua Cabang</option>
                      {filterOptions.branches.map(branch => (
                        <option key={branch.id_branch} value={branch.id_branch}>{branch.nama_branch}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
                    <select
                      value={filters.supplier_id}
                      onChange={(e) => setFilters({...filters, supplier_id: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                    >
                      <option value="">Semua Supplier</option>
                      {filterOptions.suppliers.map(supplier => (
                        <option key={supplier.id_supplier} value={supplier.id_supplier}>{supplier.nama_supplier}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={filters.priority}
                      onChange={(e) => setFilters({...filters, priority: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                    >
                      <option value="">Semua Priority</option>
                      {filterOptions.priorities.map(priority => (
                        <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({...filters, status: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                    >
                      <option value="">Semua Status</option>
                      {filterOptions.statuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setFilters({cabang_id: '', supplier_id: '', status: '', priority: ''})}
                    className="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600 text-xs"
                  >
                    Reset Filter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Purchase Orders List */}
          <div className="bg-white rounded-lg shadow">
            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2 text-sm">Memuat data...</p>
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="p-6 text-center">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada Purchase Order</h3>
                <p className="mt-1 text-sm text-gray-500">Mulai dengan membuat PO baru</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cabang</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sampai</th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {purchaseOrders.map((po) => (
                        <tr key={po.id} className="hover:bg-gray-50">
                          <td className="px-2 py-2">
                            <div className="font-medium text-gray-900 text-xs">{po.po_number}</div>
                            <div className="text-xs text-gray-500">#{po.id}</div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="text-xs text-gray-900 truncate max-w-[120px]">{po.supplier_name}</div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-start text-xs text-gray-900">
                              <Building2 size={12} className="mr-1 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="break-words">{po.branch_name}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(po.priority || 'biasa')}`}>
                              {po.priority || 'Biasa'}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(po.status)}`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="text-xs text-gray-900">
                              {po.items.length > 0 ? (
                                <div className="space-y-1">
                                  {po.items.slice(0, 2).map((item, index) => (
                                    <div key={index} className="flex justify-between">
                                      <span className="truncate max-w-[100px]">{item.product_name}</span>
                                      <span className="ml-2 font-medium">{item.qty}</span>
                                    </div>
                                  ))}
                                  {po.items.length > 2 && (
                                    <div className="text-xs text-gray-500">+{po.items.length - 2} items</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500">No items</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <div className="font-medium text-gray-900 text-xs">
                              {formatCurrency(po.total_harga)}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center text-xs text-gray-900">
                              <Calendar size={12} className="mr-1 text-gray-400" />
                              <span>{formatDate(po.created_at)}</span>
                            </div>
                            <div className="flex items-center text-xs text-gray-500">
                              <User size={10} className="mr-1" />
                              <span>{po.created_by_name}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            {po.tanggal_barang_sampai ? (
                              <div className="flex items-center text-xs text-gray-900">
                                <Calendar size={12} className="mr-1 text-green-400" />
                                <span>{formatDate(po.tanggal_barang_sampai)}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {po.status === 'Barang sampai' || po.status === 'Sampai Sebagian' ? (
                                <a 
                                  href={`/purchaseorder/received-preview?id=${po.id}`}
                                  className="text-green-600 hover:text-green-800 p-1 rounded" 
                                  title="Preview Barang Diterima"
                                >
                                  <Eye size={14} />
                                </a>
                              ) : (
                                <a 
                                  href={`/purchaseorder/on_progress?id=${po.id}`}
                                  className="text-blue-600 hover:text-blue-800 p-1 rounded" 
                                  title="Preview PO"
                                >
                                  <Check size={14} />
                                </a>
                              )}
                              {po.status === 'Sedang diproses' && (
                                <a 
                                  href={`/purchaseorder/barang_sampai?id=${po.id}`}
                                  className="text-blue-600 hover:text-blue-800 p-1 rounded" 
                                  title="Barang Sampai"
                                >
                                  <Package size={14} />
                                </a>
                              )}

                              {canPerformActionSync(userRole, 'purchaseorder', 'edit') && (
                                po.status !== 'Dibatalkan' ? (
                                  <a 
                                    href={`/purchaseorder/edit?id=${po.id}`}
                                    className="text-orange-600 hover:text-orange-800 p-1 rounded" 
                                    title="Edit PO"
                                  >
                                    <Edit size={14} />
                                  </a>
                                ) : (
                                  <span 
                                    className="text-gray-400 p-1 rounded cursor-not-allowed" 
                                    title="PO dibatalkan tidak dapat diedit"
                                  >
                                    <Edit size={14} />
                                  </span>
                                )
                              )}
                              {canPerformActionSync(userRole, 'purchaseorder', 'delete') && (
                                <button
                                  onClick={() => handleDeletePO(po.id, po.po_number)}
                                  className="text-red-600 hover:text-red-800 p-1 rounded"
                                  title="Delete PO"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-gray-200">
                  {purchaseOrders.map((po) => (
                    <div key={po.id} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">{po.po_number}</div>
                          <div className="text-sm text-gray-500">#{po.id}</div>
                        </div>
                        <button 
                          onClick={() => toggleExpandPO(po.id)}
                          className="text-gray-500"
                        >
                          {expandedPO === po.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                      
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="flex items-center text-sm text-gray-900">
                          <Building2 size={14} className="mr-1 text-gray-400" />
                          {po.branch_name}
                        </div>
                        <div className="text-sm text-gray-900 truncate">
                          {po.supplier_name}
                        </div>
                      </div>
                      
                      <div className="mt-2 flex gap-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(po.priority || 'biasa')}`}>
                          {po.priority || 'Biasa'}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(po.status)}`}>
                          {po.status}
                        </span>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-900">
                        <div className="font-medium">{formatCurrency(po.total_harga)}</div>
                      </div>
                      
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <Calendar size={14} className="mr-1" />
                        {formatDate(po.created_at)}
                      </div>

                      {expandedPO === po.id && (
                        <div className="mt-4 space-y-3 border-t pt-3">
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Items:</div>
                            {po.items.length > 0 ? (
                              <div className="space-y-1">
                                {po.items.map((item, index) => (
                                  <div key={index} className="flex justify-between text-sm">
                                    <span className="truncate max-w-[150px]">{item.product_name}</span>
                                    <span className="ml-2 font-medium">{item.qty}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500 text-sm">No items</span>
                            )}
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Tanggal Barang Sampai:</div>
                            {po.tanggal_barang_sampai ? (
                              <div className="flex items-center text-sm text-gray-900">
                                <Calendar size={14} className="mr-1 text-green-400" />
                                {formatDate(po.tanggal_barang_sampai)}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </div>
                          
                          <div className="flex justify-center gap-4 pt-2">
                            {po.status === 'Barang sampai' || po.status === 'Sampai Sebagian' ? (
                              <a 
                                href={`/purchaseorder/received-preview?id=${po.id}`}
                                className="text-green-600 hover:text-green-800 p-1 rounded" 
                                title="Preview Barang Diterima"
                              >
                                <Eye size={20} />
                              </a>
                            ) : (
                              <a 
                                href={`/purchaseorder/on_progress?id=${po.id}`}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded" 
                                title="Preview PO"
                              >
                                <Check size={20} />
                              </a>
                            )}
                            {po.status === 'Sedang diproses' && (
                              <a 
                                href={`/purchaseorder/barang_sampai?id=${po.id}`}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded" 
                                title="Barang Sampai"
                              >
                                <Package size={20} />
                              </a>
                            )}

                            {canPerformActionSync(userRole, 'purchaseorder', 'edit') && (
                              po.status !== 'Dibatalkan' ? (
                                <a 
                                  href={`/purchaseorder/edit?id=${po.id}`}
                                  className="text-orange-600 hover:text-orange-800 p-1 rounded" 
                                  title="Edit PO"
                                >
                                  <Edit size={20} />
                                </a>
                              ) : (
                                <span 
                                  className="text-gray-400 p-1 rounded cursor-not-allowed" 
                                  title="PO dibatalkan tidak dapat diedit"
                                >
                                  <Edit size={20} />
                                </span>
                              )
                            )}
                            {canPerformActionSync(userRole, 'purchaseorder', 'delete') && (
                              <button
                                onClick={() => handleDeletePO(po.id, po.po_number)}
                                className="text-red-600 hover:text-red-800 p-1 rounded"
                                title="Delete PO"
                              >
                                <Trash2 size={20} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Mobile Pagination */}
                  {Math.ceil(totalCount / itemsPerPage) > 1 && (
                    <div className="flex justify-center mt-6 p-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="px-4 py-2 bg-white border border-gray-300 rounded disabled:opacity-50 text-sm"
                        >
                          Prev
                        </button>
                        <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded text-sm">
                          {currentPage}
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(Math.ceil(totalCount / itemsPerPage), currentPage + 1))}
                          disabled={currentPage === Math.ceil(totalCount / itemsPerPage)}
                          className="px-4 py-2 bg-white border border-gray-300 rounded disabled:opacity-50 text-sm"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            
            {/* Desktop Pagination */}
            {Math.ceil(totalCount / itemsPerPage) > 1 && (
              <div className="hidden md:block bg-white px-4 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of{' '}
                      <span className="font-medium">{totalCount}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Prev
                      </button>
                      {(() => {
                        const totalPages = Math.ceil(totalCount / itemsPerPage)
                        const maxVisible = 5
                        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
                        let endPage = Math.min(totalPages, startPage + maxVisible - 1)
                        
                        if (endPage - startPage < maxVisible - 1) {
                          startPage = Math.max(1, endPage - maxVisible + 1)
                        }
                        
                        return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === currentPage
                                ? 'z-10 bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        ))
                      })()}
                      <button
                        onClick={() => setCurrentPage(Math.min(Math.ceil(totalCount / itemsPerPage), currentPage + 1))}
                        disabled={currentPage === Math.ceil(totalCount / itemsPerPage)}
                        className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.ceil(totalCount / itemsPerPage))}
                        disabled={currentPage === Math.ceil(totalCount / itemsPerPage)}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Last
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>



    </div>
  )
}

export default function PurchaseOrderPage() {
  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <Suspense fallback={
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading...</p>
          </div>
        }>
          <PurchaseOrderPageContent />
        </Suspense>
      </PageAccessControl>
    </Layout>
  )
}