"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { ArrowLeft, Calendar, CreditCard, FileText, DollarSign, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

interface PaymentDetail {
  id: number
  payment_amount: number
  payment_date: string
  payment_method: string
  reference_number: string
  notes: string
  created_at: string
}

interface PODetail {
  po_number: string
  nama_supplier: string
  nama_branch: string
  total_po: number
  total_paid: number
  sisa_bayar: number
}

export default function PaymentDetailPage() {
  const [payments, setPayments] = useState<PaymentDetail[]>([])
  const [poDetail, setPODetail] = useState<PODetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const poId = urlParams.get('po_id')
    
    if (poId) {
      fetchPaymentDetails(parseInt(poId))
    }
  }, [])

  const fetchPaymentDetails = async (poId: number) => {
    try {
      // Get PO details
      const { data: po, error: poError } = await supabase
        .from('finance_dashboard_view')
        .select('*')
        .eq('id', poId)
        .single()

      if (poError) throw poError

      // Recalculate total PO based on actual prices
      const { data: items } = await supabase
        .from('po_items')
        .select('qty, actual_price, received_qty, product_id')
        .eq('po_id', poId)

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

      const correctedPO = {
        ...po,
        total_po: correctedTotal,
        sisa_bayar: correctedTotal - po.total_paid
      }
      
      setPODetail(correctedPO)

      // Get payment history
      const { data: paymentData, error: paymentError } = await supabase
        .from('po_payments')
        .select('*')
        .eq('po_id', poId)
        .eq('status', 'completed')
        .order('payment_date', { ascending: false })

      if (paymentError) throw paymentError
      setPayments(paymentData || [])
    } catch (error) {
      console.error('Error fetching payment details:', error)
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

  const exportToPDF = () => {
    if (!poDetail) return

    const doc = new jsPDF()
    
    // Header
    doc.setFontSize(18)
    doc.text('LAPORAN DETAIL PEMBAYARAN', 20, 20)
    
    // PO Info
    doc.setFontSize(12)
    doc.text(`PO Number: ${poDetail.po_number}`, 20, 40)
    doc.text(`Supplier: ${poDetail.nama_supplier}`, 20, 50)
    doc.text(`Branch: ${poDetail.nama_branch}`, 20, 60)
    doc.text(`Total PO: ${formatCurrency(poDetail.total_po)}`, 20, 70)
    doc.text(`Total Dibayar: ${formatCurrency(poDetail.total_paid)}`, 20, 80)
    doc.text(`Sisa Bayar: ${formatCurrency(poDetail.sisa_bayar)}`, 20, 90)
    
    // Payment table
    const tableData = payments.map(payment => [
      new Date(payment.payment_date).toLocaleDateString('id-ID'),
      formatCurrency(payment.payment_amount),
      payment.payment_method,
      payment.reference_number || '-',
      payment.notes || '-'
    ])
    
    ;(doc as any).autoTable({
      head: [['Tanggal', 'Jumlah', 'Metode', 'Referensi', 'Keterangan']],
      body: tableData,
      startY: 110,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] }
    })
    
    doc.save(`payment-detail-${poDetail.po_number}.pdf`)
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

  if (!poDetail) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p className="text-red-600">PO tidak ditemukan</p>
          <a href="/finance/purchase-orders" className="text-blue-600 hover:underline mt-2 inline-block">
            Kembali ke Finance Dashboard
          </a>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageAccessControl pageName="finance">
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <a 
                href="/finance/purchase-orders"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft size={20} />
                Kembali
              </a>
              <h1 className="text-2xl font-bold text-gray-900">Detail Pembayaran</h1>
            </div>
          </div>

          {/* PO Summary */}
          <div className="bg-white rounded-lg shadow border p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Purchase Order</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">PO Number</p>
                <p className="font-medium">{poDetail.po_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Supplier</p>
                <p className="font-medium">{poDetail.nama_supplier}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Branch</p>
                <p className="font-medium">{poDetail.nama_branch}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total PO</p>
                <p className="font-medium">{formatCurrency(poDetail.total_po)}</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <DollarSign className="h-5 w-5 text-green-600 mr-2" />
                    <div>
                      <p className="text-sm text-green-600">Total Dibayar</p>
                      <p className="font-semibold text-green-800">{formatCurrency(poDetail.total_paid)}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-yellow-600 mr-2" />
                    <div>
                      <p className="text-sm text-yellow-600">Sisa Bayar</p>
                      <p className="font-semibold text-yellow-800">{formatCurrency(poDetail.sisa_bayar)}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-blue-600 mr-2" />
                    <div>
                      <p className="text-sm text-blue-600">Total Transaksi</p>
                      <p className="font-semibold text-blue-800">{payments.length} pembayaran</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-lg shadow border">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Riwayat Pembayaran</h2>
              <button
                onClick={exportToPDF}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </button>
            </div>
            
            {payments.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                Belum ada pembayaran
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referensi</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dibuat</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {new Date(payment.payment_date).toLocaleDateString('id-ID')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(payment.payment_date).toLocaleTimeString('id-ID')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(payment.payment_amount)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <CreditCard className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{payment.payment_method}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{payment.reference_number || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{payment.notes || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-500">
                            {new Date(payment.created_at).toLocaleDateString('id-ID')}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageAccessControl>
    </Layout>
  )
}