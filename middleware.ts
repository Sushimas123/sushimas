import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Function to check page access based on role (now uses database)
async function canAccessPage(userRole: string, pagePath: string): Promise<boolean> {
  // Super admin always has access
  if (userRole === 'super admin') return true
  
  // Remove leading slash and get page name
  const pageName = pagePath.replace('/', '') || 'dashboard'
  
  // Always allow dashboard access
  if (pageName === 'dashboard') return true
  
  try {
    // This would need to be implemented with a database call
    // For now, use fallback hardcoded permissions
    const ROLE_PAGE_ACCESS = {
      admin: ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'branches', 'categories', 'gudang', 'product_name', 'product_settings', 'produksi_detail', 'recipes', 'stock_opname_batch', 'supplier', 'audit-log', 'crud-permissions', 'pivot', 'price-history', 'purchaseorder', 'barang_masuk', 'stock-alert', 'transfer-barang'],
      finance: ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'gudang', 'product_settings', 'produksi_detail', 'stock_opname_batch'],
      pic_branch: ['dashboard', 'esb', 'ready', 'produksi', 'analysis', 'gudang', 'stock_opname_batch', 'produksi_detail'],
      staff: ['dashboard', 'esb', 'ready', 'produksi', 'gudang', 'stock_opname_batch']
    }
    
    const allowedPages = ROLE_PAGE_ACCESS[userRole as keyof typeof ROLE_PAGE_ACCESS] || []
    return allowedPages.includes(pageName)
  } catch (error) {
    console.error('Error checking page access:', error)
    return false
  }
}

// Synchronous version for middleware
function canAccessPageSync(userRole: string, pagePath: string): boolean {
  // Super admin always has access
  if (userRole === 'super admin') return true
  
  // Remove leading slash and get page name
  const pageName = pagePath.replace('/', '') || 'dashboard'
  
  // Always allow dashboard access
  if (pageName === 'dashboard') return true
  
  const ROLE_PAGE_ACCESS = {
    admin: ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'branches', 'categories', 'gudang', 'product_name', 'product_settings', 'produksi_detail', 'recipes', 'stock_opname_batch', 'supplier', 'audit-log', 'crud-permissions', 'pivot', 'price-history', 'purchaseorder', 'barang_masuk', 'stock-alert', 'transfer-barang'],
    finance: ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'gudang', 'product_settings', 'produksi_detail', 'stock_opname_batch'],
    pic_branch: ['dashboard', 'esb', 'ready', 'produksi', 'analysis', 'gudang', 'stock_opname_batch', 'produksi_detail'],
    staff: ['dashboard', 'esb', 'ready', 'produksi', 'gudang', 'stock_opname_batch']
  }
  
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
  const protectedRoutes = ['/dashboard', '/esb', '/ready', '/users', '/produksi', '/analysis', '/branches', '/categories', '/gudang', '/product_name', '/product_settings', '/produksi_detail', '/recipes', '/stock_opname_batch', '/supplier', '/permissions-db', '/audit-log', '/crud-permissions', '/pivot', '/price-history', '/purchaseorder', '/transfer-barang']
  
  // Check for nested routes (like /purchaseorder/barang_masuk)
  const isProtectedRoute = protectedRoutes.includes(pathname) || 
    protectedRoutes.some(route => pathname.startsWith(route + '/'))
  
  if (isProtectedRoute) {
    // Get user data from cookie
    const userCookie = request.cookies.get('user')
    
    if (!userCookie) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      const userData = JSON.parse(userCookie.value)
      const userRole = userData.role

      // Check if user can access this page
      if (!canAccessPageSync(userRole, pathname)) {
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