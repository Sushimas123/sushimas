import { useState, useEffect, useMemo } from 'react'

interface UseVirtualScrollProps {
  items: any[]
  itemHeight: number
  containerHeight: number
}

export const useVirtualScroll = ({ items, itemHeight, containerHeight }: UseVirtualScrollProps) => {
  const [scrollTop, setScrollTop] = useState(0)
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    )
    
    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight
    }
  }, [items, itemHeight, containerHeight, scrollTop])
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }
  
  return {
    visibleItems,
    handleScroll
  }
}