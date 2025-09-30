"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  HelpCircle,
  Home,
  LogOut,
  User,
  Building,
  Plus,
  PackageCheck,
  ChartArea,
  FolderSync,
  AlertTriangle,
  AlertTriangleIcon,
  CircleDollarSign,
  CheckCircle,
  SquareSigma,
  ShoppingBasket,
  BaggageClaim,
  NotepadText,
  SquareActivity,
  MapPinHouse,
  Database,
  ScanBarcode,
  PencilRuler,
  SlidersHorizontal,
  GlobeLock,
  ScrollText,
  Receipt,
  Calendar,
  UserCheck
} from "lucide-react"
import { canAccessPage } from '@/src/utils/dbPermissions'
import { supabase } from '@/src/lib/supabaseClient'
import { useDebounce } from '@/hooks/useDebounce'
import { useNavigationPermissions } from '@/hooks/useNavigationPermissions'
import { MenuItem, AppRoutes, BreadcrumbItem, SearchResult } from '@/types/layout'
import PurchaseOrderPage from "@/app/purchaseorder/page"


interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [userRole, setUserRole] = useState<string>('')
  const [userBranches, setUserBranches] = useState<string[]>([])
  const [userName, setUserName] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [recentPages, setRecentPages] = useState<string[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Get user permissions
  const { permissions, loading: permissionsLoading } = useNavigationPermissions()

  // Menu items structure with page names for permission checking
  const allMenuItems = useMemo<MenuItem[]>(() => [
    {
      id: 'dashboard',
      name: 'Dashboard',
      href: AppRoutes.DASHBOARD,
      icon: LayoutDashboard,
      pageName: 'dashboard'
    },
    {
      id: 'operations',
      name: 'Operations',
      icon: Package,
      submenu: [
        { name: "Ready Stock", href: AppRoutes.READY_STOCK, icon: NotepadText, pageName: 'ready' },
        { name: "Production", href: AppRoutes.PRODUCTION, icon: Factory, pageName: 'produksi' },
        { name: "Gudang", href: AppRoutes.GUDANG, icon: Warehouse, pageName: 'gudang-final' },
        { name: "Pivot Analysis", href: "/pivot", icon: SquareSigma, pageName: 'pivot' },
        { name: "SO Batch", href: AppRoutes.SO_BATCH, icon: SquareActivity, pageName: 'stock_opname_batch' },
      ]
    },
    {
      id: 'purchaseorder',
      name: 'Purchase Order',
      icon: Building,
      submenu: [
        { name: "Stock Alert", href: AppRoutes.STOCK_ALERT, icon: AlertTriangleIcon, pageName: 'stock-alert'},
        { name: "Purchase Order", href: "/purchaseorder", icon: BaggageClaim, pageName: 'purchaseorder' },
        { name: "Barang Masuk", href: "/purchaseorder/barang_masuk", icon: ShoppingBasket, pageName: 'barang_masuk'},
        { name: "Transfer Cabang", href: AppRoutes.TRANSFER_BARANG, icon: FolderSync, pageName: 'transfer_barang'},
      ]
    },    
    {
      id: 'reports',
      name: 'Reports',
      icon: BarChart3,
      submenu: [
        { name: "Analysis", href: AppRoutes.ANALYSIS, icon: BarChart3, pageName: 'analysis' },
        { name: "Esb Report", href: AppRoutes.ESB, icon: CircleDollarSign , pageName: 'esb' },
        { name: "Production Detail", href: AppRoutes.PRODUCTION_DETAIL, icon: FileText, pageName: 'produksi_detail' },
        { name: "Price History", href: AppRoutes.PRICE_HISTORY, icon: ChartArea, pageName: 'price_history'}
      ]
    },
    {
      id: 'finance',
      name: 'Finance',
      icon: CircleDollarSign,
      submenu: [
        { name: "Laporan Finance", href: AppRoutes.FINANCE_PURCHASE_ORDERS, icon: FileText, pageName: 'finance' },
        { name: "Bulk Payments", href: "/finance/bulk-payments", icon: Receipt, pageName: 'finance' },
        { name: "Aging Report", href: AppRoutes.FINANCE_AGING_REPORT, icon: AlertTriangle, pageName: 'aging-report' },
        { name: "Jatuh Tempo", href: "/finance/aging-pivot", icon: SquareSigma, pageName: 'aging-report' },
        { name: "Payment Recap", href: "/finance/payment-calendar", icon: Calendar, pageName: 'finance' },
      ]
    },
    {
      id: 'pettycash',
      name: 'Petty Cash',
      icon: Receipt,
      pageName: 'pettycash',
      submenu: [
        { name: "Dashboard", href: "/pettycash", icon: LayoutDashboard, pageName: 'pettycash' },
        { name: "Requests", href: "/pettycash/request", icon: FileText, pageName: 'pettycash' },
        //{ name: "Create Request", href: "/pettycash/request/create", icon: Plus, pageName: 'pettycash' },
        { name: "Expenses", href: "/pettycash/expenses", icon: Receipt, pageName: 'pettycash' },
        { name: "Settlements", href: "/pettycash/settlements", icon: CheckCircle, pageName: 'pettycash' },
        //{ name: "Categories", href: "/pettycash/categories", icon: Settings2Icon, pageName: 'pettycash' },
      ]
    },
    {
      id: 'master-data',
      name: 'Master Data',
      icon: Database,
      submenu: [
        { name: "Product Name Report", href: AppRoutes.PRODUCT_NAME, icon: ScanBarcode, pageName: 'product_name' },
        { name: "Product Settings", href: AppRoutes.PRODUCT_SETTINGS, icon: Settings2Icon, pageName: 'product_settings' },
        { name: "Categories", href: AppRoutes.CATEGORIES, icon: PencilRuler, pageName: 'categories' },
        { name: "Recipes", href: AppRoutes.RECIPES, icon: BookOpen, pageName: 'recipes' },
        { name: "Supplier", href: AppRoutes.SUPPLIER, icon: Truck, pageName: 'supplier' },
        { name: "Branches", href: AppRoutes.BRANCHES, icon: MapPinHouse, pageName: 'branches' },
        { name: "Users", href: AppRoutes.USERS, icon: Users, pageName: 'users' },
        { name: "Assets", href: "/assets", icon: Package, pageName: 'assets' },
      ]
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: Settings2Icon,
      submenu: [
        { name: "Permissions", href: AppRoutes.PERMISSIONS_DB, icon: SlidersHorizontal, pageName: 'permissions-db' },
        { name: "CRUD Permissions", href: AppRoutes.CRUD_PERMISSIONS, icon: GlobeLock, pageName: 'crud-permissions' },
      ]
    },
  ], [])

  // Filter menu items based on permissions
  const menuItems = useMemo(() => {
    if (permissionsLoading) return []
    
    // Super admin gets access to everything
    if (userRole === 'super admin') {
      return allMenuItems
    }
    
    return allMenuItems.filter(item => {
      // Check permission for main menu item first
      const hasMainPermission = item.pageName ? permissions[item.pageName] === true : true
      if (!hasMainPermission) return false
      
      if (item.submenu) {
        // Filter submenu items based on permissions
        const accessibleSubmenu = item.submenu.filter(subItem => {
          const hasPermission = subItem.pageName && permissions[subItem.pageName] === true
          return hasPermission
        })
        
        // Only show parent menu if it has accessible submenu items
        if (accessibleSubmenu.length > 0) {
          return { ...item, submenu: accessibleSubmenu }
        }
        return false
      }
      
      // For menu without submenu, already checked main permission above
      return true
    }).map(item => {
      if (item.submenu) {
        // Update submenu with filtered items
        const accessibleSubmenu = item.submenu.filter(subItem => 
          subItem.pageName && permissions[subItem.pageName] === true
        )
        return { ...item, submenu: accessibleSubmenu }
      }
      return item
    })
  }, [allMenuItems, permissions, permissionsLoading, userRole])

  const handleLogout = () => {
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  // Keep session alive - prevent auto logout
  useEffect(() => {
    const keepSessionAlive = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          // Refresh session to prevent timeout
          await supabase.auth.refreshSession()
        }
      } catch (error) {
        console.log('Session refresh failed:', error)
      }
    }, 30 * 60 * 1000) // Every 30 minutes

    return () => clearInterval(keepSessionAlive)
  }, [])

  useEffect(() => {
    const initializeLayout = async () => {
      const user = localStorage.getItem('user')
      if (user) {
        const userData = JSON.parse(user)
        setUserRole(userData.role || 'guest')
        setUserName(userData.nama_lengkap || userData.email || '')
        setUserEmail(userData.email || '')
        
        if (userData.id_user) {
          await fetchUserBranches(userData.id_user, userData.role)
        }
      }

      // Load recent pages
      const recent = JSON.parse(localStorage.getItem('recentPages') || '[]')
      setRecentPages(recent)

      // Load active submenu state
      const savedSubmenu = localStorage.getItem('activeSubmenu')
      if (savedSubmenu) {
        setActiveSubmenu(savedSubmenu)
      } else {
        // Auto-open submenu if current page is in a submenu
        for (const item of menuItems) {
          if (item.submenu?.some(sub => sub.href === pathname)) {
            setActiveSubmenu(item.id)
            localStorage.setItem('activeSubmenu', item.id)
            break
          }
        }
      }

      setIsLoading(false)
    }

    initializeLayout()
  }, [pathname, menuItems])

  // Track page visits
  useEffect(() => {
    if (!isLoading && pathname) {
      const currentPage = getCurrentPageInfo()
      if (currentPage) {
        const updated = [currentPage.name, ...recentPages.filter(p => p !== currentPage.name)].slice(0, 5)
        setRecentPages(updated)
        localStorage.setItem('recentPages', JSON.stringify(updated))
      }
    }
  }, [pathname, isLoading])

  // Search functionality
  useEffect(() => {
    if (debouncedSearch) {
      handleSearch(debouncedSearch)
    } else {
      setSearchResults([])
    }
  }, [debouncedSearch])

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && window.innerWidth < 1024) {
        setIsSidebarOpen(false)
      }
    }
    
    if (isSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSidebarOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false)
        setIsProfileDropdownOpen(false)
        setSearchQuery('')
        setIsSearchFocused(false)
      }
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        document.getElementById('search-input')?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
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

  const handleSearch = useCallback((query: string) => {
    const results = menuItems.flatMap((item) => {
      const matches: SearchResult[] = []
      if (item.name.toLowerCase().includes(query.toLowerCase())) {
        matches.push({ ...item, type: 'menu' as const })
      }
      if (item.submenu) {
        item.submenu.forEach((sub) => {
          if (sub.name.toLowerCase().includes(query.toLowerCase())) {
            matches.push({ 
              ...sub, 
              id: `${item.id}-${sub.name}`, 
              type: 'submenu' as const, 
              parent: item.name 
            })
          }
        })
      }
      return matches
    })
    setSearchResults(results.slice(0, 5))
  }, [menuItems])

  const getCurrentPageInfo = useCallback(() => {
    for (const item of menuItems) {
      if (item.href === pathname) return item
      if (item.submenu) {
        const subItem = item.submenu.find((sub) => sub.href === pathname)
        if (subItem) return subItem
      }
    }
    return null
  }, [menuItems, pathname])

  const getBreadcrumbs = useCallback((): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [{ name: 'Home', href: AppRoutes.DASHBOARD }]
    
    for (const item of menuItems) {
      if (item.href === pathname) {
        breadcrumbs.push({ name: item.name, href: item.href })
        break
      }
      if (item.submenu) {
        const subItem = item.submenu.find((sub) => sub.href === pathname)
        if (subItem) {
          breadcrumbs.push({ name: item.name, href: item.href || '#' })
          breadcrumbs.push({ name: subItem.name, href: subItem.href })
          break
        }
      }
    }
    
    return breadcrumbs
  }, [menuItems, pathname])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false)
      }
    }
    
    if (isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isProfileDropdownOpen])

  const toggleSubmenu = useCallback((menuId: string) => {
    const newState = activeSubmenu === menuId ? null : menuId
    setActiveSubmenu(newState)
    if (newState) {
      localStorage.setItem('activeSubmenu', newState)
    } else {
      localStorage.removeItem('activeSubmenu')
    }
  }, [activeSubmenu])

  const isActiveMenu = useCallback((href: string) => {
    return pathname === href
  }, [pathname])

  if (isLoading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"></div>
        <div className="flex flex-1">
          <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hidden lg:block"></div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-flex">
                <div className="w-4 h-4 bg-blue-600 rounded-full mr-1 animate-bounce"></div>
                <div className="w-4 h-4 bg-blue-600 rounded-full mr-1 animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              </div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat sistem...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo and menu toggle */}
            <div className="flex items-center">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="mr-2 p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 lg:hidden"
              >
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden lg:block mr-2 p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <Menu size={20} />
              </button>
              <Link href="/" className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <div className="h-10 w-10 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center text-white font-bold mr-3 shadow-lg">
                    <span className="text-lg">SIS</span>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-xl font-bold text-gray-800 dark:text-white">Sushimas</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 -mt-1">Internal System</div>
                  </div>
                </div>
              </Link>
            </div>

            {/* Center - Search bar (mobile/tablet) */}
            <div className="flex-1 flex md:hidden justify-center px-2">
              <div className="relative w-full max-w-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={20} className="text-gray-400" />
                </div>
                <input
                  id="search-input-mobile"
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                
                {/* Search Results Dropdown for Mobile */}
                {searchResults.length > 0 && isSearchFocused && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 dark:border-gray-700">
                      Hasil Pencarian
                    </div>
                    {searchResults.map((result, index) => (
                      <Link
                        key={index}
                        href={result.href || '#'}
                        onClick={() => {
                          setSearchQuery('')
                          setIsSearchFocused(false)
                        }}
                        className="block px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg mr-3 ${
                            result.type === 'menu' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <result.icon size={16} />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{result.name}</div>
                            {result.parent && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                <span>{result.parent}</span>
                                <ChevronRight size={12} className="mx-1" />
                                <span>{result.type === 'submenu' ? 'Submenu' : 'Menu'}</span>
                              </div>
                            )}
                          </div>
                          <ChevronRight size={16} className="text-gray-400" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Center - Search bar (desktop only) */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-8">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={20} className="text-gray-400" />
                </div>
                <input
                  id="search-input"
                  type="text"
                  placeholder="Search inventory... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                
                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 dark:border-gray-700">
                      Hasil Pencarian
                    </div>
                    {searchResults.map((result, index) => (
                      <Link
                        key={index}
                        href={result.href || '#'}
                        onClick={() => setSearchQuery('')}
                        className="block px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg mr-3 ${
                            result.type === 'menu' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <result.icon size={16} />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{result.name}</div>
                            {result.parent && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                <span>{result.parent}</span>
                                <ChevronRight size={12} className="mx-1" />
                                <span>{result.type === 'submenu' ? 'Submenu' : 'Menu'}</span>
                              </div>
                            )}
                          </div>
                          <ChevronRight size={16} className="text-gray-400" />
                        </div>
                      </Link>
                    ))}
                    <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-700">
                      Tekan Enter untuk pencarian lengkap
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side - User menu and actions */}
            <div className="flex items-center">

              
              {/* Notifications */}
              <div className="relative mr-2">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 relative"
                >
                  <Bell size={20} />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
                
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="font-semibold">Notifikasi</h3>
                      <button className="text-blue-600 text-sm">Tandai sudah dibaca</button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <div className="p-4 text-center text-gray-500">
                        Tidak ada notifikasi
                      </div>
                    </div>
                    <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                      <Link href="/notifications" className="block text-center text-sm text-blue-600 hover:text-blue-800 p-2">
                        Lihat semua notifikasi
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* User profile dropdown */}
              <div className="relative ml-3" ref={profileDropdownRef}>
                <div>
                  <button
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    id="user-menu-button"
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                      {userName ? userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="ml-2 hidden md:block">
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{userName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{userRole}</p>
                      </div>
                    </div>
                    <ChevronDown size={16} className="ml-1 text-gray-400 hidden md:block" />
                  </button>
                </div>

                {/* Profile dropdown menu */}
                {isProfileDropdownOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{userName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 capitalize mt-1">{userRole}</p>
                    </div>
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Branches:</p>
                      {userBranches.map((branch, index) => (
                        <p key={index} className="text-xs text-gray-600 dark:text-gray-300 truncate">
                          {branch}
                        </p>
                      ))}
                    </div>
            
                    <Link
                      href="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <User size={16} className="mr-2" />
                      Your Profile
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <Settings2Icon size={16} className="mr-2" />
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <LogOut size={16} className="mr-2" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div 
          ref={sidebarRef}
          className={`
            fixed inset-y-0 left-0 z-30 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none
            ${isSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
            ${isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
            w-64
          `}
          style={{ maxWidth: 'calc(100vw - 4rem)' }}
        >
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 lg:hidden">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-2">
                SM
              </div>
              <span className="text-xl font-bold text-gray-800 dark:text-white">Sushimas</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
          </div>

          <nav className="mt-8 px-4 h-[calc(100vh-12rem)] overflow-y-auto">
            <div className="space-y-1">
              {menuItems.map((item) => (
                <div key={item.id}>
                  {item.submenu ? (
                    <div className="relative group">
                      <button
                        onClick={() => toggleSubmenu(item.id)}
                        className={`group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors
                          ${activeSubmenu === item.id || item.submenu.some(sub => isActiveMenu(sub.href)) 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                          }`}
                      >
                        <item.icon
                          size={18}
                          className={`${isSidebarCollapsed ? 'mx-auto' : 'mr-3'} flex-shrink-0 
                            ${activeSubmenu === item.id || item.submenu.some(sub => isActiveMenu(sub.href))
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300'
                            }`}
                        />
                        {!isSidebarCollapsed && (
                          <>
                            <span className="flex-1 text-left">{item.name}</span>
                            {activeSubmenu === item.id ? (
                              <ChevronDown size={16} className="text-gray-400" />
                            ) : (
                              <ChevronRight size={16} className="text-gray-400" />
                            )}
                          </>
                        )}
                      </button>
                      {isSidebarCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          {item.name}
                        </div>
                      )}
                      
                      {/* Submenu items */}
                      {activeSubmenu === item.id && !isSidebarCollapsed && (
                        <div className="mt-1 ml-4 space-y-1">
                          {item.submenu.map((subItem) => {
                            const SubIcon = subItem.icon;
                            return (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                                  ${isActiveMenu(subItem.href)
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                                  }`}
                              >
                                <SubIcon
                                  size={16}
                                  className={`mr-3 flex-shrink-0 
                                    ${isActiveMenu(subItem.href)
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-400'
                                    }`}
                                />
                                {subItem.name}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative group">
                      <Link
                        href={item.href || '#'}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                          ${isActiveMenu(item.href || '')
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                          }`}
                      >
                        <item.icon
                          size={18}
                          className={`${isSidebarCollapsed ? 'mx-auto' : 'mr-3'} flex-shrink-0 
                            ${isActiveMenu(item.href || '')
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300'
                            }`}
                        />
                        {!isSidebarCollapsed && item.name}
                      </Link>
                      {isSidebarCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          {item.name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            

          </nav>
        </div>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-gray-900 bg-opacity-50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto focus:outline-none pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Footer with system info */}
      <footer className="py-4 px-6 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hidden lg:block">
        <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
          <div>
            © 2025 Sushimas Internal System • v1.0.1 (P.S)
          </div>
          <div className="flex items-center">

          </div>
        </div>
      </footer>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 safe-area-inset-bottom">
        <div className="grid grid-cols-5 gap-1 py-2 px-1">
          <Link
            href={AppRoutes.DASHBOARD}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors
              ${pathname === AppRoutes.DASHBOARD 
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
          >
            <LayoutDashboard size={20} />
            <span className="text-xs mt-1">Home</span>
          </Link>
          
          <Link
            href={AppRoutes.READY_STOCK}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors
              ${pathname === AppRoutes.READY_STOCK 
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
          >
            <Package size={20} />
            <span className="text-xs mt-1">Ready</span>
          </Link>
          
          <Link
            href={AppRoutes.GUDANG}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors
              ${pathname === AppRoutes.GUDANG 
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
          >
            <Package size={20} />
            <span className="text-xs mt-1">Gudang</span>
          </Link>          
          <Link
            href={AppRoutes.PRODUCTION}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors
              ${pathname === AppRoutes.PRODUCTION 
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
          >
            <Factory size={20} />
            <span className="text-xs mt-1">Production</span>
          </Link>
          
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <Menu size={20} />
            <span className="text-xs mt-1">More</span>
          </button>
        </div>
      </nav>
    </div>
  )
}