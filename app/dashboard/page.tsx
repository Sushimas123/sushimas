"use client"

import React, { useState, useEffect, useMemo } from 'react'
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'
import { BarChart3, TrendingUp, Package, AlertTriangle, DollarSign, Users, Factory, Truck, ShoppingCart, Wallet } from 'lucide-react'
import { supabase } from '@/src/lib/supabaseClient'

interface KPIData {
  totalPOs: number
  pendingPOs: number
  totalStock: number
  lowStock: number
  totalProduction: number
  activeProduction: number
  totalPettyCash: number
  pendingRequests: number
  totalSuppliers: number
  totalUsers: number
}

function KPICards({ data, loading }: { data: KPIData; loading: boolean }) {
  const kpis = [
    { title: 'Total PO', value: data.totalPOs, subtext: `${data.pendingPOs} pending`, icon: ShoppingCart, href: '/purchaseorder' },
    { title: 'Stock Items', value: data.totalStock, subtext: `${data.lowStock} low stock`, icon: Package, href: '/gudang-final' },
    { title: 'Production', value: data.totalProduction, subtext: `${data.activeProduction} active`, icon: Factory, href: '/produksi' },
    { title: 'Petty Cash', value: `Rp ${(data.totalPettyCash / 1000000).toFixed(1)}JT`, subtext: `${data.pendingRequests} requests`, icon: Wallet, href: '/pettycash' },
    { title: 'Suppliers', value: data.totalSuppliers, subtext: 'Active suppliers', icon: Truck, href: '/supplier' },
    { title: 'Users', value: data.totalUsers, subtext: 'System users', icon: Users, href: '/users' }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-300 rounded mb-2"></div>
            <div className="h-6 bg-gray-300 rounded mb-1"></div>
            <div className="h-3 bg-gray-300 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <a key={index} href={kpi.href} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2">
                <Icon size={16} className="text-gray-600 dark:text-gray-400" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{kpi.title}</h3>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
            <p className="text-xs text-gray-500">{kpi.subtext}</p>
          </a>
        )
      })}
    </div>
  )
}

