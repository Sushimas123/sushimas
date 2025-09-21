"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { TrendingUp, TrendingDown, Calendar, Filter, X, Search, Menu } from 'lucide-react'
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'
import PriceValidation from '../../components/PriceValidation'

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface PriceHistory {
  id: number
  product_id: number
  product_name: string
  old_price: number
  new_price: number
  price_change: number
  change_percentage: number
  change_date: string
  change_reason: string
  po_number?: string
  notes?: string
}

interface Product {
  id_product: number
  product_name: string
}

export default function PriceHistoryPage() {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    product_id: '',
    date_from: '',
    date_to: '',
    change_reason: ''
  })
  const [chartData, setChartData] = useState<any>(null)
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [poIds, setPOIds] = useState<Record<string, number>>({})
  
  // Mobile specific states
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState('list') // 'list' or 'details'
  const [selectedHistory, setSelectedHistory] = useState<PriceHistory | null>(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  // Check if mobile on mount and on resize
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    
    return () => {
      window.removeEventListener('resize', checkIsMobile)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchPriceHistory()
  }, [])

  useEffect(() => {
    fetchPriceHistory()
  }, [filters])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.product-search-container')) {
        setShowProductDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1)
  }, [filters])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('nama_product')
        .select('id_product, product_name')
        .order('product_name')
      
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchPriceHistory = async () => {
    try {
      let query = supabase
        .from('po_price_history')
        .select(`
          id,
          product_id,
          po_price,
          actual_price,
          price_difference,
          percentage_difference,
          received_date,
          po_number,
          notes,
          invoice_number
        `)
        .order('received_date', { ascending: false })

      if (filters.product_id) {
        query = query.eq('product_id', parseInt(filters.product_id))
      }
      if (filters.date_from) {
        query = query.gte('received_date', filters.date_from)
      }
      if (filters.date_to) {
        query = query.lte('received_date', filters.date_to)
      }

      const { data, error } = await query

      if (error) throw error

      // Get product names separately
      const productIds = [...new Set(data?.map(item => item.product_id) || [])]
      const { data: products } = await supabase
        .from('nama_product')
        .select('id_product, product_name')
        .in('id_product', productIds)

      const productMap = (products || []).reduce((acc, product) => {
        acc[product.id_product] = product.product_name
        return acc
      }, {} as Record<number, string>)

      const historyWithProductNames = data?.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: productMap[item.product_id] || 'Unknown Product',
        old_price: parseFloat(item.po_price) || 0,
        new_price: parseFloat(item.actual_price) || 0,
        price_change: parseFloat(item.price_difference) || 0,
        change_percentage: parseFloat(item.percentage_difference) || 0,
        change_date: item.received_date,
        po_number: item.po_number,
        notes: item.notes || item.invoice_number,
        change_reason: 'po_completion'
      })) || []

      // Debug: Log first few records to check data format
      if (historyWithProductNames.length > 0) {
        console.log('Sample price history from po_price_history:', historyWithProductNames.slice(0, 3))
      }
      
      setPriceHistory(historyWithProductNames)
      prepareChartData(historyWithProductNames)
      fetchPOIds(historyWithProductNames)
    } catch (error) {
      console.error('Error fetching price history:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPOIds = async (history: PriceHistory[]) => {
    const poNumbers = [...new Set(history.filter(h => h.po_number).map(h => h.po_number!))]
    if (poNumbers.length === 0) return

    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number')
        .in('po_number', poNumbers)
      
      if (error) throw error
      
      const poIdMap = (data || []).reduce((acc, po) => {
        acc[po.po_number] = po.id
        return acc
      }, {} as Record<string, number>)
      
      setPOIds(poIdMap)
    } catch (error) {
      console.error('Error fetching PO IDs:', error)
    }
  }

  const prepareChartData = (history: PriceHistory[]) => {
    if (!history.length) {
      setChartData(null)
      return
    }

    // Group by product and sort by date
    const productGroups = history.reduce((groups, item) => {
      if (!groups[item.product_name]) {
        groups[item.product_name] = []
      }
      groups[item.product_name].push(item)
      return groups
    }, {} as Record<string, PriceHistory[]>)

    // Sort each product's history by date
    Object.keys(productGroups).forEach(product => {
      productGroups[product].sort((a, b) => new Date(a.change_date).getTime() - new Date(b.change_date).getTime())
    })

    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']
    
    const datasets = Object.keys(productGroups).slice(0, 6).map((productName, index) => {
      const productHistory = productGroups[productName]
      return {
        label: productName,
        data: productHistory.map(item => ({
          x: new Date(item.change_date).toLocaleDateString('id-ID'),
          y: item.new_price
        })),
        borderColor: colors[index],
        backgroundColor: colors[index] + '20',
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    })

    setChartData({
      datasets
    })
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600'
    if (change < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp size={16} className="text-green-600" />
    if (change < 0) return <TrendingDown size={16} className="text-red-600" />
    return null
  }

  // Check for suspicious price changes
  const isSuspiciousPrice = (oldPrice: number, newPrice: number, changePercentage: number) => {
    // Flag as suspicious if:
    // 1. Price is too low (< 1000 rupiah for real products)
    // 2. Extreme percentage change (> 1000% or < -95%)
    // 3. Price change from 0 to very low amount
    return (
      (oldPrice > 0 && oldPrice < 1000) || 
      (newPrice > 0 && newPrice < 1000) ||
      Math.abs(changePercentage) > 1000 ||
      (oldPrice === 0 && newPrice < 2000)
    )
  }

  const getSuspiciousRowClass = (history: PriceHistory) => {
    if (isSuspiciousPrice(history.old_price, history.new_price, history.change_percentage)) {
      return 'bg-yellow-50 border-l-4 border-yellow-400'
    }
    return 'hover:bg-gray-50'
  }

  const getReasonBadge = (reason: string) => {
    const colors: Record<string, string> = {
      'po_completion': 'bg-blue-100 text-blue-800',
      'manual_update': 'bg-yellow-100 text-yellow-800',
      'market_adjustment': 'bg-purple-100 text-purple-800'
    }
    return colors[reason] || 'bg-gray-100 text-gray-800'
  }

  // Mobile view handlers
  const viewHistoryDetails = (history: PriceHistory) => {
    setSelectedHistory(history)
    setMobileView('details')
  }

  const closeHistoryDetails = () => {
    setMobileView('list')
    setSelectedHistory(null)
  }

  // Mobile filter component
  const MobileFilters = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="bg-white w-4/5 h-full p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Filters</h3>
          <button onClick={() => setShowMobileFilters(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="relative product-search-container">
            <label className="block text-sm font-medium mb-1">Product</label>
            <input
              type="text"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value)
                setShowProductDropdown(true)
                if (!e.target.value) {
                  setFilters({...filters, product_id: ''})
                }
              }}
              onFocus={() => setShowProductDropdown(true)}
              className="w-full border px-3 py-2 rounded-md"
              placeholder="Search product..."
            />
            {showProductDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onClick={() => {
                    setProductSearch('')
                    setFilters({...filters, product_id: ''})
                    setShowProductDropdown(false)
                  }}
                >
                  All Products
                </div>
                {products
                  .filter(product => 
                    product.product_name.toLowerCase().includes(productSearch.toLowerCase())
                  )
                  .map(product => (
                    <div
                      key={product.id_product}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => {
                        setProductSearch(product.product_name)
                        setFilters({...filters, product_id: product.id_product.toString()})
                        setShowProductDropdown(false)
                      }}
                    >
                      {product.product_name}
                    </div>
                  ))
                }
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({...filters, date_from: e.target.value})}
              className="w-full border px-3 py-2 rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({...filters, date_to: e.target.value})}
              className="w-full border px-3 py-2 rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Change Reason</label>
            <select
              value={filters.change_reason}
              onChange={(e) => setFilters({...filters, change_reason: e.target.value})}
              className="w-full border px-3 py-2 rounded-md"
            >
              <option value="">All Reasons</option>
              <option value="po_completion">PO Completion</option>
              <option value="manual_update">Manual Update</option>
              <option value="market_adjustment">Market Adjustment</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setFilters({product_id: '', date_from: '', date_to: '', change_reason: ''})
                setProductSearch('')
                setShowProductDropdown(false)
              }}
              className="px-4 py-2 bg-gray-200 rounded-md flex-1"
            >
              Reset
            </button>
            <button 
              onClick={() => setShowMobileFilters(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md flex-1"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // Pagination
  const totalPages = Math.ceil(priceHistory.length / pageSize)
  const paginatedHistory = priceHistory.slice((page - 1) * pageSize, page * pageSize)

  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <div className="p-2 md:p-3 space-y-2 md:space-y-3">
          {/* Mobile Filters */}
          {showMobileFilters && <MobileFilters />}

          {/* Mobile History Details View */}
          {isMobile && mobileView === 'details' && selectedHistory && (
            <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Price History Details</h2>
                  <button onClick={closeHistoryDetails} className="p-2">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold">Date:</label>
                    <p className="flex items-center gap-1">
                      <Calendar size={14} className="text-gray-400" />
                      {formatDate(selectedHistory.change_date)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Product:</label>
                    <p>{selectedHistory.product_name}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Old Price:</label>
                    <p className="text-gray-600">{formatCurrency(selectedHistory.old_price)}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">New Price:</label>
                    <p className="font-medium">{formatCurrency(selectedHistory.new_price)}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Price Change:</label>
                    <div className={`flex items-center gap-1 ${getChangeColor(selectedHistory.price_change)}`}>
                      {getChangeIcon(selectedHistory.price_change)}
                      <span className="font-medium">
                        {formatCurrency(Math.abs(selectedHistory.price_change))}
                      </span>
                      <span className="text-sm">
                        ({selectedHistory.change_percentage > 0 ? '+' : ''}{selectedHistory.change_percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Change Reason:</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getReasonBadge(selectedHistory.change_reason)}`}>
                      {selectedHistory.change_reason.replace('_', ' ')}
                    </span>
                  </div>
                  
                  {selectedHistory.po_number && (
                    <div>
                      <label className="font-semibold">PO Number:</label>
                      {poIds[selectedHistory.po_number] ? (
                        <a 
                          href={`/purchaseorder/on_progress?id=${poIds[selectedHistory.po_number]}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline block"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {selectedHistory.po_number}
                        </a>
                      ) : (
                        <p className="text-gray-600">{selectedHistory.po_number}</p>
                      )}
                    </div>
                  )}
                  
                  {selectedHistory.notes && (
                    <div>
                      <label className="font-semibold">Notes:</label>
                      {selectedHistory.po_number && selectedHistory.notes.includes('PO') ? (
                        <a 
                          href={`/purchaseorder/on_progress?id=${poIds[selectedHistory.po_number]}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline block"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {selectedHistory.notes}
                        </a>
                      ) : (
                        <p className="text-gray-600">{selectedHistory.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp className="text-blue-600" size={isMobile ? 20 : 24} />
              Price History
            </h1>
            {isMobile && (
              <button 
                onClick={() => setShowMobileFilters(true)}
                className="ml-auto p-2 bg-gray-200 rounded-md"
              >
                <Filter size={20} />
              </button>
            )}
          </div>
          <p className="text-gray-600 text-xs md:text-sm">Riwayat perubahan harga produk</p>

          {/* Desktop Filters */}
          {!isMobile && (
            <div className="bg-white rounded-lg shadow p-2">
              <div className="flex items-center gap-1 mb-2">
                <Filter size={14} className="text-gray-500" />
                <h3 className="font-medium text-gray-800 text-sm">Filter</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <div className="relative product-search-container">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Produk</label>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      setShowProductDropdown(true)
                      if (!e.target.value) {
                        setFilters({...filters, product_id: ''})
                      }
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                    placeholder="Cari produk..."
                  />
                  {showProductDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      <div
                        className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs"
                        onClick={() => {
                          setProductSearch('')
                          setFilters({...filters, product_id: ''})
                          setShowProductDropdown(false)
                        }}
                      >
                        Semua Produk
                      </div>
                      {products
                        .filter(product => 
                          product.product_name.toLowerCase().includes(productSearch.toLowerCase())
                        )
                        .map(product => (
                          <div
                            key={product.id_product}
                            className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs"
                            onClick={() => {
                              setProductSearch(product.product_name)
                              setFilters({...filters, product_id: product.id_product.toString()})
                              setShowProductDropdown(false)
                            }}
                          >
                            {product.product_name}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Dari Tanggal</label>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters({...filters, date_from: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sampai Tanggal</label>
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters({...filters, date_to: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Alasan Perubahan</label>
                  <select
                    value={filters.change_reason}
                    onChange={(e) => setFilters({...filters, change_reason: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                  >
                    <option value="">Semua Alasan</option>
                    <option value="po_completion">PO Completion</option>
                    <option value="manual_update">Manual Update</option>
                    <option value="market_adjustment">Market Adjustment</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFilters({product_id: '', date_from: '', date_to: '', change_reason: ''})
                      setProductSearch('')
                      setShowProductDropdown(false)
                    }}
                    className="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600 text-xs"
                  >
                    Reset Filter
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Table */}
          {!isMobile && (
            <div className="bg-white rounded-lg shadow">
              {loading ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2 text-xs">Memuat data...</p>
                </div>
              ) : paginatedHistory.length === 0 ? (
                <div className="p-4 text-center">
                  <TrendingUp className="mx-auto h-8 w-8 text-gray-400" />
                  <h3 className="mt-2 text-xs font-medium text-gray-900">Tidak ada riwayat harga</h3>
                  <p className="mt-1 text-xs text-gray-500">Belum ada perubahan harga yang tercatat</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase border">Tanggal</th>
                        <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase border">Produk</th>
                        <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase border">Harga Lama</th>
                        <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase border">Harga Baru</th>
                        <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase border">Perubahan</th>
                        <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase border">%</th>
                        <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase border">Alasan</th>
                        <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase border">PO/Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHistory.map((history) => (
                        <React.Fragment key={history.id}>
                          {isSuspiciousPrice(history.old_price, history.new_price, history.change_percentage) && (
                            <tr>
                              <td colSpan={8} className="px-1 py-1 text-xs bg-yellow-100 text-yellow-800 border">
                                ⚠️ Harga mencurigakan - Periksa kembali data ini
                              </td>
                            </tr>
                          )}
                          <tr className={getSuspiciousRowClass(history)}>
                          <td className="px-1 py-1 text-xs text-gray-900 border">
                            <div className="flex items-center">
                              <Calendar size={10} className="mr-1 text-gray-400" />
                              <span className="truncate max-w-20">{formatDate(history.change_date).slice(0, 10)}</span>
                            </div>
                          </td>
                          <td className="px-1 py-1 border">
                            <div className="font-medium text-gray-900 text-xs truncate max-w-32" title={history.product_name}>{history.product_name}</div>
                          </td>
                          <td className="px-1 py-1 text-right text-xs text-gray-600 border">
                            {formatCurrency(history.old_price)}
                          </td>
                          <td className="px-1 py-1 text-right text-xs font-medium text-gray-900 border">
                            {formatCurrency(history.new_price)}
                          </td>
                          <td className={`px-1 py-1 text-right text-xs font-medium border ${getChangeColor(history.price_change)}`}>
                            <div className="flex items-center justify-end gap-1">
                              {getChangeIcon(history.price_change)}
                              <span className="truncate">{formatCurrency(Math.abs(history.price_change))}</span>
                            </div>
                          </td>
                          <td className={`px-1 py-1 text-center text-xs font-medium border ${getChangeColor(history.price_change)}`}>
                            {history.change_percentage > 0 ? '+' : ''}{history.change_percentage.toFixed(1)}%
                          </td>
                          <td className="px-1 py-1 border">
                            <span className={`inline-flex px-1 py-0.5 text-xs font-semibold rounded ${getReasonBadge(history.change_reason)}`}>
                              {history.change_reason.replace('_', ' ').slice(0, 6)}
                            </span>
                          </td>
                          <td className="px-1 py-1 text-xs text-gray-600 border">
                            {history.po_number && (
                              <div className="font-medium">
                                {poIds[history.po_number] ? (
                                  <a 
                                    href={`/purchaseorder/on_progress?id=${poIds[history.po_number]}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline truncate block max-w-16"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={history.po_number}
                                  >
                                    {history.po_number}
                                  </a>
                                ) : (
                                  <span className="text-gray-600 truncate block max-w-16" title={history.po_number}>{history.po_number}</span>
                                )}
                              </div>
                            )}
                            {history.notes && (
                              <div className="text-xs text-gray-500 mt-1 truncate max-w-20" title={history.notes}>
                                {history.po_number && history.notes.includes('PO') ? (
                                  <a 
                                    href={`/purchaseorder/on_progress?id=${poIds[history.po_number]}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {history.notes}
                                  </a>
                                ) : (
                                  history.notes
                                )}
                              </div>
                            )}
                          </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Mobile List View */}
          {isMobile && mobileView === 'list' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="p-3 border-b border-gray-200">
                    <div className="h-4 bg-gray-200 rounded animate-pulse mb-2 w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
                  </div>
                ))
              ) : paginatedHistory.length === 0 ? (
                <div className="p-8 text-center">
                  <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada riwayat harga</h3>
                  <p className="mt-1 text-sm text-gray-500">Belum ada perubahan harga yang tercatat</p>
                </div>
              ) : (
                paginatedHistory.map((history) => (
                  <div 
                    key={history.id} 
                    className={`p-3 border-b border-gray-200 cursor-pointer ${
                      isSuspiciousPrice(history.old_price, history.new_price, history.change_percentage)
                        ? 'bg-yellow-50 border-l-4 border-yellow-400'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => viewHistoryDetails(history)}
                  >
                    {isSuspiciousPrice(history.old_price, history.new_price, history.change_percentage) && (
                      <div className="text-xs text-yellow-800 mb-2 flex items-center gap-1">
                        ⚠️ Harga mencurigakan - Periksa kembali
                      </div>
                    )}
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{history.product_name}</h3>
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(history.change_date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatCurrency(history.new_price)}</div>
                        <div className={`text-xs flex items-center gap-1 ${getChangeColor(history.price_change)}`}>
                          {getChangeIcon(history.price_change)}
                          <span>{history.change_percentage > 0 ? '+' : ''}{history.change_percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getReasonBadge(history.change_reason)}`}>
                        {history.change_reason.replace('_', ' ')}
                      </span>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(history.old_price)} → {formatCurrency(history.new_price)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {priceHistory.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
              <p className="text-xs text-gray-600">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, priceHistory.length)} of {priceHistory.length} entries
              </p>
              <div className="flex gap-1">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(1)}
                  className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
                >
                  First
                </button>
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)}
                  className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
                >
                  Prev
                </button>
                <div className="flex items-center gap-1">
                  <span className="text-xs">Page</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={page}
                    onChange={(e) => {
                      const newPage = Math.max(1, Math.min(totalPages, Number(e.target.value)))
                      setPage(newPage)
                    }}
                    className="w-12 px-1 py-0.5 border rounded text-xs text-center"
                  />
                  <span className="text-xs">of {totalPages || 1}</span>
                </div>
                <button 
                  disabled={page === totalPages || totalPages === 0} 
                  onClick={() => setPage(p => p + 1)}
                  className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
                >
                  Next
                </button>
                <button 
                  disabled={page === totalPages || totalPages === 0} 
                  onClick={() => setPage(totalPages)}
                  className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
                >
                  Last
                </button>
              </div>
            </div>
          )}

          {/* Suspicious Price Alert */}
          {priceHistory.some(h => isSuspiciousPrice(h.old_price, h.new_price, h.change_percentage)) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-yellow-600">⚠️</span>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Peringatan Harga Mencurigakan</h3>
                  <p className="text-xs text-yellow-700">
                    Ditemukan {priceHistory.filter(h => isSuspiciousPrice(h.old_price, h.new_price, h.change_percentage)).length} 
                    {' '}perubahan harga yang mencurigakan (harga terlalu rendah atau perubahan ekstrem). 
                    Silakan periksa kembali data tersebut.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Price Movement Chart */}
          {chartData && (
            <div className="bg-white rounded-lg shadow p-2 md:p-3">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <TrendingUp className="text-blue-600" size={16} />
                Grafik Pergerakan Harga
              </h3>
              <div className={`${isMobile ? 'h-64' : 'h-80'}`}>
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                        labels: {
                          font: {
                            size: isMobile ? 10 : 12
                          }
                        }
                      },
                      title: {
                        display: true,
                        text: 'Pergerakan Harga Produk',
                        font: {
                          size: isMobile ? 12 : 14
                        }
                      },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return `${context.dataset.label}: ${new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              minimumFractionDigits: 0
                            }).format(context.parsed.y)}`
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: false,
                        ticks: {
                          font: {
                            size: isMobile ? 8 : 10
                          },
                          callback: function(value) {
                            return new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              minimumFractionDigits: 0,
                              notation: 'compact'
                            }).format(value as number)
                          }
                        }
                      },
                      x: {
                        title: {
                          display: true,
                          text: 'Tanggal',
                          font: {
                            size: isMobile ? 10 : 12
                          }
                        },
                        ticks: {
                          font: {
                            size: isMobile ? 8 : 10
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                * Menampilkan maksimal 6 produk dengan perubahan harga terbanyak<br/>
                * Baris dengan latar kuning menunjukkan harga yang mencurigakan
              </p>
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  )
}