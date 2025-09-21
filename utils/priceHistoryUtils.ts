// Utility functions for price history

export const generatePriceChangeNotes = (
  changeReason: string,
  poNumber?: string,
  oldPrice?: number,
  newPrice?: number,
  userName?: string
): string => {
  const priceChange = oldPrice && newPrice ? newPrice - oldPrice : 0
  const changeDirection = priceChange > 0 ? 'naik' : priceChange < 0 ? 'turun' : 'tetap'
  
  switch (changeReason) {
    case 'po_completion':
      return poNumber 
        ? `Harga ${changeDirection} setelah PO ${poNumber} selesai`
        : `Harga ${changeDirection} setelah PO completion`
    
    case 'manual_update':
      const userInfo = userName ? ` oleh ${userName}` : ''
      return poNumber
        ? `Update manual${userInfo} terkait PO ${poNumber}`
        : `Update manual${userInfo} - harga ${changeDirection}`
    
    case 'market_adjustment':
      return `Penyesuaian harga pasar - harga ${changeDirection}`
    
    case 'bulk_update':
      return `Bulk update harga - harga ${changeDirection}`
    
    case 'supplier_change':
      return poNumber
        ? `Perubahan supplier dari PO ${poNumber}`
        : `Perubahan harga karena ganti supplier`
    
    default:
      return `Harga ${changeDirection} - ${changeReason.replace('_', ' ')}`
  }
}

export const formatPriceHistoryForDisplay = (history: any) => {
  return {
    ...history,
    // Ensure numeric values
    old_price: parseFloat(history.old_price) || 0,
    new_price: parseFloat(history.new_price) || 0,
    price_change: parseFloat(history.price_change) || 0,
    change_percentage: parseFloat(history.change_percentage) || 0,
    
    // Enhanced notes
    enhanced_notes: generatePriceChangeNotes(
      history.change_reason,
      history.po_number,
      parseFloat(history.old_price),
      parseFloat(history.new_price)
    )
  }
}

export const isPriceChangeSignificant = (
  oldPrice: number, 
  newPrice: number, 
  threshold: number = 10
): boolean => {
  if (oldPrice === 0) return newPrice > 0
  const changePercentage = Math.abs(((newPrice - oldPrice) / oldPrice) * 100)
  return changePercentage >= threshold
}

export const getPriceChangeCategory = (changePercentage: number): string => {
  const absChange = Math.abs(changePercentage)
  
  if (absChange === 0) return 'no-change'
  if (absChange < 5) return 'minor'
  if (absChange < 20) return 'moderate'
  if (absChange < 50) return 'significant'
  return 'extreme'
}

export const shouldHighlightPriceChange = (
  oldPrice: number,
  newPrice: number,
  changePercentage: number
): boolean => {
  // Highlight if:
  // 1. Very low prices (< 1000)
  // 2. Extreme changes (> 100% or < -50%)
  // 3. Suspicious patterns
  
  return (
    (oldPrice > 0 && oldPrice < 1000) ||
    (newPrice > 0 && newPrice < 1000) ||
    Math.abs(changePercentage) > 100 ||
    (oldPrice === 0 && newPrice < 2000)
  )
}