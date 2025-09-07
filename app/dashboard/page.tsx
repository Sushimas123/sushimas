"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '../../components/Layout'

import { canAccessPage } from '@/src/utils/dbPermissions'

interface User {
  id: number
  email: string
  name: string
  role: string
  cabang: string
}

function DashboardContent() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/login')
      return
    }
    
    try {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
    } catch (error) {
      console.error('Error parsing user data:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    // Hapus cookie
    document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/login')
  }



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // menuItems is now loaded via useEffect

  return (
    <div className="p-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome back, {user.name}! 👋
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  user.role === 'super admin' ? 'bg-red-100 text-red-800' :
                  user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                  user.role === 'finance' ? 'bg-purple-100 text-purple-800' :
                  user.role === 'pic_branch' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {user.role.toUpperCase()}
                </span>
              </span>
              {user.cabang && (
                <span>Branch: {user.cabang}</span>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
          >
            Logout
          </button>
        </div>
      </div>


    </div>
  )
}

export default function DashboardPage() {
  return (
    <Layout>
      <DashboardContent />
    </Layout>
  )
}
