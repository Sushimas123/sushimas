"use client"

import React from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface PriceValidationProps {
  oldPrice?: number
  newPrice: number
  productName?: string
  onConfirm?: () => void
  onCancel?: () => void
  showConfirmation?: boolean
}

export default function PriceValidation({ 
  oldPrice = 0, 
  newPrice, 
  productName = '',
  onConfirm,
  onCancel,
  showConfirmation = false
}: PriceValidationProps) {
  
  const MIN_PRICE = 100 // Minimum price in rupiah
  const MAX_CHANGE_PERCENTAGE = 500 // Maximum allowed percentage change
  
  const calculateChangePercentage = () => {
    if (oldPrice === 0) return 0
    return ((newPrice - oldPrice) / oldPrice) * 100
  }
  
  const changePercentage = calculateChangePercentage()
  
  const getValidationStatus = () => {
    const issues = []
    
    if (newPrice < MIN_PRICE) {
      issues.push(`Harga terlalu rendah (< Rp ${MIN_PRICE.toLocaleString('id-ID')})`)
    }
    
    if (oldPrice > 0 && Math.abs(changePercentage) > MAX_CHANGE_PERCENTAGE) {
      issues.push(`Perubahan harga terlalu ekstrem (${changePercentage.toFixed(1)}%)`)
    }
    
    if (oldPrice === 0 && newPrice < 1000) {
      issues.push('Harga produk baru terlalu rendah')
    }
    
    return {
      isValid: issues.length === 0,
      issues
    }
  }
  
  const validation = getValidationStatus()
  
  if (showConfirmation && !validation.isValid) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="text-yellow-500" size={24} />
            <h3 className="text-lg font-semibold">Konfirmasi Perubahan Harga</h3>
          </div>
          
          <div className="space-y-3 mb-6">
            <p className="text-sm text-gray-600">
              Produk: <span className="font-medium">{productName}</span>
            </p>
            
            {oldPrice > 0 && (
              <div className="text-sm">
                <span className="text-gray-600">Harga lama: </span>
                <span className="font-medium">Rp {oldPrice.toLocaleString('id-ID')}</span>
              </div>
            )}
            
            <div className="text-sm">
              <span className="text-gray-600">Harga baru: </span>
              <span className="font-medium">Rp {newPrice.toLocaleString('id-ID')}</span>
            </div>
            
            {oldPrice > 0 && (
              <div className="text-sm">
                <span className="text-gray-600">Perubahan: </span>
                <span className={`font-medium ${changePercentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {changePercentage > 0 ? '+' : ''}{changePercentage.toFixed(1)}%
                </span>
              </div>
            )}
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-800 mb-2">Peringatan:</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {validation.issues.map((issue, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span>•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              Lanjutkan
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Inline validation display
  if (!validation.isValid) {
    return (
      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle className="text-yellow-500 mt-0.5" size={16} />
          <div>
            <p className="text-sm font-medium text-yellow-800">Peringatan Harga:</p>
            <ul className="text-sm text-yellow-700 mt-1 space-y-1">
              {validation.issues.map((issue, index) => (
                <li key={index}>• {issue}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center gap-2">
        <CheckCircle className="text-green-500" size={16} />
        <p className="text-sm text-green-700">Harga valid</p>
      </div>
    </div>
  )
}