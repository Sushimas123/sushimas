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
  User
} from "lucide-react"
import { canAccessPage } from '@/src/utils/dbPermissions'
import { supabase } from '@/src/lib/supabaseClient'
import { useDebounce } from '@/hooks/useDebounce'
import { MenuItem, AppRoutes, BreadcrumbItem, SearchResult } from '@/types/layout'

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
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [recentPages, setRecentPages] = useState<string[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Menu items structure - memoized for performance
  const menuItems = useMemo<MenuItem[]>(() => [
    {
      id: 'dashboard',
      name: 'Dashboard',
      href: AppRoutes.DASHBOARD,
      icon: LayoutDashboard,
    },
    {
      id: 'operations',
      name: 'Operations',
      icon: Package,
      submenu: [
        { name: "Ready Stock", href: AppRoutes.READY_STOCK, icon: Package },
        { name: "Production", href: AppRoutes.PRODUCTION, icon: Factory },
        { name: "Gudang", href: AppRoutes.GUDANG, icon: Warehouse },
        { name: "SO Batch", href: AppRoutes.SO_BATCH, icon: FileText },
      ]
    },
    {
      id: 'reports',
      name: 'Reports',
      icon: BarChart3,
      submenu: [
        { name: "Analysis", href: AppRoutes.ANALYSIS, icon: BarChart3 },
        { name: "Pivot Analysis", href: "/pivot", icon: BarChart3 },
        { name: "Esb Report", href: AppRoutes.ESB, icon: BarChart3 },
        { name: "Production Detail", href: AppRoutes.PRODUCTION_DETAIL, icon: FileText },
      ]
    },
    {
      id: 'master-data',
      name: 'Master Data',
      icon: BookOpen,
      submenu: [
        { name: "Product Name Report", href: AppRoutes.PRODUCT_NAME, icon: Package },
        { name: "Categories", href: AppRoutes.CATEGORIES, icon: BookOpen },
        { name: "Recipes", href: AppRoutes.RECIPES, icon: BookOpen },
        { name: "Supplier", href: AppRoutes.SUPPLIER, icon: Truck },
        { name: "Branches", href: AppRoutes.BRANCHES, icon: Store },
        { name: "Users", href: AppRoutes.USERS, icon: Users },
      ]
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: Settings2Icon,
      submenu: [
        { name: "Product Settings", href: AppRoutes.PRODUCT_SETTINGS, icon: Settings2Icon },
        { name: "Permissions", href: AppRoutes.PERMISSIONS_DB, icon: Settings2Icon },
        { name: "CRUD Permissions", href: AppRoutes.CRUD_PERMISSIONS, icon: Settings2Icon },
        { name: "Audit Log", href: AppRoutes.AUDIT_LOG, icon: FileText },
      ]
    },
  ], [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 animate-pulse">
        <div className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"></div>
        <div className="flex">
          <div className="w-64 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"></div>
          <div className="flex-1 p-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
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
              <Link href="/" className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <div className="h-8 w-20 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold mr-2">
                    Home
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
                    {searchResults.map((result, index) => (
                      <Link
                        key={index}
                        href={result.href || '#'}
                        onClick={() => {
                          setSearchQuery('')
                          setIsSearchFocused(false)
                        }}
                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="flex items-center">
                          <result.icon size={16} className="mr-2 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{result.name}</div>
                            {result.parent && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{result.parent}</div>
                            )}
                          </div>
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
                    {searchResults.map((result, index) => (
                      <Link
                        key={index}
                        href={result.href || '#'}
                        onClick={() => setSearchQuery('')}
                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="flex items-center">
                          <result.icon size={16} className="mr-2 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{result.name}</div>
                            {result.parent && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{result.parent}</div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right side - User menu and actions */}
            <div className="flex items-center">
              {/* Notifications */}
              <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mr-2 relative">
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

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
            fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none
            ${isSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
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

          <nav className="mt-8 px-4 h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="space-y-1">
              {menuItems.map((item) => (
                <div key={item.id}>
                  {item.submenu ? (
                    <div>
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
                          className={`mr-3 flex-shrink-0 
                            ${activeSubmenu === item.id || item.submenu.some(sub => isActiveMenu(sub.href))
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300'
                            }`}
                        />
                        <span className="flex-1 text-left">{item.name}</span>
                        {activeSubmenu === item.id ? (
                          <ChevronDown size={16} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400" />
                        )}
                      </button>
                      
                      {/* Submenu items */}
                      {activeSubmenu === item.id && (
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
                        className={`mr-3 flex-shrink-0 
                          ${isActiveMenu(item.href || '')
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300'
                          }`}
                      />
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Help section */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <Link
                href="/help"
                className="group flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                onClick={() => setIsSidebarOpen(false)}
              >
                <HelpCircle size={18} className="mr-3 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-400" />
                Help & Support
              </Link>
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
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Page title and breadcrumbs */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {getCurrentPageInfo()?.name || 'Dashboard'}
                </h1>
                <nav className="flex mt-2" aria-label="Breadcrumb">
                  <ol className="flex items-center space-x-1 overflow-x-auto">
                    {getBreadcrumbs().map((crumb, index) => (
                      <li key={index} className="flex items-center whitespace-nowrap">
                        {index > 0 && <ChevronRight size={16} className="text-gray-400 mx-1" />}
                        {crumb.href !== '#' ? (
                          <Link 
                            href={crumb.href} 
                            className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            {index === 0 ? <Home size={14} className="inline mr-1" /> : null}
                            {crumb.name}
                          </Link>
                        ) : (
                          <span className={`text-sm font-medium ${
                            index === getBreadcrumbs().length - 1 
                              ? 'text-gray-700 dark:text-gray-300' 
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {crumb.name}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </nav>
              </div>

              {/* Content */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>

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
              {pathname === AppRoutes.READY_STOCK 
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
              {pathname === AppRoutes.GUDANG 
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