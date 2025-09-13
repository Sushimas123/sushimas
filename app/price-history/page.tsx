"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react'
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'

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

  const fetchProducts = async () => {
    try {
      const { data } = await supabase
        .from('nama_product')
        .select('id_product, product_name')
        .order('product_name')
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchPriceHistory = async () => {
    try {
      let query = supabase
        .from('price_history')
        .select(`
          *,
          nama_product!inner(product_name)
        `)
        .order('change_date', { ascending: false })
        .limit(100)

      if (filters.product_id) {
        query = query.eq('product_id', filters.product_id)
      }
      if (filters.date_from) {
        query = query.gte('change_date', filters.date_from)
      }
      if (filters.date_to) {
        query = query.lte('change_date', filters.date_to + 'T23:59:59')
      }
      if (filters.change_reason) {
        query = query.eq('change_reason', filters.change_reason)
      }

      const { data, error } = await query

      if (error) throw error

      const historyWithProductNames = data?.map(item => ({
        ...item,
        product_name: item.nama_product?.product_name || 'Unknown Product'
      })) || []

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
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, po_number')
        .in('po_number', poNumbers)
      
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

  const getReasonBadge = (reason: string) => {
    const colors = {
      'po_completion': 'bg-blue-100 text-blue-800',
      'manual_update': 'bg-yellow-100 text-yellow-800',
      'market_adjustment': 'bg-purple-100 text-purple-800'
    }
    return colors[reason as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp className="text-blue-600" size={28} />
              Price History
            </h1>
            <p className="text-gray-600 mt-1">Riwayat perubahan harga produk</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={16} className="text-gray-500" />
              <h3 className="font-medium text-gray-800">Filter</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative product-search-container">
                <label className="block text-sm font-medium text-gray-700 mb-1">Produk</label>
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Cari produk..."
                />
                {showProductDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({...filters, date_from: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({...filters, date_to: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Perubahan</label>
                <select
                  value={filters.change_reason}
                  onChange={(e) => setFilters({...filters, change_reason: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
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
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 text-sm"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </div>

          {/* Price History Table */}
          <div className="bg-white rounded-lg shadow">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Memuat data...</p>
              </div>
            ) : priceHistory.length === 0 ? (
              <div className="p-8 text-center">
                <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada riwayat harga</h3>
                <p className="mt-1 text-sm text-gray-500">Belum ada perubahan harga yang tercatat</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harga Lama</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harga Baru</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Perubahan</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">%</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alasan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO/Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {priceHistory.map((history) => (
                      <tr key={history.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex items-center">
                            <Calendar size={14} className="mr-1 text-gray-400" />
                            {formatDate(history.change_date)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{history.product_name}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {formatCurrency(history.old_price)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(history.new_price)}
                        </td>
                        <td className={`px-4 py-3 text-right text-sm font-medium ${getChangeColor(history.price_change)}`}>
                          <div className="flex items-center justify-end gap-1">
                            {getChangeIcon(history.price_change)}
                            {formatCurrency(Math.abs(history.price_change))}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-center text-sm font-medium ${getChangeColor(history.price_change)}`}>
                          {history.change_percentage > 0 ? '+' : ''}{history.change_percentage.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getReasonBadge(history.change_reason)}`}>
                            {history.change_reason.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {history.po_number && (
                            <div className="font-medium">
                              {poIds[history.po_number] ? (
                                <a 
                                  href={`/purchaseorder/on_progress?id=${poIds[history.po_number]}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {history.po_number}
                                </a>
                              ) : (
                                <span className="text-gray-600">{history.po_number}</span>
                              )}
                            </div>
                          )}
                          {history.notes && (
                            <div className="text-xs text-gray-500 mt-1">{history.notes}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Price Movement Chart */}
          {chartData && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="text-blue-600" size={20} />
                Grafik Pergerakan Harga
              </h3>
              <div className="h-96">
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                      title: {
                        display: true,
                        text: 'Pergerakan Harga Produk'
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
                          text: 'Tanggal'
                        }
                      }
                    }
                  }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                * Menampilkan maksimal 6 produk dengan perubahan harga terbanyak
              </p>
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  )
}