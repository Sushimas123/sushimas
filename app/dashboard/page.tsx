"use client"

import React, { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'
import { BarChart3, TrendingUp, Package, AlertTriangle } from 'lucide-react'
import { supabase } from '@/src/lib/supabaseClient'

function RecentActivity() {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecentActivities()
  }, [])

  const fetchRecentActivities = async () => {
    try {
      // Get recent POs
      const { data: recentPOs } = await supabase
        .from('purchase_orders')
        .select('po_number, created_at, status')
        .order('created_at', { ascending: false })
        .limit(2)

      // Get recent barang masuk
      const { data: recentBarangMasuk } = await supabase
        .from('barang_masuk')
        .select('id_barang, created_at, nama_product(product_name)')
        .order('created_at', { ascending: false })
        .limit(2)

      // Get recent production
      const { data: recentProduction } = await supabase
        .from('produksi')
        .select('nama_produk, created_at, status')
        .order('created_at', { ascending: false })
        .limit(2)

      const allActivities = [
        ...(recentPOs?.map(po => ({
          action: 'PO Baru Dibuat',
          item: po.po_number,
          time: formatTimeAgo(po.created_at),
          type: 'success'
        })) || []),
        ...(recentBarangMasuk?.map(bm => ({
          action: 'Barang Masuk',
          item: (bm.nama_product as any)?.product_name || 'Unknown Product',
          time: formatTimeAgo(bm.created_at),
          type: 'info'
        })) || []),
        ...(recentProduction?.map(prod => ({
          action: prod.status === 'completed' ? 'Produksi Selesai' : 'Produksi Dimulai',
          item: prod.nama_produk,
          time: formatTimeAgo(prod.created_at),
          type: prod.status === 'completed' ? 'success' : 'info'
        })) || [])
      ]

      // Sort by time and take top 4
      setActivities(allActivities.slice(0, 4))
    } catch (error) {
      // Error fetching recent activities
    } finally {
      setLoading(false)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} menit lalu`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} jam lalu`
    } else {
      return `${Math.floor(diffInMinutes / 1440)} hari lalu`
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full mr-3 bg-gray-300"></div>
              <div>
                <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
                <div className="h-3 bg-gray-300 rounded w-16"></div>
              </div>
            </div>
            <div className="h-3 bg-gray-300 rounded w-12"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.length > 0 ? activities.map((activity, index) => {
        const getActivityLink = (activity: any) => {
          if (activity.action === 'PO Baru Dibuat') return '/purchaseorder'
          if (activity.action === 'Barang Masuk') return '/purchaseorder/barang_masuk'
          if (activity.action.includes('Produksi')) return '/produksi'
          return '#'
        }
        
        return (
          <a key={index} href={getActivityLink(activity)} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${
                activity.type === 'success' ? 'bg-gray-600' :
                activity.type === 'warning' ? 'bg-gray-500' : 'bg-gray-700'
              }`}></div>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white">{activity.action}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{activity.item}</p>
              </div>
            </div>
            <span className="text-xs text-gray-400">{activity.time}</span>
          </a>
        )
      }) : (
        <div className="p-4 text-center text-gray-500">
          Belum ada aktivitas terbaru
        </div>
      )}
    </div>
  )
}

function DashboardContent() {
  return (
    <div className="space-y-6">
      
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
              <BarChart3 className="mr-2 text-gray-600" size={20} />
              Aktivitas Terbaru
            </h3>
            <button className="text-gray-600 text-sm hover:text-gray-800">Lihat Semua</button>
          </div>
          <RecentActivity />
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
            <Package className="mr-2 text-gray-600" size={20} />
            Aksi Cepat
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'Buat PO Baru', href: '/purchaseorder/create', color: 'bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-800 hover:bg-white/90' },
              { name: 'Input Produksi', href: '/produksi', color: 'bg-white/70 backdrop-blur-sm border border-gray-200 text-gray-800 hover:bg-white/80' },
              { name: 'Cek Stock Alert', href: '/purchaseorder/stock-alert', color: 'bg-white/60 backdrop-blur-sm border border-gray-200 text-gray-800 hover:bg-white/70' },
              { name: 'Lihat Gudang', href: '/gudang', color: 'bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-800 hover:bg-white' }
            ].map((action, index) => (
              <a
                key={index}
                href={action.href}
                className={`${action.color} p-4 rounded-lg text-center text-sm font-medium transition-all hover:shadow-lg hover:scale-105`}
              >
                {action.name}
              </a>
            ))}
          </div>
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