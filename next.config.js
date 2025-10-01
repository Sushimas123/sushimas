/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js', '@tanstack/react-query'],
  },
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  swcMinify: true,
}

module.exports = nextConfig