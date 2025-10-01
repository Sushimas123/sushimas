"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useNavigationPermissions } from '@/hooks/useNavigationPermissions'

interface PageAccessControlProps {
  children: React.ReactNode
  pageName: string
}

export default function PageAccessControl({ children, pageName }: PageAccessControlProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const router = useRouter()
  const { permissions, loading: permissionsLoading } = useNavigationPermissions()

  useEffect(() => {
    const checkAccess = () => {
      const userData = localStorage.getItem('user')
      if (!userData) {
        router.push('/auth/login')
        return
      }

      try {
        const user = JSON.parse(userData)
        setUserRole(user.role)
        

        
        // Super admin and admin always have access
        if (user.role === 'super admin' || user.role === 'admin') {

          setHasAccess(true)
          return
        }
        
        // Use the same permission system as navigation
        if (!permissionsLoading) {
          // For nested routes, check parent permission
          let permissionKey = pageName
          
          // Handle special cases for nested routes
          if (pageName === 'stock-alert') {
            permissionKey = 'purchaseorder' // stock-alert is under purchaseorder
          } else if (pageName === 'barang_masuk') {
            permissionKey = 'purchaseorder' // barang_masuk is under purchaseorder
          }
          
          const access = permissions[permissionKey] === true || permissions[pageName] === true

          setHasAccess(access)
        }
      } catch (error) {
        console.error('Error checking access:', error)
        setHasAccess(false)
      }
    }

    checkAccess()
  }, [pageName, router, permissions, permissionsLoading])

  if (hasAccess === null || permissionsLoading) {
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
            onClick={() => router.push('/')}
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