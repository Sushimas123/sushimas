"use client"

import { useState, useCallback } from 'react'

interface PriceValidationConfig {
  minPrice?: number
  maxChangePercentage?: number
  minNewProductPrice?: number
}

interface ValidationResult {
  isValid: boolean
  issues: string[]
  severity: 'error' | 'warning' | 'info'
}

export const usePriceValidation = (config: PriceValidationConfig = {}) => {
  const {
    minPrice = 100,
    maxChangePercentage = 500,
    minNewProductPrice = 1000
  } = config

  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingPrice, setPendingPrice] = useState<{
    oldPrice: number
    newPrice: number
    productName: string
    onConfirm: () => void
  } | null>(null)

  const validatePrice = useCallback((
    oldPrice: number,
    newPrice: number,
    productName: string = ''
  ): ValidationResult => {
    const issues: string[] = []
    let severity: 'error' | 'warning' | 'info' = 'info'

    // Check minimum price
    if (newPrice < minPrice) {
      issues.push(`Harga terlalu rendah (< Rp ${minPrice.toLocaleString('id-ID')})`)
      severity = 'error'
    }

    // Check extreme percentage changes
    if (oldPrice > 0) {
      const changePercentage = ((newPrice - oldPrice) / oldPrice) * 100
      if (Math.abs(changePercentage) > maxChangePercentage) {
        issues.push(`Perubahan harga terlalu ekstrem (${changePercentage.toFixed(1)}%)`)
        severity = severity === 'error' ? 'error' : 'warning'
      }
    }

    // Check new product price
    if (oldPrice === 0 && newPrice < minNewProductPrice) {
      issues.push(`Harga produk baru terlalu rendah (< Rp ${minNewProductPrice.toLocaleString('id-ID')})`)
      severity = severity === 'error' ? 'error' : 'warning'
    }

    // Check for suspicious patterns
    if (newPrice <= 10) {
      issues.push('Harga sangat mencurigakan (≤ Rp 10)')
      severity = 'error'
    }

    return {
      isValid: issues.length === 0,
      issues,
      severity
    }
  }, [minPrice, maxChangePercentage, minNewProductPrice])

  const requestPriceConfirmation = useCallback((
    oldPrice: number,
    newPrice: number,
    productName: string,
    onConfirm: () => void
  ) => {
    const validation = validatePrice(oldPrice, newPrice, productName)
    
    if (!validation.isValid && validation.severity !== 'info') {
      setPendingPrice({ oldPrice, newPrice, productName, onConfirm })
      setShowConfirmation(true)
      return false // Don't proceed immediately
    }
    
    onConfirm() // Proceed immediately if valid
    return true
  }, [validatePrice])

  const confirmPrice = useCallback(() => {
    if (pendingPrice) {
      pendingPrice.onConfirm()
      setPendingPrice(null)
    }
    setShowConfirmation(false)
  }, [pendingPrice])

  const cancelPrice = useCallback(() => {
    setPendingPrice(null)
    setShowConfirmation(false)
  }, [])

  const formatPriceChange = useCallback((oldPrice: number, newPrice: number) => {
    if (oldPrice === 0) return 'Produk baru'
    
    const change = newPrice - oldPrice
    const percentage = (change / oldPrice) * 100
    
    return {
      change,
      percentage,
      formatted: `${change >= 0 ? '+' : ''}${change.toLocaleString('id-ID')} (${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%)`
    }
  }, [])

  return {
    validatePrice,
    requestPriceConfirmation,
    confirmPrice,
    cancelPrice,
    formatPriceChange,
    showConfirmation,
    pendingPrice
  }
}