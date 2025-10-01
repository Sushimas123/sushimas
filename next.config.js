/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  
  experimental: {
    optimizeCss: false,
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js', '@tanstack/react-query'],
  },
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  eslint: {
    ignoreDuringBuilds: true,
    dirs: [],
  },
  
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Skip linting and type checking during build
  skipTrailingSlashRedirect: true,
  
  // Disable strict mode for build
  reactStrictMode: false,
}

module.exports = nextConfig