"use client"

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/src/lib/supabaseClient'
import { Plus, Search, ShoppingCart, Package, Calendar, Building, User } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

interface ItemView {
  id: number
  product_id: number
  product_name: string
  po_number: string
  po_date: string
  nama_supplier: string
  nama_branch: string
  po_status: string
  qty: number
  harga: number
  item_status: string
  tracking_info?: string
  status_updated_at?: string
}

function MarketplacePOPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<ItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 10
  const [filters, setFilters] = useState({
    supplier: '',
    status: '',
    branches: [] as string[]
  })
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [allBranches, setAllBranches] = useState<string[]>([])

  // Update URL with all state
  const updateURL = useCallback(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filters.supplier) params.set('supplier', filters.supplier)
    if (filters.status) params.set('status', filters.status)
    if (filters.branches.length > 0) params.set('branches', filters.branches.join(','))
    if (currentPage > 1) params.set('page', currentPage.toString())
    
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router, search, filters, currentPage])

  // Initialize from URL params
  useEffect(() => {
    if (!searchParams) return
    
    const urlSearch = searchParams.get('search') || ''
    const supplier = searchParams.get('supplier') || ''
    const status = searchParams.get('status') || ''
    const branchesParam = searchParams.get('branches')
    const branches = branchesParam ? branchesParam.split(',') : []
    const page = parseInt(searchParams.get('page') || '1')
    
    setSearch(urlSearch)
    setFilters({ supplier, status, branches })
    setCurrentPage(page)
  }, [])

  // Update URL when state changes (but not on initial load)
  useEffect(() => {
    if (searchParams) {
      updateURL()
    }
  }, [search, filters, currentPage])

  // Reset page when filters/search change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [search, filters])

  // Fetch data when dependencies change
  useEffect(() => {
    fetchMarketplaceItems()
  }, [currentPage, filters])

  // Fetch all branches on component mount
  useEffect(() => {
    const fetchAllBranches = async () => {
      const { data } = await supabase
        .from('finance_dashboard_view')
        .select('nama_branch')
        .or('nama_supplier.ilike.%shopee%,nama_supplier.ilike.%tokped%,nama_supplier.ilike.%tokopedia%')
      
      const branches = [...new Set((data || []).map(item => item.nama_branch))].filter(Boolean).sort()
      setAllBranches(branches)
    }
    fetchAllBranches()
  }, [])

  const fetchMarketplaceItems = async () => {
    try {
      setLoading(true)
      
      // First get marketplace POs
      let poQuery = supabase
        .from('finance_dashboard_view')
        .select('id, po_number, po_date, nama_supplier, nama_branch, po_status')
        .or('nama_supplier.ilike.%shopee%,nama_supplier.ilike.%tokped%,nama_supplier.ilike.%tokopedia%')
      
      if (filters.supplier) {
        poQuery = poQuery.ilike('nama_supplier', `%${filters.supplier}%`)
      }
      if (filters.branches.length > 0) {
        poQuery = poQuery.in('nama_branch', filters.branches)
      }
      
      const { data: poData, error: poError } = await poQuery
      if (poError) throw poError
      
      const poIds = (poData || []).map(po => po.id)
      if (poIds.length === 0) {
        setItems([])
        setTotalCount(0)
        return
      }
      
      // Get all items for these POs
      const { data: allItemsData, error: allItemsError } = await supabase
        .from('po_items')
        .select('*')
        .in('po_id', poIds)
        .order('status_updated_at', { ascending: false })
      
      let itemsData = allItemsData

      if (allItemsError) {
        // Fallback for missing columns
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('po_items')
          .select('id, po_id, product_id, qty, harga')
          .in('po_id', poIds)
        
        if (fallbackError) throw fallbackError
        
        const itemsWithDefaults = (fallbackData || []).map(item => ({
          ...item,
          item_status: 'pending',
          tracking_info: null,
          status_updated_at: null
        }))
        
        itemsData = itemsWithDefaults
      }

      // Get product names
      const productIds = [...new Set((itemsData || []).map(item => item.product_id))]
      const { data: productsData } = await supabase
        .from('nama_product')
        .select('id_product, product_name')
        .in('id_product', productIds)

      const productMap = new Map((productsData || []).map(p => [p.id_product, p.product_name]))
      const poMap = new Map((poData || []).map(po => [po.id, po]))

      // Transform data and auto-update item status based on PO status
      const transformedItems = (itemsData || []).map(item => {
        const poInfo = poMap.get(item.po_id)
        let itemStatus = item.item_status || 'pending'
        
        // Auto-update item status if PO status is "Barang sampai" or "Di Gudang"
        if ((poInfo?.po_status === 'Barang sampai' || poInfo?.po_status === 'Di Gudang') && itemStatus !== 'received') {
          itemStatus = 'received'
          // Update in database
          supabase
            .from('po_items')
            .update({ 
              item_status: 'received',
              status_updated_at: new Date().toISOString()
            })
            .eq('id', item.id)
            .then(({ error }) => {
              if (error) console.error('Auto-update item status error:', error)
            })
        }
        
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: productMap.get(item.product_id) || 'Unknown Product',
          po_number: poInfo?.po_number || 'Unknown PO',
          po_date: poInfo?.po_date || '',
          nama_supplier: poInfo?.nama_supplier || 'Unknown Supplier',
          nama_branch: poInfo?.nama_branch || 'Unknown Branch',
          po_status: poInfo?.po_status || 'Unknown Status',
          qty: item.qty,
          harga: item.harga,
          item_status: itemStatus,
          tracking_info: item.tracking_info,
          status_updated_at: item.status_updated_at
        }
      })

      // Apply sorting
      const sortedItems = transformedItems.sort((a, b) => {
        const dateA = new Date(a.po_date)
        const dateB = new Date(b.po_date)
        return dateB.getTime() - dateA.getTime()
      })
      
      // Apply client-side filtering with strict matching
      let filteredItems = sortedItems
      
      // Apply search filter
      if (search) {
        filteredItems = filteredItems.filter(item => 
          item.product_name.toLowerCase().includes(search.toLowerCase()) ||
          item.po_number.toLowerCase().includes(search.toLowerCase()) ||
          item.nama_supplier.toLowerCase().includes(search.toLowerCase())
        )
      }
      
      // Apply supplier filter
      if (filters.supplier) {
        filteredItems = filteredItems.filter(item => 
          item.nama_supplier.toLowerCase().includes(filters.supplier.toLowerCase())
        )
      }
      
      // Apply status filter
      if (filters.status) {
        filteredItems = filteredItems.filter(item => item.item_status === filters.status)
      }
      
      // Apply branch filter
      if (filters.branches.length > 0) {
        filteredItems = filteredItems.filter(item => filters.branches.includes(item.nama_branch))
      }
      
      // Set total count based on filtered items
      setTotalCount(filteredItems.length)
      
      // Apply pagination to filtered items
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage
      const paginatedItems = filteredItems.slice(from, to)
      
      setItems(paginatedItems)
    } catch (error) {
      console.error('Error fetching items:', error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const updateItemStatus = async (itemId: number, status: string) => {
    try {
      const { error } = await supabase
        .from('po_items')
        .update({ 
          item_status: status,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', itemId)

      if (error) {
        console.error('Error updating item status (columns may not exist yet):', error)
        alert('Database belum diupdate. Jalankan migration dulu: add-item-status-columns.sql')
        return
      }
      
      fetchMarketplaceItems()
    } catch (error) {
      console.error('Error updating item status:', error)
    }
  }

  const updateTrackingInfo = async (itemId: number, trackingInfo: string) => {
    try {
      const { error } = await supabase
        .from('po_items')
        .update({ tracking_info: trackingInfo })
        .eq('id', itemId)

      if (error) {
        console.error('Error updating tracking info (columns may not exist yet):', error)
        return
      }
      
      fetchMarketplaceItems()
    } catch (error) {
      console.error('Error updating tracking info:', error)
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
    return new Date(dateString).toLocaleDateString('id-ID')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Barang sampai': return 'bg-green-100 text-green-800'
      case 'Sedang diproses': return 'bg-blue-100 text-blue-800'
      case 'Pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-green-100 text-green-800'
      case 'shipped': return 'bg-blue-100 text-blue-800'
      case 'ordered': return 'bg-yellow-100 text-yellow-800'
      case 'pending': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
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
      <PageAccessControl pageName="purchaseorder">
        <div className="p-4 bg-gray-50 min-h-screen">
          {/* Header */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-800">Marketplace PO Tracker</h1>
                <span className="text-sm text-gray-500">(Shopee & Tokopedia)</span>
              </div>
              <a
                href="/purchaseorder/create"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={16} />
                Buat PO Baru
              </a>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Cari nama barang, PO, atau supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter Buttons */}
            <div className="space-y-3">
              {/* Supplier Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier:</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilters({...filters, supplier: ''})}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      filters.supplier === ''
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setFilters({...filters, supplier: 'shopee'})}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      filters.supplier === 'shopee'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Shopee
                  </button>
                  <button
                    onClick={() => setFilters({...filters, supplier: 'tokped'})}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      filters.supplier === 'tokped'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Tokopedia
                  </button>
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status Item:</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilters({...filters, status: ''})}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      filters.status === ''
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setFilters({...filters, status: 'pending'})}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      filters.status === 'pending'
                        ? 'bg-gray-600 text-white border-gray-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setFilters({...filters, status: 'ordered'})}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      filters.status === 'ordered'
                        ? 'bg-yellow-600 text-white border-yellow-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Ordered
                  </button>
                  <button
                    onClick={() => setFilters({...filters, status: 'shipped'})}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      filters.status === 'shipped'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Shipped
                  </button>
                  <button
                    onClick={() => setFilters({...filters, status: 'received'})}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      filters.status === 'received'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Received
                  </button>
                </div>
              </div>

              {/* Branch Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cabang:</label>
                <div className="relative">
                  <button
                    onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                    className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="text-sm">
                      {filters.branches.length === 0 
                        ? 'Pilih Cabang...' 
                        : `${filters.branches.length} cabang dipilih`
                      }
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showBranchDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center p-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.branches.length === 0}
                            onChange={() => setFilters({...filters, branches: []})}
                            className="mr-2"
                          />
                          <span className="text-sm">Semua Cabang</span>
                        </label>
                        {allBranches.map(branch => (
                          <label key={branch} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filters.branches.includes(branch)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilters({...filters, branches: [...filters.branches, branch]})
                                } else {
                                  setFilters({...filters, branches: filters.branches.filter(b => b !== branch)})
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{branch}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {(search || filters.supplier || filters.status || filters.branches.length > 0) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-blue-800 font-medium">Active filters:</span>
                {search && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    Search: {search}
                  </span>
                )}
                {filters.supplier && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    Supplier: {filters.supplier}
                  </span>
                )}
                {filters.status && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    Status: {filters.status}
                  </span>
                )}
                {filters.branches.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    Cabang: {filters.branches.length} dipilih ({filters.branches.join(', ')})
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearch('')
                    setFilters({supplier: '', status: '', branches: []})
                  }}
                  className="text-blue-600 hover:text-blue-800 text-xs underline ml-2"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          {/* Items List */}
          <div className="space-y-4">
            {loading ? (
              <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-lg font-medium text-gray-900">Loading...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900">Tidak ada item yang sesuai filter</p>
                <p className="text-sm text-gray-500">Filter: status='{filters.status}' branches=[{filters.branches.join(', ')}]</p>
              </div>
            ) : (
              items.filter(item => {
                // Final filter check before display
                const supplierMatch = !filters.supplier || item.nama_supplier.toLowerCase().includes(filters.supplier.toLowerCase())
                const statusMatch = !filters.status || item.item_status === filters.status
                const branchMatch = filters.branches.length === 0 || filters.branches.includes(item.nama_branch)
                return supplierMatch && statusMatch && branchMatch
              }).map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{item.product_name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getItemStatusColor(item.item_status)}`}>
                          Item: {item.item_status}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.po_status)}`}>
                          PO: {item.po_status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                        <div className="flex items-center text-sm text-gray-600">
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          PO: {item.po_number}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Building className="h-4 w-4 mr-2" />
                          {item.nama_supplier}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-2" />
                          {formatDate(item.po_date)}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <User className="h-4 w-4 mr-2" />
                          {item.nama_branch}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Qty: <span className="font-medium">{item.qty || 0}</span> • 
                          Price: <span className="font-medium">{formatCurrency(item.harga || 0)}</span>
                        </div>
                        {item.status_updated_at && (
                          <div className="text-xs text-gray-500">
                            Updated: {formatDate(item.status_updated_at)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 ml-4">
                      <select
                        value={item.item_status}
                        onChange={(e) => updateItemStatus(item.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 font-medium ${getItemStatusColor(item.item_status)}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="ordered">Ordered</option>
                        <option value="shipped">Shipped</option>
                        <option value="received">Received</option>
                      </select>
                      
                      {(item.item_status === 'shipped' || item.item_status === 'received') && (
                        <input
                          type="text"
                          placeholder="Tracking #"
                          value={item.tracking_info || ''}
                          onChange={(e) => updateTrackingInfo(item.id, e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1 w-24"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {Math.ceil(totalCount / itemsPerPage) > 1 && (
            <div className="bg-white px-4 py-3 border-t border-gray-200 rounded-lg shadow border border-gray-200 mb-4 mt-4">
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

          {/* Summary */}
          <div className="mt-6 bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-lg font-semibold">{totalCount}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Current Page</p>
                <p className="text-lg font-semibold">{items.length} items</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Received Items</p>
                <p className="text-lg font-semibold">
                  {items.filter(item => item.item_status === 'received').length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Completion Rate</p>
                <p className="text-lg font-semibold">
                  {totalCount > 0
                    ? Math.round((items.filter(item => item.item_status === 'received').length / items.length) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageAccessControl>
    </Layout>
  )
}

export default function MarketplacePOPage() {
  return (
    <Suspense fallback={
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    }>
      <MarketplacePOPageContent />
    </Suspense>
  )
}