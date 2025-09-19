"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { X, Plus, Trash2 } from 'lucide-react'

interface Payment {
  id?: number
  payment_date: string
  payment_amount: number
  payment_method: string
  payment_via: string
  reference_number: string
  notes: string
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  poId: number
  poNumber: string
  totalPO: number
  totalPaid: number
  onPaymentAdded: () => void
}

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  poId, 
  poNumber, 
  totalPO, 
  totalPaid,
  onPaymentAdded 
}: PaymentModalProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [newPayment, setNewPayment] = useState<Payment>({
    payment_date: new Date().toISOString().split('T')[0],
    payment_amount: 0,
    payment_method: 'transfer',
    payment_via: '',
    reference_number: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && poId) {
      fetchPayments()
    }
  }, [isOpen, poId])

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('po_payments')
        .select('*')
        .eq('po_id', poId)
        .order('payment_date', { ascending: false })

      if (error) throw error
      setPayments(data || [])
    } catch (error) {
      console.error('Error fetching payments:', error)
    }
  }

  const handleAddPayment = async () => {
    if (!newPayment.payment_amount || newPayment.payment_amount <= 0) {
      alert('Jumlah pembayaran harus lebih dari 0')
      return
    }

    const remainingAmount = totalPO - totalPaid
    if (newPayment.payment_amount > remainingAmount) {
      alert(`Jumlah pembayaran tidak boleh melebihi sisa tagihan: ${formatCurrency(remainingAmount)}`)
      return
    }

    setLoading(true)
    try {
      const userData = localStorage.getItem('user')
      const user = userData ? JSON.parse(userData) : null

      const { error } = await supabase
        .from('po_payments')
        .insert({
          po_id: poId,
          payment_date: newPayment.payment_date,
          payment_amount: newPayment.payment_amount,
          payment_method: newPayment.payment_method,
          payment_via: newPayment.payment_via,
          reference_number: newPayment.reference_number,
          notes: newPayment.notes,
          status: 'completed',
          created_by: user?.id_user
        })

      if (error) throw error

      // Reset form
      setNewPayment({
        payment_date: new Date().toISOString().split('T')[0],
        payment_amount: 0,
        payment_method: 'transfer',
        payment_via: '',
        reference_number: '',
        notes: ''
      })

      fetchPayments()
      onPaymentAdded()
      alert('Pembayaran berhasil ditambahkan')
    } catch (error) {
      console.error('Error adding payment:', error)
      alert('Gagal menambahkan pembayaran')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm('Yakin ingin menghapus pembayaran ini?')) return

    try {
      const { error } = await supabase
        .from('po_payments')
        .delete()
        .eq('id', paymentId)

      if (error) throw error

      fetchPayments()
      onPaymentAdded()
      alert('Pembayaran berhasil dihapus')
    } catch (error) {
      console.error('Error deleting payment:', error)
      alert('Gagal menghapus pembayaran')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (!isOpen) return null

  const remainingAmount = totalPO - totalPaid

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Payment Management - {poNumber}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm text-gray-600">Total PO</p>
            <p className="text-lg font-semibold">{formatCurrency(totalPO)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Sudah Dibayar</p>
            <p className="text-lg font-semibold text-green-600">{formatCurrency(totalPaid)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Sisa Tagihan</p>
            <p className="text-lg font-semibold text-red-600">{formatCurrency(remainingAmount)}</p>
          </div>
        </div>

        {/* Add New Payment */}
        <div className="border rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-4">Tambah Pembayaran Baru</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pembayaran</label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={newPayment.payment_date}
                onChange={(e) => setNewPayment({...newPayment, payment_date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Pembayaran</label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={newPayment.payment_amount}
                onChange={(e) => setNewPayment({...newPayment, payment_amount: parseFloat(e.target.value) || 0})}
                max={remainingAmount}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={newPayment.payment_method}
                onChange={(e) => setNewPayment({...newPayment, payment_method: e.target.value})}
              >
                <option value="transfer">Transfer Bank</option>
                <option value="cash">Tunai</option>
                <option value="check">Cek</option>
                <option value="credit">Kredit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Via</label>
              <input
                type="text"
                placeholder="BCA, Mandiri, Cash, dll"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={newPayment.payment_via}
                onChange={(e) => setNewPayment({...newPayment, payment_via: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Referensi</label>
              <input
                type="text"
                placeholder="No. Transfer/Cek"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={newPayment.reference_number}
                onChange={(e) => setNewPayment({...newPayment, reference_number: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={newPayment.notes}
                onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleAddPayment}
              disabled={loading || remainingAmount <= 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              {loading ? 'Menyimpan...' : 'Tambah Pembayaran'}
            </button>
          </div>
        </div>

        {/* Payment History */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Riwayat Pembayaran</h3>
          {payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Via</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referensi</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catatan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payment.payment_date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(payment.payment_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.payment_method}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.payment_via}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.reference_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.notes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => payment.id && handleDeletePayment(payment.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Belum ada pembayaran</p>
          )}
        </div>
      </div>
    </div>
  )
}