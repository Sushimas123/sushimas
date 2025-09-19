"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { TrendingUp, TrendingDown, Package, Calendar } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

interface POPriceHistory {
  id: number
  po_number: string
  product_name: string
  po_price: number
  actual_price: number
  price_difference: number
  percentage_difference: number
  received_date: string
  invoice_number: string
}

export default function POPriceVariancePage() {
  const [priceHistory, setPriceHistory] = useState<POPriceHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPOPriceHistory()
  }, [])

  const fetchPOPriceHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('po_price_history')
        .select(`
          *,
          nama_product!inner(product_name)
        `)
        .order('received_date', { ascending: false })
        .limit(100)

      if (error) throw error

      const historyWithProductNames = data?.map(item => ({
        ...item,
        product_name: item.nama_product?.product_name || 'Unknown Product'
      })) || []

      setPriceHistory(historyWithProductNames)
    } catch (error) {
      console.error('Error fetching PO price history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getVarianceColor = (difference: number) => {
    if (difference > 0) return 'text-red-600 bg-red-50'
    if (difference < 0) return 'text-green-600 bg-green-50'
    return 'text-gray-600 bg-gray-50'
  }

  const getVarianceIcon = (difference: number) => {
    if (difference > 0) return <TrendingUp size={16} />
    if (difference < 0) return <TrendingDown size={16} />
    return null
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
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="text-blue-600" />
              PO Price Variance
            </h1>
            <p className="text-gray-600">Perbedaan harga antara PO dan harga aktual saat barang sampai</p>
          </div>

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Info</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harga PO</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harga Aktual</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Selisih</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">%</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {priceHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.po_number}</div>
                          <div className="text-sm text-gray-500">{item.invoice_number}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.product_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(item.po_price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(item.actual_price)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${getVarianceColor(item.price_difference).split(' ')[0]}`}>
                        <div className="flex items-center justify-end gap-1">
                          {getVarianceIcon(item.price_difference)}
                          {formatCurrency(Math.abs(item.price_difference))}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-center ${getVarianceColor(item.price_difference).split(' ')[0]}`}>
                        {item.percentage_difference > 0 ? '+' : ''}{item.percentage_difference.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(item.received_date).toLocaleDateString('id-ID')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {priceHistory.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Belum ada data price variance
              </div>
            )}
          </div>
        </div>
      </PageAccessControl>
    </Layout>
  )
}