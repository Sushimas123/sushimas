"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface PageAccessControlProps {
  children: React.ReactNode
  pageName: string
}

export default function PageAccessControl({ children, pageName }: PageAccessControlProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    const checkAccess = (retryCount = 0) => {
      const userData = localStorage.getItem('user')
      console.log('PageAccessControl check:', { pageName, retryCount, userData: !!userData, url: window.location.href })
      
      if (!userData) {
        if (retryCount < 3) {
          console.log('No user data, retrying...', retryCount + 1)
          setTimeout(() => checkAccess(retryCount + 1), 500)
          return
        }
        console.log('No user data after retries, redirecting to login')
        router.push('/auth/login')
        return
      }

      try {
        const user = JSON.parse(userData)
        setUserRole(user.role)
        
        // Dashboard always accessible for logged in users
        if (pageName === 'dashboard') {
          setHasAccess(true)
          return
        }
        
        // Super admin and admin always have access
        if (user.role === 'super admin' || user.role === 'admin') {
          setHasAccess(true)
          return
        }
        
        // Simple role-based access for other pages
        const rolePermissions: Record<string, string[]> = {
          'staff': ['dashboard', 'ready', 'stock_opname_batch', 'produksi', 'esb', 'gudang-final', 'pettycash', 'assets'],
          'pic_branch': ['dashboard', 'ready', 'stock_opname_batch', 'produksi', 'analysis', 'esb', 'gudang-final', 'pettycash', 'assets'],
          'finance': ['dashboard', 'ready', 'stock_opname_batch', 'produksi', 'analysis', 'esb', 'gudang-final', 'product_settings', 'users', 'finance', 'aging-report', 'pettycash']
        }
        
        const allowedPages = rolePermissions[user.role] || ['dashboard']
        setHasAccess(allowedPages.includes(pageName))
        
      } catch (error) {
        console.error('Error checking access:', error)
        setHasAccess(false)
      }
    }

    checkAccess()
  }, [pageName, router])

  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Role: <span className="font-medium capitalize">{userRole}</span><br/>
            Page: <span className="font-medium">{pageName}</span>
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}