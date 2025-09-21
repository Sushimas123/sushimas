"use client"
import { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '@/src/lib/supabaseClient'
import PageAccessControl from '../../components/PageAccessControl'
import { Filter, X } from 'lucide-react'
import { insertWithAudit, updateWithAudit, deleteWithAudit, logAuditTrail } from '@/src/utils/auditTrail';

// Define types for better type safety
interface PermissionRecord {
  id?: number;
  role: string;
  page: string;
  columns: string[];
  can_access: boolean;
  created_at?: string;
  updated_at?: string;
}

interface PageColumns {
  [key: string]: string[];
}



const USER_ROLES = ['super admin', 'admin', 'finance', 'pic_branch', 'staff'] as const;
type UserRole = typeof USER_ROLES[number];

export default function PermissionsDBPage() {
  const [permissions, setPermissions] = useState<PermissionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole | ''>('')
  const [selectedPage, setSelectedPage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pageColumns, setPageColumns] = useState<PageColumns>({})
  
  // Mobile specific states
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const pages = useMemo(() => Object.keys(pageColumns), [pageColumns]);

  // Check if mobile on mount and on resize
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    
    return () => {
      window.removeEventListener('resize', checkIsMobile)
    }
  }, [])

  const fetchDatabaseSchema = useCallback(async () => {
    try {
      // Try to get schema from existing permissions first
      const { data: existingPages } = await supabase
        .from('user_permissions')
        .select('page')
        .not('page', 'is', null)
      
      const knownTables = [...new Set(existingPages?.map(p => p.page) || [])]
      const schemaMap: PageColumns = {}
      
      // For each known table, try to get a sample row to determine columns
      for (const tableName of knownTables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1)
          
          if (!error && data && data.length > 0) {
            schemaMap[tableName] = Object.keys(data[0])
          } else if (!error) {
            // Table exists but is empty, try to get columns another way
            const { data: emptyData, error: emptyError } = await supabase
              .from(tableName)
              .select('*')
              .limit(0)
            
            if (!emptyError) {
              // Use common columns as fallback
              schemaMap[tableName] = ['id', 'created_at', 'updated_at']
            }
          }
        } catch (tableError) {
        }
      }
      
      // Add all actual pages from the app directory
      const allPages = [
        'analysis', 'audit-log', 'branches', 'categories', 'crud-permissions',
        'dashboard', 'esb', 'gudang', 'permissions-db', 'pivot', 'price-history',
        'product_name', 'product_settings', 'produksi', 'produksi_detail',
        'purchaseorder', 'ready', 'recipes', 'stock_opname_batch', 'supplier',
        'transfer-barang', 'users', 'stock-alert', 'finance', 'aging-report',
        'aging-pivot', 'bulk-payments'
      ]
      
      // Also try database tables that might exist
      const dbTables = [
        'nama_product', 'user_permissions', 'audit_log', 'branch_transfers',
        'branch_notifications', 'user_branches', 'suppliers', 'po_items',
        'purchase_orders', 'po_payments', 'bulk_payments', 'finance_dashboard_view'
      ]
      
      // Add all pages (even if no corresponding database table)
      for (const pageName of allPages) {
        if (!schemaMap[pageName]) {
          try {
            const { data, error } = await supabase
              .from(pageName.replace('-', '_'))
              .select('*')
              .limit(1)
            
            if (!error && data && data.length > 0) {
              schemaMap[pageName] = Object.keys(data[0])
            } else {
              // Page exists but no database table, add basic columns
              schemaMap[pageName] = ['view', 'access']
            }
          } catch {
            // Page exists but no database table, add basic columns
            schemaMap[pageName] = ['view', 'access']
          }
        }
      }
      
      // Try database tables
      for (const tableName of dbTables) {
        if (!schemaMap[tableName]) {
          try {
            const { data, error } = await supabase
              .from(tableName)
              .select('*')
              .limit(1)
            
            if (!error && data && data.length > 0) {
              schemaMap[tableName] = Object.keys(data[0])
            }
          } catch {
            // Ignore tables that don't exist
          }
        }
      }
      
      setPageColumns(schemaMap)
    } catch (error) {
      console.error('Error fetching database schema:', error)
      // Fallback to all pages with basic permissions
      const fallbackSchema: PageColumns = {}
      const allPages = [
        'analysis', 'audit-log', 'branches', 'categories', 'crud-permissions',
        'dashboard', 'esb', 'gudang', 'permissions-db', 'pivot', 'price-history',
        'product_name', 'product_settings', 'produksi', 'produksi_detail',
        'purchaseorder', 'ready', 'recipes', 'stock_opname_batch', 'supplier',
        'transfer-barang', 'users', 'stock-alert'
      ]
      
      allPages.forEach(page => {
        fallbackSchema[page] = ['view', 'access', 'create', 'edit', 'delete']
      })
      
      setPageColumns(fallbackSchema)
    }
  }, [])

  const fetchPermissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .order('role')

      if (error) throw error
      setPermissions(data as PermissionRecord[] || [])
      setError(null)
    } catch (error) {
      console.error('Error fetching permissions:', error)
      setError('Failed to load permissions. Please refresh the page.')
    }
  }, [])

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true)
      const userData = localStorage.getItem('user')
      if (userData) {
        try {
          const user = JSON.parse(userData)
          setUserRole(user.role)
        } catch (parseError) {
          console.error('Error parsing user data:', parseError)
          setError('Invalid user data format')
        }
      }
      
      try {
        await fetchDatabaseSchema()
        await fetchPermissions()
      } catch (error) {
        console.error('Error initializing data:', error)
        setError('Failed to initialize permissions data')
      } finally {
        setLoading(false)
      }
    }
    
    initializeData()
  }, [fetchDatabaseSchema, fetchPermissions])

  const togglePageAccess = async (role: UserRole, page: string) => {
    try {
      const existing = permissions.find(p => p.role === role && p.page === page)
      const newAccess = !existing?.can_access
      const columns = newAccess ? ['*'] : []
      
      // Optimistic update
      const updatedPermission = { role, page, columns, can_access: newAccess }
      setPermissions(prev => {
        const filtered = prev.filter(p => !(p.role === role && p.page === page))
        return [...filtered, updatedPermission]
      })
      setError(null)
      
      const { error: updateError } = await supabase
        .from('user_permissions')
        .upsert(updatedPermission, { onConflict: 'role,page' })

      if (updateError) throw updateError
    } catch (err) {
      console.error('Error updating permission:', err)
      setError('Failed to update page permission. Please try again.')
      // Revert optimistic update
      await fetchPermissions()
    }
  }

  const toggleColumnAccess = async (role: UserRole, page: string, column: string) => {
    try {
      const existing = permissions.find(p => p.role === role && p.page === page)
      let currentColumns = existing?.columns || []
      
      if (currentColumns.includes('*')) {
        currentColumns = pageColumns[page] || []
      }
      
      const newColumns = currentColumns.includes(column)
        ? currentColumns.filter((c: string) => c !== column)
        : [...currentColumns, column]
      
      // Optimistic update
      const updatedPermission = { role, page, columns: newColumns, can_access: newColumns.length > 0 }
      setPermissions(prev => {
        const filtered = prev.filter(p => !(p.role === role && p.page === page))
        return [...filtered, updatedPermission]
      })
      setError(null)
      
      const { error: updateError } = await supabase
        .from('user_permissions')
        .upsert(updatedPermission, { onConflict: 'role,page' })

      if (updateError) throw updateError
    } catch (err) {
      console.error('Error updating column permission:', err)
      setError('Failed to update column permission. Please try again.')
      // Revert optimistic update
      await fetchPermissions()
    }
  }

  // Create permission lookup objects for better performance
  const { pageAccessLookup, columnAccessLookup } = useMemo(() => {
    const pageAccess: Record<string, Record<string, boolean>> = {};
    const columnAccess: Record<string, Record<string, Set<string>>> = {};
    
    permissions.forEach(perm => {
      // Initialize page access
      if (!pageAccess[perm.role]) pageAccess[perm.role] = {};
      pageAccess[perm.role][perm.page] = perm.can_access;
      
      // Initialize column access
      if (!columnAccess[perm.role]) columnAccess[perm.role] = {};
      if (!columnAccess[perm.role][perm.page]) columnAccess[perm.role][perm.page] = new Set();
      
      if (perm.columns.includes('*')) {
        // Add all columns for this page
        (pageColumns[perm.page] || []).forEach(col => {
          columnAccess[perm.role][perm.page].add(col);
        });
      } else {
        // Add specific columns
        perm.columns.forEach(col => {
          columnAccess[perm.role][perm.page].add(col);
        });
      }
    });
    
    return { pageAccessLookup: pageAccess, columnAccessLookup: columnAccess };
  }, [permissions, pageColumns]);

  // Optimized access functions
  const canAccessPage = useCallback((role: UserRole, page: string): boolean => {
    return pageAccessLookup[role]?.[page] || false;
  }, [pageAccessLookup]);

  const hasColumnAccess = useCallback((role: UserRole, page: string, column: string): boolean => {
    return columnAccessLookup[role]?.[page]?.has(column) || false;
  }, [columnAccessLookup]);

  // Mobile filter component
  const MobileFilters = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="bg-white w-4/5 h-full p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Select Page</h3>
          <button 
            onClick={() => setShowMobileFilters(false)} 
            aria-label="Close filters"
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium mb-1">Page:</label>
            <select 
              value={selectedPage} 
              onChange={(e) => {
                setSelectedPage(e.target.value)
                setShowMobileFilters(false)
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">-- Select Page --</option>
              {pages.map(page => (
                <option key={page} value={page}>{page.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  if (userRole !== 'super admin' && userRole !== 'admin') {
    return (
      <Layout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p>Only super admin and admin can access permissions settings</p>
        </div>
      </Layout>
    )
  }

  // Get columns for selected page with fallback
  const currentPageColumns = selectedPage ? pageColumns[selectedPage] || [] : []

  return (
    <Layout>
      <PageAccessControl pageName="permissions-db">
        <div className="p-4 md:p-6">
          {/* Mobile Filters */}
          {showMobileFilters && <MobileFilters />}

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-lg md:text-2xl font-bold">🔐 Column-Level Permissions</h1>
            {isMobile && (
              <button 
                onClick={() => setShowMobileFilters(true)}
                className="ml-auto p-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                aria-label="Open filters"
              >
                <Filter size={20} />
              </button>
            )}
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
              <span>{error}</span>
              <button 
                onClick={() => setError(null)} 
                className="text-red-700 hover:text-red-900"
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          
          {/* Desktop Page Selector */}
          {!isMobile && (
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Select Page:</label>
              <select 
                value={selectedPage} 
                onChange={(e) => setSelectedPage(e.target.value)}
                className="border rounded px-3 py-2 w-full max-w-md"
              >
                <option value="">-- Select Page --</option>
                {pages.map(page => (
                  <option key={page} value={page}>{page.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">Loading permissions...</div>
          ) : selectedPage ? (
            <div className="bg-white p-2 md:p-4 rounded shadow">
              <h2 className="text-sm md:text-lg font-semibold mb-4">{selectedPage.toUpperCase()} Permissions</h2>
              
              {/* Desktop View */}
              {!isMobile ? (
                <>
                  {/* Page Access */}
                  <div className="mb-6 overflow-x-auto">
                    <h3 className="font-medium mb-2">Page Access</h3>
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 text-left border">Role</th>
                          <th className="p-2 text-center border">Can Access Page</th>
                        </tr>
                      </thead>
                      <tbody>
                        {USER_ROLES.map(role => {
                          const hasAccess = canAccessPage(role, selectedPage)
                          
                          return (
                            <tr key={role}>
                              <td className="p-2 border capitalize">{role}</td>
                              <td className="p-2 text-center border">
                                <input
                                  type="checkbox"
                                  checked={hasAccess}
                                  onChange={() => togglePageAccess(role, selectedPage)}
                                  aria-label={`Toggle page access for ${role}`}
                                  className="w-4 h-4"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Column Access */}
                  <div className="overflow-x-auto">
                    <h3 className="font-medium mb-2">Column Access</h3>
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 text-left border">Column</th>
                          {USER_ROLES.map(role => (
                            <th key={role} className="p-2 text-center border capitalize">{role}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentPageColumns.map(column => (
                          <tr key={column}>
                            <td className="p-2 border font-medium">{column}</td>
                            {USER_ROLES.map(role => {
                              const pageAccess = canAccessPage(role, selectedPage)
                              const columnAccess = hasColumnAccess(role, selectedPage, column)
                              
                              return (
                                <td key={role} className="p-2 text-center border">
                                  <input
                                    type="checkbox"
                                    checked={columnAccess}
                                    disabled={!pageAccess}
                                    onChange={() => toggleColumnAccess(role, selectedPage, column)}
                                    className={`w-4 h-4 ${!pageAccess ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    aria-label={`Toggle ${column} access for ${role}`}
                                  />
                                  {!pageAccess && (
                                    <div className="text-xs text-red-500 mt-1">No page access</div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                /* Mobile View */
                <div className="space-y-4">
                  {/* Page Access - Mobile */}
                  <div>
                    <h3 className="font-medium mb-3 text-sm">Page Access</h3>
                    <div className="space-y-2">
                      {USER_ROLES.map(role => {
                        const hasAccess = canAccessPage(role, selectedPage)
                        
                        return (
                          <div key={role} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                            <span className="capitalize font-medium text-sm">{role}</span>
                            <input
                              type="checkbox"
                              checked={hasAccess}
                              onChange={() => togglePageAccess(role, selectedPage)}
                              className="w-5 h-5"
                              aria-label={`Toggle page access for ${role}`}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Column Access - Mobile */}
                  <div>
                    <h3 className="font-medium mb-3 text-sm">Column Access</h3>
                    <div className="space-y-3">
                      {currentPageColumns.map(column => (
                        <div key={column} className="bg-gray-50 rounded p-3">
                          <h4 className="font-medium text-sm mb-2">{column}</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {USER_ROLES.map(role => {
                              const pageAccess = canAccessPage(role, selectedPage)
                              const columnAccess = hasColumnAccess(role, selectedPage, column)
                              
                              return (
                                <div key={role} className="flex items-center justify-between">
                                  <span className="capitalize text-xs">{role}</span>
                                  <input
                                    type="checkbox"
                                    checked={columnAccess}
                                    disabled={!pageAccess}
                                    onChange={() => toggleColumnAccess(role, selectedPage, column)}
                                    className={`w-4 h-4 ${!pageAccess ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    aria-label={`Toggle ${column} access for ${role}`}
                                  />
                                </div>
                              )
                            })}
                          </div>
                          {USER_ROLES.some(role => !canAccessPage(role, selectedPage)) && (
                            <div className="text-xs text-red-500 mt-2">
                              Some roles don't have page access
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 p-8">
              {isMobile ? (
                <div>
                  <p className="mb-4">Please select a page to configure permissions</p>
                  <button 
                    onClick={() => setShowMobileFilters(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Select Page
                  </button>
                </div>
              ) : (
                "Please select a page to configure permissions"
              )}
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  )
}