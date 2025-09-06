import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Route permissions berdasarkan role
const ROUTE_PERMISSIONS = {
  '/dashboard': ['admin', 'manager', 'pic_branch', 'staff'],
  '/ready': ['admin', 'manager', 'pic_branch', 'staff'],
  '/produksi': ['admin', 'manager', 'pic_branch'],
  '/produksi_detail': ['admin', 'manager'],
  '/stock_opname': ['admin', 'manager', 'pic_branch'],
  '/gudang': ['admin', 'manager', 'pic_branch'],
  '/product_settings': ['admin', 'manager'],
  '/analysis': ['admin', 'manager'],
  '/esb': ['admin', 'manager'],
  '/product_name': ['admin', 'manager', 'pic_branch'],
  '/categories': ['admin', 'manager'],
  '/recipes': ['admin', 'manager', 'pic_branch'],
  '/supplier': ['admin', 'manager'],
  '/branches': ['admin', 'manager'],
  '/users': ['admin']
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware untuk public routes
  if (pathname === '/login' || pathname === '/' || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Check if route requires authentication
  const requiredRoles = ROUTE_PERMISSIONS[pathname as keyof typeof ROUTE_PERMISSIONS]
  
  if (requiredRoles) {
    // Get user data from cookie or header (since we can't access localStorage in middleware)
    const userCookie = request.cookies.get('user')
    
    if (!userCookie) {
      // Redirect to login if no user data
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      const userData = JSON.parse(userCookie.value)
      const userRole = userData.role

      if (!requiredRoles.includes(userRole)) {
        // Redirect to dashboard if user doesn't have permission
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch (error) {
      // Redirect to login if user data is invalid
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