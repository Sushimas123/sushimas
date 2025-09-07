"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '../../components/Layout'
import { BarChart3, Package, Users, Store, Truck, BookOpen, Factory, FileText, Warehouse, Settings2 } from 'lucide-react'
import Link from 'next/link'
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

  const [menuItems, setMenuItems] = useState<any[]>([])

  // Get menu items based on role (optimized)
  const getMenuItems = (role: string) => {
    const roleMenus = {
      'super admin': [
        { name: "Ready Stock", href: "/ready", icon: Package },
        { name: "Production", href: "/produksi", icon: Factory },
        { name: "Production Detail", href: "/produksi_detail", icon: FileText },
        { name: "Stock Opname", href: "/stock_opname", icon: FileText },
        { name: "Gudang", href: "/gudang", icon: Warehouse },
        { name: "ESB Report", href: "/esb", icon: BarChart3 },
        { name: "Product Name Report", href: "/product_name", icon: Package },
        { name: "Analysis", href: "/analysis", icon: BarChart3 },
        { name: "Categories", href: "/categories", icon: BookOpen },
        { name: "Recipes", href: "/recipes", icon: BookOpen },
        { name: "Supplier", href: "/supplier", icon: Truck },
        { name: "Branches", href: "/branches", icon: Store },
        { name: "Users", href: "/users", icon: Users },
        { name: "Permissions", href: "/permissions-db", icon: Settings2 }
      ],
      admin: [
        { name: "Ready Stock", href: "/ready", icon: Package },
        { name: "Production", href: "/produksi", icon: Factory },
        { name: "Production Detail", href: "/produksi_detail", icon: FileText },
        { name: "Stock Opname", href: "/stock_opname", icon: FileText },
        { name: "Gudang", href: "/gudang", icon: Warehouse },
        { name: "ESB Report", href: "/esb", icon: BarChart3 },
        { name: "Analysis", href: "/analysis", icon: BarChart3 },
        { name: "Categories", href: "/categories", icon: BookOpen },
        { name: "Recipes", href: "/recipes", icon: BookOpen }
      ],
      finance: [
        { name: "Ready Stock", href: "/ready", icon: Package },
        { name: "Production", href: "/produksi", icon: Factory },
        { name: "Production Detail", href: "/produksi_detail", icon: FileText },
        { name: "Stock Opname", href: "/stock_opname", icon: FileText },
        { name: "Gudang", href: "/gudang", icon: Warehouse },
        { name: "ESB Report", href: "/esb", icon: BarChart3 },
        { name: "Analysis", href: "/analysis", icon: BarChart3 },
        { name: "Users", href: "/users", icon: Users }
      ],
      pic_branch: [
        { name: "Ready Stock", href: "/ready", icon: Package },
        { name: "Production", href: "/produksi", icon: Factory },
        { name: "Stock Opname", href: "/stock_opname", icon: FileText },
        { name: "Gudang", href: "/gudang", icon: Warehouse },
        { name: "ESB Report", href: "/esb", icon: BarChart3 }
      ],
      staff: [
        { name: "Ready Stock", href: "/ready", icon: Package },
        { name: "Production", href: "/produksi", icon: Factory },
        { name: "Stock Opname", href: "/stock_opname", icon: FileText }
      ]
    }
    return roleMenus[role as keyof typeof roleMenus] || []
  }

  // Load menu items when user changes (synchronous)
  useEffect(() => {
    if (user?.role) {
      setMenuItems(getMenuItems(user.role))
    }
  }, [user])

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
