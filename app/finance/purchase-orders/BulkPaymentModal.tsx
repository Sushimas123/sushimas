"use client"

import React, { useState } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { X, CreditCard, Calendar, FileText, Download } from 'lucide-react'

interface BulkPaymentModalProps {
  selectedPOs: any[]
  onClose: () => void
  onSuccess: () => void
}

export default function BulkPaymentModal({ selectedPOs, onClose, onSuccess }: BulkPaymentModalProps) {
  const [paymentData, setPaymentData] = useState({
    payment_amount: selectedPOs.reduce((sum, po) => sum + (po.total_tagih || po.sisa_bayar), 0),
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Transfer Bank',
    payment_via: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)

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
      
      // Header
      doc.setFontSize(18)
      doc.text('Bulk Payment Receipt', 20, 20)
      
      doc.setFontSize(12)
      doc.text(`Date: ${new Date().toLocaleDateString('id-ID')}`, 20, 35)
      doc.text(`Payment Method: ${paymentData.payment_method}`, 20, 45)
      doc.text(`Payment Via: ${paymentData.payment_via}`, 20, 55)
      doc.text(`Total Amount: ${formatCurrency(totalAmount)}`, 20, 65)
      
      // PO List
      doc.text('Purchase Orders:', 20, 80)
      let yPos = 90
      selectedPOs.forEach((po, index) => {
        doc.text(`${index + 1}. ${po.po_number} - ${po.nama_supplier} ${po.invoice_number ? `(${po.invoice_number})` : ''}`, 25, yPos)
        doc.text(`Amount: ${formatCurrency(po.total_tagih || po.sisa_bayar)}`, 30, yPos + 10)
        yPos += 20
      })
      
      if (paymentData.notes) {
        doc.text(`Notes: ${paymentData.notes}`, 20, yPos + 10)
      }
      
      doc.save(`bulk-payment-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Gagal export PDF')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    try {
      // Create payment records for each selected PO
      const paymentPromises = selectedPOs.map(async (po) => {
        const poPaymentAmount = (po.total_tagih || po.sisa_bayar)
        const { error } = await supabase
          .from('po_payments')
          .insert({
            po_id: po.id,
            payment_amount: poPaymentAmount,
            payment_date: paymentData.payment_date,
            payment_method: paymentData.payment_method,
            payment_via: paymentData.payment_via,
            notes: `${paymentData.notes} (Bulk Payment - ${selectedPOs.length} POs)`
          })
        
        if (error) throw error
      })

      await Promise.all(paymentPromises)
      
      alert(`Berhasil membayar ${selectedPOs.length} PO dengan total ${formatCurrency(paymentData.payment_amount)}`)
      onSuccess()
    } catch (error) {
      console.error('Error processing bulk payment:', error)
      alert('Gagal memproses pembayaran bulk')
    } finally {
      setSubmitting(false)
    }
  }

  const totalAmount = selectedPOs.reduce((sum, po) => sum + (po.total_tagih || po.sisa_bayar), 0)
  const uniqueSuppliers = [...new Set(selectedPOs.map(po => po.nama_supplier))]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <CreditCard className="text-blue-600" size={24} />
            Bulk Payment - {selectedPOs.length} POs
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Validation Warning */}
          {uniqueSuppliers.length > 1 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Peringatan</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Anda memilih PO dari supplier yang berbeda: {uniqueSuppliers.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selected POs Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-800 mb-3">PO yang Dipilih:</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedPOs.map((po) => (
                <div key={po.id} className="flex justify-between items-center text-sm">
                  <span>{po.po_number} - {po.nama_supplier} {po.invoice_number ? `(${po.invoice_number})` : ''}</span>
                  <span className="font-medium">{formatCurrency(po.total_tagih || po.sisa_bayar)}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-3 pt-3 flex justify-between items-center font-semibold">
              <span>Total:</span>
              <span className="text-lg text-blue-600">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jumlah Pembayaran
                </label>
                <input
                  type="number"
                  value={paymentData.payment_amount}
                  onChange={(e) => setPaymentData({...paymentData, payment_amount: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Pembayaran
                </label>
                <input
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({...paymentData, payment_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({...paymentData, payment_method: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Transfer Bank">Transfer Bank</option>
                  <option value="Cash">Cash</option>
                  <option value="Cek">Cek</option>
                  <option value="Giro">Giro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Via
                </label>
                <input
                  type="text"
                  value={paymentData.payment_via}
                  onChange={(e) => setPaymentData({...paymentData, payment_via: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="BCA, Mandiri, dll"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keterangan
              </label>
              <textarea
                value={paymentData.notes}
                onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Keterangan pembayaran..."
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {submitting ? 'Processing...' : `Bayar ${formatCurrency(paymentData.payment_amount)}`}
              </button>
              <button
                type="button"
                onClick={exportToPDF}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
              >
                <Download size={16} />
                Export PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}