import React, { useState } from 'react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  placeholder?: string
}

export const LazyImage: React.FC<LazyImageProps> = ({ 
  src, 
  alt, 
  className = '', 
  placeholder = '/placeholder-image.jpg' 
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  
  return (
    <img 
      src={hasError ? placeholder : (isLoaded ? src : placeholder)}
      alt={alt}
      onLoad={() => setIsLoaded(true)}
      onError={() => setHasError(true)}
      className={`${className} ${
        !isLoaded && !hasError ? 'bg-gray-200 animate-pulse' : ''
      }`}
    />
  )
}