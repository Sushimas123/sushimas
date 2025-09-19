"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { DollarSign, Calendar, AlertTriangle, CheckCircle, Clock, Search, Plus } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import PaymentModal from './PaymentModal'

interface FinancePO {
  id: number
  po_number: string
  po_date: string
  nama_branch: string
  nama_supplier: string
  nomor_rekening?: string
  bank_penerima?: string
  nama_penerima?: string
  termin_days: number
  tanggal_jatuh_tempo: string
  po_status: string
  priority: string
  invoice_number?: string
  bukti_foto?: string
  tanggal_barang_sampai?: string
  total_po: number
  total_paid: number
  sisa_bayar: number
  status_payment: string
  is_overdue: boolean
  days_overdue: number
  last_payment_date?: string
}

export default function FinancePurchaseOrders() {
  const [data, setData] = useState<FinancePO[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedPO, setSelectedPO] = useState<FinancePO | null>(null)
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
    const matchesSearch = item.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.nama_supplier.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'unpaid' && item.status_payment === 'unpaid') ||
                         (statusFilter === 'partial' && item.status_payment === 'partial') ||
                         (statusFilter === 'paid' && item.status_payment === 'paid') ||
                         (statusFilter === 'overdue' && item.is_overdue)
    
    return matchesSearch && matchesStatus
  })

  const summary = {
    total: data.reduce((sum, item) => sum + item.total_po, 0),
    paid: data.reduce((sum, item) => sum + item.total_paid, 0),
    outstanding: data.reduce((sum, item) => sum + item.sisa_bayar, 0),
    overdue: data.filter(item => item.is_overdue).reduce((sum, item) => sum + item.sisa_bayar, 0)
  }

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'text-red-600 bg-red-50'
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50'
      case 'partial': return 'text-yellow-600 bg-yellow-50'
      case 'unpaid': return 'text-gray-600 bg-gray-50'
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
      <PageAccessControl allowedRoles={['super admin', 'admin', 'finance']}>
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Finance - Purchase Orders</h1>
            <p className="text-gray-600">Kelola pembayaran dan tracking PO</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Total PO</p>
                  <p className="text-lg font-semibold">{formatCurrency(summary.total)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Sudah Dibayar</p>
                  <p className="text-lg font-semibold">{formatCurrency(summary.paid)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
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

          <div className="bg-white p-4 rounded-lg shadow border mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Cari PO Number atau Supplier..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <select
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="unpaid">Belum Bayar</option>
                <option value="partial">Bayar Sebagian</option>
                <option value="paid">Lunas</option>
                <option value="overdue">Terlambat</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Info</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.po_number}</div>
                          <div className="text-sm text-gray-500">{item.nama_branch}</div>
                          {item.invoice_number && (
                            <div className="text-xs text-blue-600">Invoice: {item.invoice_number}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.nama_supplier}</div>
                          {item.bank_penerima && (
                            <div className="text-xs text-gray-500">{item.bank_penerima} - {item.nomor_rekening}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div>PO: {new Date(item.po_date).toLocaleDateString('id-ID')}</div>
                          <div className={`text-xs ${item.is_overdue ? 'text-red-600' : 'text-gray-500'}`}>
                            Jatuh Tempo: {new Date(item.tanggal_jatuh_tempo).toLocaleDateString('id-ID')}
                          </div>
                          {item.is_overdue && (
                            <div className="text-xs text-red-600 font-medium">
                              Terlambat {item.days_overdue} hari
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{formatCurrency(item.total_po)}</div>
                          {item.sisa_bayar > 0 && (
                            <div className="text-xs text-red-600">Sisa: {formatCurrency(item.sisa_bayar)}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div>{formatCurrency(item.total_paid)}</div>
                          {item.last_payment_date && (
                            <div className="text-xs text-gray-500">
                              Terakhir: {new Date(item.last_payment_date).toLocaleDateString('id-ID')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status_payment, item.is_overdue)}`}>
                          {item.is_overdue ? 'OVERDUE' : 
                           item.status_payment === 'paid' ? 'LUNAS' :
                           item.status_payment === 'partial' ? 'SEBAGIAN' : 'BELUM BAYAR'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedPO(item)
                            setShowPaymentModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Payment
                        </button>
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
        {selectedPO && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => {
              setShowPaymentModal(false)
              setSelectedPO(null)
            }}
            poId={selectedPO.id}
            poNumber={selectedPO.po_number}
            totalPO={selectedPO.total_po}
            totalPaid={selectedPO.total_paid}
            onPaymentAdded={() => {
              fetchFinanceData()
            }}
          />
        )}
      </PageAccessControl>
    </Layout>
  )
}