function RecentActivity() {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecentActivities()
  }, [])

  const fetchRecentActivities = async () => {
    try {
      const [poData, barangData, prodData, pettyCashData] = await Promise.all([
        supabase.from('purchase_orders').select('po_number, created_at, status').order('created_at', { ascending: false }).limit(3),
        supabase.from('barang_masuk').select('id_barang, created_at, nama_product(product_name)').order('created_at', { ascending: false }).limit(2),
        supabase.from('produksi').select('nama_produk, created_at, status').order('created_at', { ascending: false }).limit(2),
        supabase.from('petty_cash_requests').select('purpose, created_at, status').order('created_at', { ascending: false }).limit(2)
      ])

      const allActivities = [
        ...(poData.data?.map(po => ({ action: 'PO Dibuat', item: po.po_number, time: formatTimeAgo(po.created_at), type: 'success', href: '/purchaseorder' })) || []),
        ...(barangData.data?.map(bm => ({ action: 'Barang Masuk', item: (bm.nama_product as any)?.product_name || 'Product', time: formatTimeAgo(bm.created_at), type: 'info', href: '/purchaseorder/barang_masuk' })) || []),
        ...(prodData.data?.map(prod => ({ action: prod.status === 'completed' ? 'Produksi Selesai' : 'Produksi Dimulai', item: prod.nama_produk, time: formatTimeAgo(prod.created_at), type: 'info', href: '/produksi' })) || []),
        ...(pettyCashData.data?.map(pc => ({ action: 'Petty Cash Request', item: pc.purpose, time: formatTimeAgo(pc.created_at), type: 'warning', href: '/pettycash' })) || [])
      ]

      setActivities(allActivities.slice(0, 6))
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse">
            <div className="w-3 h-3 rounded-full mr-3 bg-gray-300"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
              <div className="h-3 bg-gray-300 rounded w-16"></div>
            </div>
            <div className="h-3 bg-gray-300 rounded w-12"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {activities.map((activity, index) => (
        <a key={index} href={activity.href} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-3 ${
              activity.type === 'success' ? 'bg-gray-400' :
              activity.type === 'warning' ? 'bg-gray-300' : 'bg-gray-400'
            }`}></div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">{activity.action}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{activity.item}</p>
            </div>
          </div>
          <span className="text-xs text-gray-400">{activity.time}</span>
        </a>
      ))}
    </div>
  )
}

function QuickActions() {
  const actions = [
    { name: 'Buat PO', href: '/purchaseorder/create', icon: ShoppingCart },
    { name: 'Cek Stock', href: '/gudang-final', icon: Package },
    { name: 'Produksi', href: '/produksi', icon: Factory },
    { name: 'Petty Cash', href: '/pettycash', icon: Wallet },
    { name: 'Transfer', href: '/transfer-barang', icon: Truck },
    { name: 'Analysis', href: '/analysis', icon: BarChart3 }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {actions.map((action, index) => {
        const Icon = action.icon
        return (
          <a key={index} href={action.href} className="border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 p-4 rounded-lg text-center transition-all hover:scale-105">
            <Icon className="mx-auto mb-2 text-gray-600 dark:text-gray-400" size={20} />
            <span className="text-sm font-medium">{action.name}</span>
          </a>
        )
      })}
    </div>
  )
}

function DashboardContent() {
  const [kpiData, setKpiData] = useState<KPIData>({
    totalPOs: 0, pendingPOs: 0, totalStock: 0, lowStock: 0,
    totalProduction: 0, activeProduction: 0, totalPettyCash: 0,
    pendingRequests: 0, totalSuppliers: 0, totalUsers: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchKPIData()
  }, [])

  const fetchKPIData = async () => {
    try {
      const [poData, stockData, prodData, pettyCashData, supplierData, userData] = await Promise.all([
        supabase.from('purchase_orders').select('status'),
        supabase.from('gudang_final_view').select('running_total'),        
        supabase.from('produksi').select('production_no, divisi'),
        supabase.from('petty_cash_requests').select('amount, status'),
        supabase.from('suppliers').select('id_supplier'),
        supabase.from('users').select('id_user')
      ])

      const totalPettyCash = pettyCashData.data?.reduce((sum, req) => sum + (req.amount || 0), 0) || 0
      const pendingRequests = pettyCashData.data?.filter(req => req.status === 'pending').length || 0
      const lowStockCount = stockData.data?.filter(item => (item.running_total || 0) < 10).length || 0

      setKpiData({
        totalPOs: poData.data?.length || 0,
        pendingPOs: poData.data?.filter(po => po.status === 'pending').length || 0,
        totalStock: stockData.data?.length || 0,
        lowStock: lowStockCount,
        totalProduction: prodData.data?.length || 0,
        activeProduction: 0, // Status not available in current query
        totalPettyCash: totalPettyCash,
        pendingRequests,
        totalSuppliers: supplierData.data?.length || 0,
        totalUsers: userData.data?.length || 0
      })
    } catch (error) {
      console.error('Error fetching KPI data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Overview of your business operations</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards data={kpiData} loading={loading} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
              <BarChart3 className="mr-2 text-gray-600" size={20} />
              Recent Activity
            </h3>
            <button className="text-gray-600 text-sm hover:text-gray-800">View All</button>
          </div>
          <RecentActivity />
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
            <Package className="mr-2 text-gray-600" size={20} />
            Quick Actions
          </h3>
          <QuickActions />
        </div>
      </div>

      {/* Alerts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
          <AlertTriangle className="mr-2 text-gray-400" size={20} />
          System Alerts
        </h3>
        <div className="space-y-3">
          {kpiData.lowStock > 0 && (
            <div className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
              <AlertTriangle className="text-gray-400 mr-3" size={16} />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{kpiData.lowStock} items with low stock</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Consider restocking soon</p>
              </div>
            </div>
          )}
          {kpiData.pendingPOs > 5 && (
            <div className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
              <Package className="text-gray-400 mr-3" size={16} />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{kpiData.pendingPOs} pending purchase orders</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Review and process pending orders</p>
              </div>
            </div>
          )}
          {kpiData.pendingRequests > 0 && (
            <div className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
              <Wallet className="text-gray-400 mr-3" size={16} />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{kpiData.pendingRequests} pending petty cash requests</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Approve or review requests</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Layout>
      <PageAccessControl pageName="dashboard">
        <DashboardContent />
      </PageAccessControl>
    </Layout>
  )
}