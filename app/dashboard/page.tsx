"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '../../components/Layout'
import { BarChart3, Package, Users, Store, Truck, BookOpen, Factory, FileText, Warehouse } from 'lucide-react'
import Link from 'next/link'

interface User {
  id: number
  email: string
  name: string
  role: string
  branch: string
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

  // Role-based menu items
  const getMenuItems = (role: string) => {
    const allItems = [
      { name: "Ready Stock", href: "/ready", icon: Package, roles: ['admin', 'manager', 'pic_branch', 'staff'] },
      { name: "Production", href: "/produksi", icon: Factory, roles: ['admin', 'manager', 'pic_branch'] },
      { name: "Production Detail", href: "/produksi_detail", icon: FileText, roles: ['admin', 'manager'] },
      { name: "Stock Opname", href: "/stock_opname", icon: FileText, roles: ['admin', 'manager', 'pic_branch'] },
      { name: "Gudang", href: "/gudang", icon: Warehouse, roles: ['admin', 'manager', 'pic_branch'] },
      { name: "ESB Report", href: "/esb", icon: BarChart3, roles: ['admin', 'manager'] },
      { name: "Product Name Report", href: "/product_name", icon: Package, roles: ['admin', 'manager', 'pic_branch'] },
      { name: "Analysis", href: "/analysis", icon: BarChart3, roles: ['admin', 'manager'] },
      { name: "Categories", href: "/categories", icon: BookOpen, roles: ['admin', 'manager'] },
      { name: "Recipes", href: "/recipes", icon: BookOpen, roles: ['admin', 'manager', 'pic_branch'] },
      { name: "Supplier", href: "/supplier", icon: Truck, roles: ['admin', 'manager'] },
      { name: "Branches", href: "/branches", icon: Store, roles: ['admin', 'manager'] },
      { name: "Users", href: "/users", icon: Users, roles: ['admin'] }
    ]
    
    return allItems.filter(item => item.roles.includes(role))
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

  const menuItems = getMenuItems(user.role)

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
                  user.role === 'admin' ? 'bg-red-100 text-red-800' :
                  user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                  user.role === 'pic_branch' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {user.role.toUpperCase()}
                </span>
              </span>
              {user.branch && (
                <span>Branch: {user.branch}</span>
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

      {/* Quick Access Menu */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all group"
              >
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Icon size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-500">Access {item.name.toLowerCase()}</p>
                </div>
              </Link>
            )
          })}
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
