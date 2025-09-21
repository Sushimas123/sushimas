"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { X, Plus, Trash2, Calculator } from 'lucide-react'

interface BulkPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  availablePOs: any[]
}

export default function BulkPaymentModal({ isOpen, onClose, onSuccess, availablePOs }: BulkPaymentModalProps) {
  const [formData, setFormData] = useState({
    bulk_reference: '',
    payment_date: '',
    payment_via: '',
    payment_method: 'Transfer',
    notes: ''
  })
  const [selectedPOs, setSelectedPOs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Generate unique bulk reference with timestamp
      const now = new Date()
      const today = now.toISOString().slice(0, 10).replace(/-/g, '')
      const timestamp = now.getTime().toString().slice(-4)
      setFormData(prev => ({
        ...prev,
        bulk_reference: `BULK-${today}-${timestamp}`,
        payment_date: new Date().toISOString().slice(0, 10)
      }))
    }
  }, [isOpen])

  const handleAddPO = (po: any) => {
    if (!selectedPOs.find(p => p.id === po.id)) {
      setSelectedPOs([...selectedPOs, { ...po, amount: po.total_tagih }])
    }
  }

  const handleRemovePO = (poId: number) => {
    setSelectedPOs(selectedPOs.filter(po => po.id !== poId))
  }

  const handleAmountChange = (poId: number, amount: number) => {
    setSelectedPOs(selectedPOs.map(po => 
      po.id === poId ? { ...po, amount } : po
    ))
  }

  const totalAmount = selectedPOs.reduce((sum, po) => sum + (po.amount || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedPOs.length === 0) {
      alert('Pilih minimal 1 PO')
      return
    }

    setLoading(true)
    try {
      // Check if bulk reference already exists
      const { data: existingBulk } = await supabase
        .from('bulk_payments')
        .select('id')
        .eq('bulk_reference', formData.bulk_reference)
        .single()

      if (existingBulk) {
        alert('Bulk reference sudah ada, silakan refresh halaman')
        return
      }

      // Insert bulk payment
      const { data: bulkPayment, error: bulkError } = await supabase
        .from('bulk_payments')
        .insert({
          bulk_reference: formData.bulk_reference,
          total_amount: totalAmount,
          payment_date: formData.payment_date,
          payment_via: formData.payment_via,
          payment_method: formData.payment_method,
          notes: formData.notes
        })
        .select()
        .single()

      if (bulkError) throw bulkError

      // Update purchase_orders with bulk_payment_ref
      for (const po of selectedPOs) {
        const { error: updateError } = await supabase
          .from('purchase_orders')
          .update({ 
            bulk_payment_ref: formData.bulk_reference
          })
          .eq('id', po.id)
        
        if (updateError) {
          console.error('Error updating PO:', po.id, updateError)
          throw updateError
        }
      }

      onSuccess()
      onClose()
      
      // Reset form
      setSelectedPOs([])
      setFormData({
        bulk_reference: '',
        payment_date: '',
        payment_via: '',
        payment_method: 'Transfer',
        notes: ''
      })
    } catch (error) {
      console.error('Error creating bulk payment:', error)
      alert('Error creating bulk payment')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Bulk Payment</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bulk Reference</label>
              <input
                type="text"
                value={formData.bulk_reference}
                onChange={(e) => setFormData({...formData, bulk_reference: e.target.value})}
                className="w-full border rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Date</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                className="w-full border rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Via</label>
              <input
                type="text"
                value={formData.payment_via}
                onChange={(e) => setFormData({...formData, payment_via: e.target.value})}
                placeholder="e.g., BCA, Mandiri"
                className="w-full border rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="Transfer">Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Check">Check</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full border rounded-md px-3 py-2"
              rows={2}
            />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">Select Purchase Orders</h4>
              <div className="flex items-center text-sm text-gray-600">
                <Calculator size={16} className="mr-1" />
                Total: Rp {totalAmount.toLocaleString()}
              </div>
            </div>
            
            <div className="border rounded-lg p-3 max-h-40 overflow-y-auto mb-3">
              {availablePOs.filter(po => po.status_pembayaran !== 'Paid' && !selectedPOs.find(p => p.id === po.id)).map(po => (
                <div key={po.id} className="flex items-center justify-between py-1">
                  <span className="text-sm">{po.po_number} - {po.nama_supplier}</span>
                  <div className="flex items-center">
                    <span className="text-sm mr-2">Rp {po.total_tagih?.toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => handleAddPO(po)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {selectedPOs.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedPOs.map(po => (
                      <tr key={po.id}>
                        <td className="px-3 py-2 text-sm">{po.po_number}</td>
                        <td className="px-3 py-2 text-sm">{po.nama_supplier}</td>
                        <td className="px-3 py-2 text-sm">
                          <input
                            type="number"
                            value={po.amount}
                            onChange={(e) => handleAmountChange(po.id, parseFloat(e.target.value) || 0)}
                            className="w-24 border rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <button
                            type="button"
                            onClick={() => handleRemovePO(po.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedPOs.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Bulk Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}