import React, { useState } from 'react'
import { AlertTriangle, Undo2 } from 'lucide-react'
import { PaymentTransactionManager } from '@/src/utils/paymentTransactions'

interface BulkPaymentRollbackProps {
  bulkReference: string
  onSuccess: () => void
  className?: string
}

export default function BulkPaymentRollback({ bulkReference, onSuccess, className = '' }: BulkPaymentRollbackProps) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleRollback = async () => {
    setLoading(true)
    try {
      const result = await PaymentTransactionManager.rollbackBulkPayment(bulkReference)
      
      if (!result.success) {
        alert(result.error || 'Gagal melakukan rollback')
        return
      }

      alert('Bulk payment berhasil di-rollback')
      onSuccess()
      setShowConfirm(false)
    } catch (error) {
      console.error('Rollback error:', error)
      alert('Terjadi kesalahan saat melakukan rollback')
    } finally {
      setLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Konfirmasi Rollback</h3>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              Anda akan melakukan rollback untuk bulk payment:
            </p>
            <p className="font-mono text-sm bg-gray-100 p-2 rounded">
              {bulkReference}
            </p>
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 text-sm">
                <strong>Peringatan:</strong> Tindakan ini akan:
              </p>
              <ul className="text-red-700 text-sm mt-1 ml-4 list-disc">
                <li>Menghapus record bulk payment</li>
                <li>Mengembalikan status semua PO terkait</li>
                <li>Tindakan ini tidak dapat dibatalkan</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Batal
            </button>
            <button
              onClick={handleRollback}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4" />
                  Ya, Rollback
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className={`inline-flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm ${className}`}
    >
      <Undo2 className="h-4 w-4" />
      Rollback Payment
    </button>
  )
}