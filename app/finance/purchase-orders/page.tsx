"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { DollarSign, FileText, AlertTriangle, TrendingUp, Search, Plus } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import PaymentModal from './PaymentModal'

interface FinanceData {
  id: number
  po_number: string
  po_date: string
  nama_supplier: string
  nama_branch: string
  total_po: number
  total_paid: number
  sisa_bayar: number
  status_payment: string
  is_overdue: boolean
  days_overdue: number
  tanggal_jatuh_tempo: string
  last_payment_date: string
}

export default function FinancePurchaseOrders() {
  const [data, setData] = useState<FinanceData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedPO, setSelectedPO] = useState<FinanceData | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    fetchFinanceData()
  }, [])

  const fetchFinanceData = async () => {
    try {
      const { data: financeData, error } = await supabase
        .from('finance_dashboard_view')
        .select('*')
        .order('po_date', { ascending: false })

      if (error) throw error
      setData(financeData || [])
    } catch (error) {
      console.error('Error fetching finance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredData = data.filter(item => {
    const matchesSearch = item.po_number.toLowerCase().includes(search.toLowerCase()) ||
                         item.nama_supplier.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || item.status_payment === statusFilter
    return matchesSearch && matchesStatus
  })

  const summary = {
    totalPO: data.reduce((sum, item) => sum + item.total_po, 0),
    totalPaid: data.reduce((sum, item) => sum + item.total_paid, 0),
    outstanding: data.reduce((sum, item) => sum + item.sisa_bayar, 0),
    overdue: data.filter(item => item.is_overdue).reduce((sum, item) => sum + item.sisa_bayar, 0)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50'
      case 'partial': return 'text-yellow-600 bg-yellow-50'
      case 'unpaid': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const handlePaymentSuccess = () => {
    fetchFinanceData()
    setShowPaymentModal(false)
    setSelectedPO(null)
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
      <PageAccessControl pageName="finance">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
            <p className="text-gray-600">Kelola pembayaran Purchase Orders</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Total PO</p>
                  <p className="text-lg font-semibold">{formatCurrency(summary.totalPO)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Sudah Dibayar</p>
                  <p className="text-lg font-semibold">{formatCurrency(summary.totalPaid)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Outstanding</p>
                  <p className="text-lg font-semibold">{formatCurrency(summary.outstanding)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Overdue</p>
                  <p className="text-lg font-semibold">{formatCurrency(summary.overdue)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow border mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Cari PO number atau supplier..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Semua Status</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Info</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total PO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dibayar</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sisa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jatuh Tempo</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((item) => (
                    <tr key={item.id} className={`hover:bg-gray-50 ${item.is_overdue ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.po_number}</div>
                          <div className="text-sm text-gray-500">{new Date(item.po_date).toLocaleDateString('id-ID')}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.nama_supplier}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.nama_branch}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.total_po)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.total_paid)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.sisa_bayar)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status_payment)}`}>
                          {item.status_payment.toUpperCase()}
                        </span>
                        {item.is_overdue && (
                          <div className="text-xs text-red-600 mt-1">
                            Overdue {item.days_overdue} hari
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{new Date(item.tanggal_jatuh_tempo).toLocaleDateString('id-ID')}</div>
                        {item.last_payment_date && (
                          <div className="text-xs text-gray-500">
                            Last: {new Date(item.last_payment_date).toLocaleDateString('id-ID')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {item.sisa_bayar > 0 && (
                          <button
                            onClick={() => {
                              setSelectedPO(item)
                              setShowPaymentModal(true)
                            }}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Bayar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Tidak ada data yang ditemukan
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedPO && (
          <PaymentModal
            po={selectedPO}
            onClose={() => {
              setShowPaymentModal(false)
              setSelectedPO(null)
            }}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </PageAccessControl>
    </Layout>
  )
}