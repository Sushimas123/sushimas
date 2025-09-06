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

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string>('')
  const [userBranch, setUserBranch] = useState<string>('')

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      const userData = JSON.parse(user)
      setUserRole(userData.role || 'guest')
      setUserBranch(userData.branch || '')
    }
  }, [])

  // Role-based menu filtering
  const getFilteredMenuItems = (items: any[], role: string) => {
    return items.filter(item => {
      if (!item.roles) return true // jika tidak ada role restriction, tampilkan
      return item.roles.includes(role)
    })
  }

  const topMenuItems = [
    { name: "Ready Stock", href: "/ready", icon: Package, roles: ['admin', 'manager', 'pic_branch', 'staff'] },
    { name: "Production", href: "/produksi", icon: Factory, roles: ['admin', 'manager', 'pic_branch'] },
    { name: "Production Detail", href: "/produksi_detail", icon: FileText, roles: ['admin', 'manager'] },
    { name: "Stock Opname", href: "/stock_opname", icon: FileText, roles: ['admin', 'manager', 'pic_branch'] },
    { name: "Gudang", href: "/gudang", icon: Warehouse, roles: ['admin', 'manager', 'pic_branch'] },
    { name: "Setting", href: "/product_settings", icon: Settings2Icon, roles: ['admin', 'manager'] },
    { name: "View", href: "/analysis", icon: BarChart3, roles: ['admin', 'manager'] }
  ]

  const sideMenuItems = [
    { name: "Esb Report", href: "/esb", icon: BarChart3, roles: ['admin', 'manager'] },
    { name: "Product Name Report", href: "/product_name", icon: Package, roles: ['admin', 'manager', 'pic_branch'] }, 
    { name: "Categories", href: "/categories", icon: BookOpen, roles: ['admin', 'manager'] },
    { name: "Recipes", href: "/recipes", icon: BookOpen, roles: ['admin', 'manager', 'pic_branch'] },
    { name: "Supplier", href: "/supplier", icon: Truck, roles: ['admin', 'manager'] },
    { name: "Branches", href: "/branches", icon: Store, roles: ['admin', 'manager'] },
    { name: "Users", href: "/users", icon: Users, roles: ['admin'] }
  ]

  const filteredTopMenuItems = getFilteredMenuItems(topMenuItems, userRole)
  const filteredSideMenuItems = getFilteredMenuItems(sideMenuItems, userRole)

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
                    {userBranch && <span className="text-xs text-gray-300">{userBranch}</span>}
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
                {userBranch && <span className="text-xs text-gray-300">{userBranch}</span>}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-80px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 bg-gray-800 text-white shadow-sm flex-col">
          {/* Branding */}
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold tracking-wide">📦 InvenPro</h2>
            <p className="text-sm text-gray-300 mt-1">Inventory & Production Management</p>
          </div>

          {/* Menu */}
          <nav className="flex-1 p-4 space-y-2">
            {filteredSideMenuItems.map((item) => {
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
            })}
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