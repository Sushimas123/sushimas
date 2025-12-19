"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { X, Plus, Trash2, Calendar, DollarSign, FileText, Clock, CheckCircle, Download } from 'lucide-react'
import { PaymentTransactionManager } from '@/src/utils/paymentTransactions'

interface Payment {
  id: number
  payment_date: string
  payment_amount: number
  payment_method: string
  payment_via: string
  reference_number: string
  notes: string
}

interface PaymentModalProps {
  po: {
    id: number
    po_number: string
    nama_supplier: string
    total_po: number
    total_paid: number
    sisa_bayar: number
    total_tagih?: number
    cabang_id?: number
  }
  onClose: () => void
  onSuccess: () => void
}

export default function PaymentModal({ po, onClose, onSuccess }: PaymentModalProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState('draft')
  
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_amount: '',
    payment_method: 'transfer',
    payment_via: '',
    reference_number: '',
    notes: ''
  })

  useEffect(() => {
    fetchPayments()
    fetchApprovalStatus()
  }, [po.id])

  const fetchApprovalStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('approval_status, total_tagih, keterangan')
        .eq('id', po.id)
        .single()

      if (error) throw error
      setApprovalStatus(data?.approval_status || 'draft')
    } catch (error) {
      console.error('Error fetching approval status:', error)
    }
  }

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('po_payments')
        .select('*')
        .eq('po_id', po.id)
        .order('payment_date', { ascending: false })

      if (error) throw error
      setPayments(data || [])
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const amount = parseFloat(formData.payment_amount)
    if (amount <= 0) {
      alert('Jumlah pembayaran harus lebih dari 0')
      return
    }

    setSubmitting(true)
    try {
      const userData = localStorage.getItem('user')
      const user = userData ? JSON.parse(userData) : null

      const result = await PaymentTransactionManager.executeSinglePayment({
        po_id: po.id,
        payment_date: formData.payment_date,
        payment_amount: amount,
        payment_method: formData.payment_method,
        payment_via: formData.payment_via,
        reference_number: formData.reference_number,
        notes: formData.notes,
        created_by: user?.id_user
      })

      if (!result.success) {
        alert(result.error || 'Gagal menambah pembayaran')
        return
      }

      setFormData({
        payment_date: new Date().toISOString().split('T')[0],
        payment_amount: '',
        payment_method: 'transfer',
        payment_via: '',
        reference_number: '',
        notes: ''
      })
      setShowAddForm(false)
      fetchPayments()
      onSuccess()
    } catch (error) {
      console.error('Error adding payment:', error)
      alert('Terjadi kesalahan sistem saat memproses pembayaran')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (paymentId: number) => {
    if (!confirm('Yakin ingin menghapus pembayaran ini? Tindakan ini tidak dapat dibatalkan.')) return

    try {
      const result = await PaymentTransactionManager.rollbackSinglePayment(paymentId)
      
      if (!result.success) {
        alert(result.error || 'Gagal menghapus pembayaran')
        return
      }

      fetchPayments()
      onSuccess()
    } catch (error) {
      console.error('Error deleting payment:', error)
      alert('Terjadi kesalahan sistem saat menghapus pembayaran')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const exportToPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default
      const doc = new jsPDF()
      
      // Get company data from branches table
      const { data: branchData } = await supabase
        .from('branches')
        .select('badan')
        .eq('id_branch', po.cabang_id)
        .single()
      
      const companyName = branchData?.badan || 'PT. Suryamas Pratama' 
      const lastPaymentDate = payments.length > 0 
        ? new Date(payments[payments.length - 1].payment_date).toLocaleDateString('id-ID')
        : new Date().toLocaleDateString('id-ID')
      
      const bankInfo = payments.length > 0 
        ? `${payments[0].payment_method} - ${payments[0].payment_via}`
        : ''
      
      // Header
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(companyName, 105, 20, { align: 'center' })
      
      doc.setFontSize(14)
      doc.text('BUKTI PENGELUARAN', 105, 35, { align: 'center' })
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Tanggal: ${lastPaymentDate}`, 20, 50)
      doc.text(`Supplier: ${po.nama_supplier}`, 20, 60)
      doc.text('Nomor Bukti: _______________', 20, 70)
      
      // Table Header
      const tableStartY = 90
      doc.setFont('helvetica', 'bold')
      doc.rect(20, tableStartY, 170, 10)
      doc.text('COA', 25, tableStartY + 7)
      doc.text('Deskripsi', 85, tableStartY + 7)
      doc.text('Nominal', 170, tableStartY + 7)
      
      // Get invoice number from barang_masuk
      const { data: barangMasukData, error: barangMasukError } = await supabase
        .from('barang_masuk')
        .select('invoice_number')
        .eq('no_po', po.po_number)
        .maybeSingle()
      
      console.log('PO Number:', po.po_number)
      console.log('Barang Masuk Data:', barangMasukData)
      console.log('Barang Masuk Error:', barangMasukError)
      
      const invoiceNumber = barangMasukData?.invoice_number
      console.log('Invoice Number:', invoiceNumber)
      
      // Table Content
      doc.setFont('helvetica', 'normal')
      const rowY = tableStartY + 10
      doc.rect(20, rowY, 170, 15)
      doc.text('', 25, rowY + 10) // Nama COA (blank)
      const description = `Pembayaran untuk invoice ${invoiceNumber} dari supplier ${po.nama_supplier}`
      doc.text(description, 50, rowY + 10, { maxWidth: 100 }) // Deskripsi
      doc.text(formatCurrency(po.total_paid), 168, rowY + 10) // Nominal
      
      // Total
      const totalY = rowY + 15
      doc.rect(20, totalY, 170, 10)
      doc.setFont('helvetica', 'bold')
      doc.text('TOTAL', 55, totalY + 7)
      doc.text(formatCurrency(po.total_paid), 168, totalY + 7)
      
      // Signature Section
      const signY = totalY + 40
      doc.setFont('helvetica', 'normal')
      doc.text('Dibuat,', 30, signY)
      doc.text('Disetujui,', 90, signY)
      doc.text('Bank,', 150, signY)
      if (bankInfo) {
        doc.text(bankInfo, 150, signY + 10)
      }
      
      // Signature lines
      doc.line(20, signY + 30, 70, signY + 30)
      doc.line(80, signY + 30, 130, signY + 30)
      doc.line(140, signY + 30, 190, signY + 30)
      
      // Names under signature lines
      doc.text('Khoirun Nisa', 30, signY + 40)
      doc.text('Raymond', 90, signY + 40)
      
      doc.save(`bukti-pengeluaran-${po.po_number}-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Gagal export PDF')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Payment Management</h2>
            <p className="text-sm text-gray-600">PO: {po.po_number} - {po.nama_supplier}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToPDF}
              className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              Export PDF
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* PO Summary */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Total PO</p>
                <p className="text-lg font-semibold">{formatCurrency(po.total_po)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Tagih</p>
                <p className="text-lg font-semibold text-blue-600">{formatCurrency(po.total_tagih || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Sudah Dibayar</p>
                <p className="text-lg font-semibold text-green-600">{formatCurrency(po.total_paid)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Sisa Bayar</p>
                <p className="text-lg font-semibold text-red-600">{formatCurrency(po.sisa_bayar)}</p>
              </div>
            </div>
          </div>

          {/* Submit for Approval / Add Payment Buttons */}
          {po.sisa_bayar > 0 && (
            <div className="mb-6 flex gap-3">
              {approvalStatus === 'draft' ? (
                <a
                  href={`/finance/purchase-orders/submit-approval?id=${po.id}`}
                  className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 flex items-center gap-2"
                >
                  <FileText size={16} />
                  Submit for Approval
                </a>
              ) : approvalStatus === 'approved' ? (
                <button
                  onClick={() => {
                    setShowAddForm(!showAddForm)
                    if (!showAddForm) {
                      setFormData(prev => ({...prev, payment_amount: po.sisa_bayar.toString()}))
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus size={16} />
                  Tambah Pembayaran
                </button>
              ) : approvalStatus === 'pending' ? (
                <div className="flex gap-2">
                  <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md flex items-center gap-2">
                    <Clock size={16} />
                    Menunggu Approval
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from('purchase_orders')
                          .update({
                            approval_status: 'approved',
                            approved_at: new Date().toISOString()
                          })
                          .eq('id', po.id)
                        
                        if (error) throw error
                        setApprovalStatus('approved')
                        onSuccess()
                      } catch (error) {
                        console.error('Error approving:', error)
                        alert('Gagal approve')
                      }
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Approve
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowAddForm(!showAddForm)
                    if (!showAddForm) {
                      setFormData(prev => ({...prev, payment_amount: po.sisa_bayar.toString()}))
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus size={16} />
                  Tambah Pembayaran
                </button>
              )}
            </div>
          )}

          {/* Add Payment Form */}
          {showAddForm && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                    Jumlah
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, payment_amount: po.sisa_bayar.toString()})}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Isi Sisa Bayar
                    </button>
                  </label>
                  <input
                    type="number"
                    value={formData.payment_amount}
                    onChange={(e) => setFormData({...formData, payment_amount: e.target.value})}
                    max={po.sisa_bayar}
                    placeholder={`Max: ${formatCurrency(po.sisa_bayar)}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metode</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cash">Cash</option>                    
                    <option value="transfer">Transfer</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="check">Check</option>                    
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Via</label>
                  <input
                    type="text"
                    value={formData.payment_via}
                    onChange={(e) => setFormData({...formData, payment_via: e.target.value})}
                    placeholder="BCA, Mandiri, Cash, etc"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. Referensi</label>
                  <input
                    type="text"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                    placeholder="No transfer/check"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Payment History */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Riwayat Pembayaran</h3>
            {loading ? (
              <div className="text-center py-4">Loading...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DollarSign size={48} className="mx-auto text-gray-300 mb-2" />
                <p>Belum ada pembayaran</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="bg-white border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">{formatCurrency(payment.payment_amount)}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(payment.payment_date).toLocaleDateString('id-ID')}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">
                              {payment.payment_method} via {payment.payment_via}
                            </p>
                            {payment.reference_number && (
                              <p className="text-sm text-gray-500">Ref: {payment.reference_number}</p>
                            )}
                          </div>
                          {payment.notes && (
                            <div>
                              <p className="text-sm text-gray-600">{payment.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(payment.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}