"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { PackageCheck, ShoppingBasket, Factory, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'

interface OverviewData {
  totalStock: number
  stockChange: number
  activePOs: number
  urgentPOs: number
  productionItems: number
  productionInProgress: number
  stockAlerts: number
  lowStockItems: number
}

export default function DashboardOverview() {
  const [data, setData] = useState<OverviewData>({
    totalStock: 0,
    stockChange: 0,
    activePOs: 0,
    urgentPOs: 0,
    productionItems: 0,
    productionInProgress: 0,
    stockAlerts: 0,
    lowStockItems: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOverviewData()
  }, [])

  const fetchOverviewData = async () => {
    try {
      // Fetch total stock from gudang
      const { data: stockData } = await supabase
        .from('gudang')
        .select('total_gudang')
      
      const totalStock = stockData?.reduce((sum, item) => sum + (item.total_gudang || 0), 0) || 0

      // Fetch active POs
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('status, priority')
        .in('status', ['Pending', 'Sedang diproses'])
      
      const activePOs = poData?.length || 0
      const urgentPOs = poData?.filter(po => po.priority === 'tinggi').length || 0

      // Fetch production data
      const { data: productionData } = await supabase
        .from('produksi')
        .select('jumlah_buat')
      
      const productionItems = productionData?.length || 0
      const productionInProgress = productionData?.filter(p => p.jumlah_buat > 0).length || 0

      // Fetch stock alerts (simplified)
      const { data: alertData } = await supabase
        .from('gudang')
        .select('total_gudang')
        .lt('total_gudang', 10) // Items with less than 10 qty
      
      const stockAlerts = alertData?.length || 0

      // Calculate stock change from recent transactions
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: recentTransactions } = await supabase
        .from('gudang')
        .select('qty, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
      
      const recentStockChange = recentTransactions?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0
      const stockChangePercentage = totalStock > 0 ? Math.round((recentStockChange / totalStock) * 100) : 0

      setData({
        totalStock,
        stockChange: stockChangePercentage,
        activePOs,
        urgentPOs,
        productionItems,
        productionInProgress,
        stockAlerts,
        lowStockItems: stockAlerts
      })
    } catch (error) {
      console.error('Error fetching overview data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k'
    }
    return num.toString()
  }

  const cards = [
    {
      title: 'Total Stok',
      value: formatNumber(data.totalStock),
      change: `+${data.stockChange}% dari bulan lalu`,
      icon: PackageCheck,
      bgColor: 'bg-white/80 backdrop-blur-sm border border-gray-200',
      textColor: 'text-gray-800',
      changePositive: data.stockChange > 0
    },
    {
      title: 'PO Aktif',
      value: data.activePOs.toString(),
      change: `${data.urgentPOs} perlu perhatian`,
      icon: ShoppingBasket,
      bgColor: 'bg-white/70 backdrop-blur-sm border border-gray-200',
      textColor: 'text-gray-800',
      changePositive: data.urgentPOs === 0
    },
    {
      title: 'Produksi',
      value: data.productionItems.toString(),
      change: `${data.productionInProgress} dalam proses`,
      icon: Factory,
      bgColor: 'bg-white/60 backdrop-blur-sm border border-gray-200',
      textColor: 'text-gray-800',
      changePositive: data.productionInProgress > 0
    },
    {
      title: 'Perhatian',
      value: data.stockAlerts.toString(),
      change: 'Stok menipis',
      icon: AlertTriangle,
      bgColor: 'bg-white/90 backdrop-blur-sm border border-gray-200',
      textColor: 'text-gray-800',
      changePositive: data.stockAlerts === 0
    }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-200 rounded-lg p-4 animate-pulse">
            <div className="h-6 bg-gray-300 rounded mb-2"></div>
            <div className="h-8 bg-gray-300 rounded mb-1"></div>
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  
}