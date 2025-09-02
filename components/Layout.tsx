"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
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
  Settings2Icon
} from "lucide-react"

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname()

  const topMenuItems = [
    { name: "Ready Stock", href: "/ready", icon: Package },
    { name: "Production", href: "/produksi", icon: Factory },
    { name: "Production Detail", href: "/produksi_detail", icon: FileText },
    { name: "Stock Opname", href: "/stock_opname", icon: FileText },
    { name: "Gudang", href: "/gudang", icon: Warehouse },
    { nama: "Setting", href: "/product_settings", icon: Settings2Icon },
    { name: "View", href: "/analysis", icon: BarChart3 }
  ]

  const sideMenuItems = [
    { name: "Esb Report", href: "/esb", icon: BarChart3 },
    { name: "Product Name Report", href: "/product_name", icon: Package }, 
    { name: "Categories", href: "/categories", icon: BookOpen },
    { name: "Recipes", href: "/recipes", icon: BookOpen },
    { name: "Supplier", href: "/supplier", icon: Truck },
    { name: "Branches", href: "/branches", icon: Store },
    { name: "Users", href: "/users", icon: Users }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar - Desktop */}
      <header className="hidden md:block bg-gradient-to-r from-blue-600 to-red-600 text-white shadow-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold hover:text-white/90 transition-colors">
              🍣 Production Center
            </Link>
            <nav className="flex items-center gap-2">
              {topMenuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium
                      ${
                        isActive
                          ? "bg-white text-blue-600 shadow-md"
                          : "text-white/90 hover:bg-white/20 hover:text-white"
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
      </header>

      {/* Mobile Header */}
      <header className="md:hidden bg-gradient-to-r from-blue-600 to-red-600 text-white shadow-lg">
        <div className="px-4 py-3">
          <Link href="/" className="text-lg font-bold">
            🍣 Production Center
          </Link>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-80px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 bg-gradient-to-b from-blue-600 to-red-600 text-white shadow-xl flex-col">
          {/* Branding */}
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-bold tracking-wide">🍣 Sushimas</h2>
            <p className="text-sm text-white/80 mt-1">Management System</p>
          </div>

          {/* Menu */}
          <nav className="flex-1 p-4 space-y-2">
            {sideMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium
                    ${
                      isActive
                        ? "bg-white text-blue-600 shadow-md"
                        : "text-white/90 hover:bg-white/20 hover:text-white"
                    }`}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/20 text-xs text-white/70">
            © 2025 Sushimas Restaurant
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-white md:pb-0 pb-20">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-red-600 text-white shadow-lg border-t border-white/20">
        <div className="grid grid-cols-5 gap-1 py-2 px-1">
          {/* Dashboard */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 px-1 py-1 rounded-lg transition-all
              ${
                pathname === "/"
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:text-white"
              }`}
          >
            <BarChart3 size={14} />
            <span className="text-xs">Home</span>
          </Link>
          
          {/* Top Menu Items */}
          {topMenuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-1 py-1 rounded-lg transition-all
                  ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:text-white"
                  }`}
              >
                <Icon size={14} />
                <span className="text-xs">{item.name?.split(' ')[0]}</span>
              </Link>
            )
          })}
          
          {/* More Menu */}
          <Link
            href="/esb"
            className={`flex flex-col items-center gap-1 px-1 py-1 rounded-lg transition-all
              ${
                ['/esb', '/product_name', '/stock_opname', '/ready', '/categories', '/recipes', '/supplier', '/branches', '/users'].includes(pathname)
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:text-white"
              }`}
          >
            <Menu size={14} />
            <span className="text-xs">More</span>
          </Link>
        </div>
        
        {/* Secondary Row for More Items */}
        {['/esb', '/product_name', '/stock_opname', '/ready', '/categories', '/recipes', '/supplier', '/branches', '/users'].includes(pathname) && (
          <div className="border-t border-white/20 bg-white/10">
            <div className="flex overflow-x-auto py-1 px-1 gap-1">
              {sideMenuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all whitespace-nowrap
                      ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "text-white/80 hover:text-white"
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