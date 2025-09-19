"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { TrendingDown, FileText } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

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
  const [data, setData] = useState<AgingData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAgingData()
  }, [])

  const fetchAgingData = async () => {
    try {
      const { data: agingData, error } = await supabase
        .from('finance_dashboard_view')
        .select('*')
        .gt('sisa_bayar', 0)
        .order('days_overdue', { ascending: false })

      if (error) throw error
      
      const processedData = agingData?.map(item => ({
        ...item,
        outstanding: item.sisa_bayar,
        aging_bucket: getAgingBucket(item.days_overdue)
      })) || []

      setData(processedData)
    } catch (error) {
      console.error('Error fetching aging data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAgingBucket = (daysOverdue: number) => {
    if (daysOverdue <= 0) return 'current'
    if (daysOverdue <= 30) return '1-30_days'
    if (daysOverdue <= 60) return '31-60_days'
    if (daysOverdue <= 90) return '61-90_days'
    return 'over_90_days'
  }

  const getBucketLabel = (bucket: string) => {
    switch (bucket) {
      case 'current': return 'Current'
      case '1-30_days': return '1-30 Hari'
      case '31-60_days': return '31-60 Hari'
      case '61-90_days': return '61-90 Hari'
      case 'over_90_days': return '>90 Hari'
      default: return bucket
    }
  }

  const getBucketColor = (bucket: string) => {
    switch (bucket) {
      case 'current': return 'text-green-600 bg-green-50'
      case '1-30_days': return 'text-yellow-600 bg-yellow-50'
      case '31-60_days': return 'text-orange-600 bg-orange-50'
      case '61-90_days': return 'text-red-600 bg-red-50'
      case 'over_90_days': return 'text-red-800 bg-red-100'
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
    days1_30: data.filter(item => item.aging_bucket === '1-30_days').reduce((sum, item) => sum + item.outstanding, 0),
    days31_60: data.filter(item => item.aging_bucket === '31-60_days').reduce((sum, item) => sum + item.outstanding, 0),
    days61_90: data.filter(item => item.aging_bucket === '61-90_days').reduce((sum, item) => sum + item.outstanding, 0),
    over90: data.filter(item => item.aging_bucket === 'over_90_days').reduce((sum, item) => sum + item.outstanding, 0)
  }

  const totalOutstanding = Object.values(summary).reduce((sum, val) => sum + val, 0)

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
      <PageAccessControl pageName="aging-report">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Aging Report</h1>
            <p className="text-gray-600">Laporan umur piutang berdasarkan jatuh tempo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-center">
                <p className="text-sm text-green-600 font-medium">Current</p>
                <p className="text-lg font-semibold">{formatCurrency(summary.current)}</p>
                <p className="text-xs text-gray-500">
                  {totalOutstanding > 0 ? ((summary.current / totalOutstanding) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-center">
                <p className="text-sm text-yellow-600 font-medium">1-30 Hari</p>
                <p className="text-lg font-semibold">{formatCurrency(summary.days1_30)}</p>
                <p className="text-xs text-gray-500">
                  {totalOutstanding > 0 ? ((summary.days1_30 / totalOutstanding) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-center">
                <p className="text-sm text-orange-600 font-medium">31-60 Hari</p>
                <p className="text-lg font-semibold">{formatCurrency(summary.days31_60)}</p>
                <p className="text-xs text-gray-500">
                  {totalOutstanding > 0 ? ((summary.days31_60 / totalOutstanding) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-center">
                <p className="text-sm text-red-600 font-medium">61-90 Hari</p>
                <p className="text-lg font-semibold">{formatCurrency(summary.days61_90)}</p>
                <p className="text-xs text-gray-500">
                  {totalOutstanding > 0 ? ((summary.days61_90 / totalOutstanding) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-center">
                <p className="text-sm text-red-800 font-medium">&gt;90 Hari</p>
                <p className="text-lg font-semibold">{formatCurrency(summary.over90)}</p>
                <p className="text-xs text-gray-500">
                  {totalOutstanding > 0 ? ((summary.over90 / totalOutstanding) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingDown className="h-6 w-6 text-blue-600 mr-2" />
                <span className="text-lg font-semibold text-blue-900">Total Outstanding</span>
              </div>
              <span className="text-2xl font-bold text-blue-900">{formatCurrency(totalOutstanding)}</span>
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
                  {data.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.po_number}</div>
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
        </div>
      </PageAccessControl>
    </Layout>
  )
}