"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import {
  BarChart3,
  Package,
  BookOpen,
  Truck,
  Store,
  Users,
  Factory,
  FileText,
  Warehouse,
  Menu,
  X,
  Settings2Icon,
  User
} from "lucide-react"
import { canAccessPage } from '@/src/utils/dbPermissions'
import { supabase } from '@/src/lib/supabaseClient'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string>('')
  const [userBranches, setUserBranches] = useState<string[]>([])
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      const userData = JSON.parse(user)
      setUserRole(userData.role || 'guest')
      setUserName(userData.nama_lengkap || userData.email || '')
      
      // Get user's branches from user_branches table
      if (userData.id_user) {
        fetchUserBranches(userData.id_user, userData.role)
      }
    }
  }, [])

  const fetchUserBranches = async (userId: number, role: string) => {
    try {
      if (role === 'super admin' || role === 'admin') {
        setUserBranches(['All Branches'])
        return
      }
      
      const { data } = await supabase
        .from('user_branches')
        .select(`
          kode_branch,
          branches!inner(nama_branch)
        `)
        .eq('id_user', userId)
        .eq('is_active', true)
      
      const branchNames = data?.map(item => (item.branches as any).nama_branch) || []
      setUserBranches(branchNames.length > 0 ? branchNames : ['No Branch Assigned'])
    } catch (error) {
      console.error('Error fetching user branches:', error)
      setUserBranches(['Unknown'])
    }
  }

  // Permission-based menu filtering
  const getFilteredMenuItems = async (items: any[], role: string) => {
    const filteredItems = []
    for (const item of items) {
      try {
        const pagePath = item.href.replace('/', '')
        const hasAccess = await canAccessPage(role, pagePath)
        if (hasAccess) {
          filteredItems.push(item)
        }
      } catch (error) {
        console.error('Error checking access for', item.href, error)
        // Default to showing the item if there's an error
        filteredItems.push(item)
      }
    }
    return filteredItems
  }

  const [filteredTopMenuItems, setFilteredTopMenuItems] = useState<any[]>([])
  const [filteredSideMenuItems, setFilteredSideMenuItems] = useState<any[]>([])
  const [menuLoading, setMenuLoading] = useState(true)

  useEffect(() => {
    if (userRole) {
      setMenuLoading(true)
      Promise.all([
        getFilteredMenuItems(topMenuItems, userRole),
        getFilteredMenuItems(sideMenuItems, userRole)
      ]).then(([topItems, sideItems]) => {
        setFilteredTopMenuItems(topItems)
        setFilteredSideMenuItems(sideItems)
        setMenuLoading(false)
      }).catch(error => {
        console.error('Error loading menu items:', error)
        // Fallback: show all items if there's an error
        setFilteredTopMenuItems(topMenuItems)
        setFilteredSideMenuItems(sideMenuItems)
        setMenuLoading(false)
      })
    }
  }, [userRole])

  const topMenuItems = [
    { name: "Ready Stock", href: "/ready", icon: Package },
    { name: "Production", href: "/produksi", icon: Factory },
    { name: "Production Detail", href: "/produksi_detail", icon: FileText },
    { name: "Stock Opname", href: "/stock_opname", icon: FileText },
    { name: "Gudang", href: "/gudang", icon: Warehouse },
    { name: "Setting", href: "/product_settings", icon: Settings2Icon },
    { name: "View", href: "/analysis", icon: BarChart3 }
  ]

  const sideMenuItems = [
    { name: "Esb Report", href: "/esb", icon: BarChart3 },
    { name: "Product Name Report", href: "/product_name", icon: Package }, 
    { name: "Categories", href: "/categories", icon: BookOpen },
    { name: "Recipes", href: "/recipes", icon: BookOpen },
    { name: "Supplier", href: "/supplier", icon: Truck },
    { name: "Branches", href: "/branches", icon: Store },
    { name: "Users", href: "/users", icon: Users },
    { name: "Permissions", href: "/permissions-db", icon: Settings2Icon },
    { name: "CRUD Permissions", href: "/crud-permissions", icon: Settings2Icon },
    { name: "Audit Log", href: "/audit-log", icon: FileText }
  ]



  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar - Desktop */}
      <header className="hidden md:block bg-gray-800 text-white shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold hover:text-white/90 transition-colors">
              📦 Sushimas Inventory
            </Link>
            <div className="flex items-center gap-4">
              {userRole && (
                <div className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded-full">
                  <User size={14} />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium capitalize">{userRole}</span>
                    <span className="text-xs text-gray-300 truncate max-w-32" title={userBranches.join(', ')}>
                      {userBranches.length > 0 ? userBranches.join(', ') : 'Loading...'}
                    </span>
                  </div>
                </div>
              )}
              <nav className="flex items-center gap-2">
              {filteredTopMenuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium
                      ${
                        isActive
                          ? "bg-gray-100 text-gray-800"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }`}
                  >
                    <Icon size={16} />
                    <span className="hidden lg:block">{item.name}</span>
                  </Link>
                )
              })}
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden bg-gray-800 text-white shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            📦 Sushimas Inventory
          </Link>
          {userRole && (
            <div className="flex items-center gap-2 bg-gray-700 px-2 py-1 rounded-full">
              <User size={12} />
              <div className="flex flex-col">
                <span className="text-xs font-medium capitalize">{userRole}</span>
                <span className="text-xs text-gray-300 truncate max-w-20" title={userBranches.join(', ')}>
                  {userBranches.length > 0 ? userBranches[0] : 'Loading...'}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-80px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 bg-gray-800 text-white shadow-sm flex-col">
          {/* Menu */}
          <nav className="flex-1 p-4 space-y-2">
            {menuLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              </div>
            ) : (
              filteredSideMenuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium
                      ${
                        isActive
                          ? "bg-gray-100 text-gray-800"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }`}
                  >
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </Link>
                )
              })
            )}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700 text-xs text-gray-400">
            © 2025 Sushimas | All rights reserved.
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-white md:pb-0 pb-24">
          <div className="md:pb-0 pb-4">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 text-white shadow-lg border-t border-gray-700 z-50 safe-area-inset-bottom">
        <div className="grid grid-cols-5 gap-1 py-3 px-2">
          {/* Dashboard */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all min-h-[60px] justify-center
              ${
                pathname === "/"
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
          >
            <BarChart3 size={16} />
            <span className="text-xs font-medium">Home</span>
          </Link>
          
          {/* Top Menu Items */}
          {filteredTopMenuItems.slice(0, 3).map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all min-h-[60px] justify-center
                  ${
                    isActive
                      ? "bg-gray-700 text-white"
                      : "text-gray-300 hover:text-white"
                  }`}
              >
                <Icon size={16} />
                <span className="text-xs font-medium">{item.name?.split(' ')[0]}</span>
              </Link>
            )
          })}
          
          {/* More Menu */}
          <Link
            href="/esb"
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all min-h-[60px] justify-center
              ${
                ['/esb', '/product_name', '/stock_opname', '/ready', '/categories', '/recipes', '/supplier', '/branches', '/users'].includes(pathname)
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
          >
            <Menu size={16} />
            <span className="text-xs font-medium">More</span>
          </Link>
        </div>
        
        {/* Secondary Row for More Items */}
        {['/esb', '/product_name', '/stock_opname', '/ready', '/categories', '/recipes', '/supplier', '/branches', '/users'].includes(pathname) && (
          <div className="border-t border-gray-700 bg-gray-700">
            <div className="flex overflow-x-auto py-1 px-1 gap-1">
              {filteredSideMenuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all whitespace-nowrap
                      ${
                        isActive
                          ? "bg-gray-600 text-white"
                          : "text-gray-300 hover:text-white"
                      }`}
                  >
                    <Icon size={12} />
                    <span className="text-xs">{item.name.split(' ')[0]}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>
    </div>
  )
}