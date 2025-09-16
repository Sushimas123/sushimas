import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Role-based page access control
const ROLE_PAGE_ACCESS = {
  'super admin': ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'branches', 'categories', 'gudang', 'product_name', 'product_settings', 'produksi_detail', 'recipes', 'stock_opname_batch', 'supplier', 'permissions-db'],
  admin: ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'branches', 'categories', 'gudang', 'product_name', 'product_settings', 'produksi_detail', 'recipes', 'stock_opname_batch', 'supplier'],
  finance: ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'gudang', 'product_settings', 'produksi_detail', 'stock_opname_batch'],
  pic_branch: ['dashboard', 'esb', 'ready', 'produksi', 'analysis', 'gudang', 'stock_opname_batch', 'produksi_detail'],
  staff: ['dashboard', 'esb', 'ready', 'produksi', 'gudang', 'stock_opname_batch']
}

// Function to check page access based on role
function canAccessPage(userRole: string, pagePath: string): boolean {
  // Remove leading slash and get page name
  const pageName = pagePath.replace('/', '') || 'dashboard'
  
  // Check if user role has access to this page
  const allowedPages = ROLE_PAGE_ACCESS[userRole as keyof typeof ROLE_PAGE_ACCESS] || []
  return allowedPages.includes(pageName)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware untuk public routes
  if (pathname === '/login' || pathname === '/' || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Check if route requires authentication
  const protectedRoutes = ['/dashboard', '/esb', '/ready', '/users', '/produksi', '/analysis', '/branches', '/categories', '/gudang', '/product_name', '/product_settings', '/produksi_detail', '/recipes', '/stock_opname_batch', '/supplier', '/permissions-db']
  
  if (protectedRoutes.includes(pathname)) {
    // Get user data from cookie
    const userCookie = request.cookies.get('user')
    
    if (!userCookie) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      const userData = JSON.parse(userCookie.value)
      const userRole = userData.role

      // Check if user can access this page
      if (!canAccessPage(userRole, pathname)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}