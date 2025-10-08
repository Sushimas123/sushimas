"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { TrendingDown, FileText } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import { useRouter } from 'next/navigation'


interface AgingData {
  id: number
  po_number: string
  po_date: string
  nama_supplier: string
  nama_branch: string
  total_po: number
  total_paid: number
  outstanding: number
  tanggal_jatuh_tempo: string
  days_overdue: number
  aging_bucket: string
}

export default function AgingReport() {
  const router = useRouter()
  const [data, setData] = useState<AgingData[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobileView, setIsMobileView] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)

  const navigateToPO = (poId: number) => {
    router.push(`/purchaseorder/received-preview?id=${poId}`)
  }

  useEffect(() => {
    fetchAgingData()
  }, [])

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const fetchAgingData = async () => {
    try {
      const { data: financeData, error } = await supabase
        .from('finance_dashboard_view')
        .select('*')
        .neq('status_payment', 'paid')
        .not('tanggal_barang_sampai', 'is', null)  // Only show items where goods have arrived
        .order('days_overdue', { ascending: false })

      if (error) throw error
      
      // Recalculate totals and filter only unpaid/partial
      const correctedData = await Promise.all(
        (financeData || []).map(async (item: any) => {
          // Check for bulk payment reference
          const { data: poData } = await supabase
            .from('purchase_orders')
            .select('bulk_payment_ref')
            .eq('id', item.id)
            .single()

          // If has bulk payment reference, consider it paid
          if (poData?.bulk_payment_ref) {
            return null // Skip this item as it's paid via bulk payment
          }

          const { data: items } = await supabase
            .from('po_items')
            .select('qty, actual_price, received_qty, product_id')
            .eq('po_id', item.id)

          let correctedTotal = 0
          for (const poItem of items || []) {
            if (poItem.actual_price && poItem.received_qty) {
              correctedTotal += poItem.received_qty * poItem.actual_price
            } else {
              const { data: product } = await supabase
                .from('nama_product')
                .select('harga')
                .eq('id_product', poItem.product_id)
                .single()
              correctedTotal += poItem.qty * (product?.harga || 0)
            }
          }

          const sisaBayar = correctedTotal - item.total_paid
          
          // Skip if fully paid
          if (sisaBayar <= 0) {
            return null
          }

          return {
            ...item,
            total_po: correctedTotal,
            sisa_bayar: sisaBayar,
            outstanding: sisaBayar,
            aging_bucket: getAgingBucket(item.days_overdue)
          }
        })
      )
      
      // Filter out null items (paid POs) and items with no outstanding balance
      const filteredData = correctedData.filter(item => item !== null && item.outstanding > 0)
      setData(filteredData)
    } catch (error) {
      console.error('Error fetching aging data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAgingBucket = (daysOverdue: number) => {
    if (daysOverdue <= 0) return 'current'
    return '1-30_days'
  }

  const getBucketLabel = (bucket: string) => {
    switch (bucket) {
      case 'current': return 'Current'
      case '1-30_days': return '1-30 Hari'
      default: return bucket
    }
  }

  const getBucketColor = (bucket: string) => {
    switch (bucket) {
      case 'current': return 'text-green-600 bg-green-50'
      case '1-30_days': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const summary = {
    current: data.filter(item => item.aging_bucket === 'current').reduce((sum, item) => sum + item.outstanding, 0),
    days1_30: data.filter(item => item.aging_bucket === '1-30_days').reduce((sum, item) => sum + item.outstanding, 0)
  }

  const totalOutstanding = Object.values(summary).reduce((sum, val) => sum + val, 0)

  // Pagination
  const totalPages = Math.ceil(data.length / pageSize)
  const paginatedData = data.slice((page - 1) * pageSize, page * pageSize)

  // Mobile Components
  const MobileAgingCard = ({ item }: { item: AgingData }) => {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }

    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 mb-3 p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <button
              onClick={() => navigateToPO(item.id)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              {item.po_number}
            </button>
            <p className="text-xs text-gray-500">{item.nama_supplier}</p>
          </div>
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getBucketColor(item.aging_bucket)}`}>
            {getBucketLabel(item.aging_bucket)}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-gray-500">Cabang</p>
            <p className="text-sm font-medium">{item.nama_branch}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Outstanding</p>
            <p className="text-sm font-medium text-red-600">{formatCurrency(item.outstanding)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">PO Date</p>
            <p className="text-sm">{formatDate(item.po_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Due Date</p>
            <p className="text-sm">{formatDate(item.tanggal_jatuh_tempo)}</p>
          </div>
        </div>
        
        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Days Overdue</p>
            <p className={`text-sm font-medium ${item.days_overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {item.days_overdue > 0 ? `${item.days_overdue} hari` : 'Belum jatuh tempo'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Total PO</p>
            <p className="text-sm font-medium">{formatCurrency(item.total_po)}</p>
          </div>
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

  // Mobile view
  if (isMobileView) {
    return (
      <Layout>
        <PageAccessControl pageName="aging-report">
          <div className="p-4 bg-gray-50 min-h-screen">
            <div className="mb-4">
              <h1 className="text-s font-bold text-gray-900">Aging Report</h1>
              <p className="text-s   text-gray-600">Laporan umur piutang</p>
            </div>

            {/* Mobile Summary Cards */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white p-2 rounded shadow border">
                <div className="text-center">
                  <p className="text-xs text-green-600 font-medium">Current</p>
                  <p className="text-xs font-semibold">{formatCurrency(summary.current)}</p>
                  <p className="text-xs text-gray-500">
                    {totalOutstanding > 0 ? ((summary.current / totalOutstanding) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
              <div className="bg-white p-2 rounded shadow border">
                <div className="text-center">
                  <p className="text-xs text-yellow-600 font-medium">1-30 Hari</p>
                  <p className="text-xs font-semibold">{formatCurrency(summary.days1_30)}</p>
                  <p className="text-xs text-gray-500">
                    {totalOutstanding > 0 ? ((summary.days1_30 / totalOutstanding) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Total Outstanding */}
            <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <TrendingDown className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-xs font-semibold text-blue-900">Total Outstanding</span>
                </div>
                <span className="text-sm font-bold text-blue-900">{formatCurrency(totalOutstanding)}</span>
              </div>
            </div>

            {/* Mobile Cards List */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Detail Aging ({data.length} items)</h3>
              {paginatedData.map((item) => (
                <MobileAgingCard key={item.id} item={item} />
              ))}
            </div>

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center bg-white p-3 rounded shadow">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm bg-gray-100 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm bg-gray-100 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}

            {data.length === 0 && (
              <div className="text-center py-8 text-gray-500 bg-white rounded-lg border">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Tidak ada outstanding payment</p>
              </div>
            )}
          </div>
        </PageAccessControl>
      </Layout>
    )
  }

  // Desktop view
  return (
    <Layout>
      <PageAccessControl pageName="aging-report">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-s font-bold text-gray-900">Aging Report</h1>
            <p className="text-gray-600">Laporan umur piutang berdasarkan jatuh tempo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <div className="bg-white p-3 rounded shadow border">
              <div className="text-center">
                <p className="text-xs text-green-600 font-medium">Current</p>
                <p className="text-sm font-semibold">{formatCurrency(summary.current)}</p>
                <p className="text-xs text-gray-500">
                  {totalOutstanding > 0 ? ((summary.current / totalOutstanding) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
            <div className="bg-white p-3 rounded shadow border">
              <div className="text-center">
                <p className="text-xs text-yellow-600 font-medium">1-30 Hari</p>
                <p className="text-sm font-semibold">{formatCurrency(summary.days1_30)}</p>
                <p className="text-xs text-gray-500">
                  {totalOutstanding > 0 ? ((summary.days1_30 / totalOutstanding) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <TrendingDown className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-xs font-semibold text-blue-900">Total</span>
                </div>
                <span className="text-sm font-bold text-blue-900">{formatCurrency(totalOutstanding)}</span>
              </div>
            </div>
          </div>



          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Detail Aging Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Info</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Overdue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aging</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <button
                            onClick={() => navigateToPO(item.id)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {item.po_number}
                          </button>
                          <div className="text-sm text-gray-500">Total: {formatCurrency(item.total_po)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.nama_supplier}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.nama_branch}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div>PO: {new Date(item.po_date).toLocaleDateString('id-ID')}</div>
                          <div className="text-xs text-gray-500">
                            Due: {new Date(item.tanggal_jatuh_tempo).toLocaleDateString('id-ID')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{formatCurrency(item.outstanding)}</div>
                        <div className="text-xs text-gray-500">
                          Paid: {formatCurrency(item.total_paid)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`font-medium ${item.days_overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {item.days_overdue > 0 ? `${item.days_overdue} hari` : 'Belum jatuh tempo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getBucketColor(item.aging_bucket)}`}>
                          {getBucketLabel(item.aging_bucket)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Tidak ada outstanding payment</p>
            </div>
          )}

          {/* Desktop Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, data.length)} of {data.length} entries
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`px-3 py-2 text-sm rounded ${
                      page === i + 1
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  )
}