"use client"
import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '@/src/lib/supabaseClient'
import PageAccessControl from '../../components/PageAccessControl'
import { Filter, X, Search, Menu } from 'lucide-react'

export default function PermissionsDBPage() {
  const [permissions, setPermissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [selectedPage, setSelectedPage] = useState('')
  
  // Mobile specific states
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

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

  const roles = ['super admin', 'admin', 'finance', 'pic_branch', 'staff']
  
  const pageColumns = {
    esb: ['id', 'sales_date', 'branch', 'product', 'product_code', 'category', 'sub_category', 'unit', 'qty_total', 'value_total', 'product_id', 'created_at', 'updated_at'],
    ready: ['id', 'ready_no', 'tanggal_input', 'branch_name', 'sub_category', 'product_name', 'id_product', 'ready', 'waste', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    users: ['id_user', 'email', 'nama_lengkap', 'no_telp', 'role', 'cabang', 'is_active', 'password_hash', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    produksi: ['id', 'tanggal_produksi', 'product_name', 'quantity', 'status', 'branch', 'notes', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    analysis: ['id', 'date', 'branch', 'product', 'ready_stock', 'production', 'consumption', 'balance', 'variance', 'created_at'],
    gudang: ['id', 'order_no', 'tanggal', 'id_product', 'jumlah_masuk', 'jumlah_keluar', 'total_gudang', 'cabang', 'source_type', 'is_locked', 'locked_by_so', 'locked_date', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    produksi_detail: ['id', 'produksi_id', 'tanggal_produksi', 'item_id', 'quantity_used', 'unit', 'branch', 'cost', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    stock_opname_batch: ['batch_id', 'batch_date', 'batch_time', 'branch_code', 'sub_category', 'pic_name', 'status', 'created_at', 'updated_at'],
    stock_opname_detail: ['detail_id', 'batch_id', 'product_name', 'system_stock', 'physical_stock', 'difference', 'unit', 'notes'],
    branches: ['id_branch', 'nama_branch', 'kode_branch', 'alamat', 'kota', 'provinsi', 'kode_pos', 'tanggal_berdiri', 'parent_branch_id', 'branch_level', 'timezone', 'currency', 'tax_rate', 'delivery_radius', 'max_staff', 'monthly_target', 'status', 'notes', 'is_active', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    categories: ['id', 'category_name', 'description', 'is_active', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    product_name: ['id', 'product_name', 'category', 'sub_category', 'unit', 'price', 'is_active', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    product_settings: ['id', 'setting_name', 'setting_value', 'description', 'data_type', 'created_at', 'updated_at'],
    recipes: ['id', 'recipe_name', 'ingredients', 'quantity', 'unit', 'instructions', 'cost', 'prep_time', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    supplier: ['id', 'supplier_name', 'contact_person', 'phone', 'email', 'address', 'city', 'province', 'postal_code', 'tax_id', 'payment_terms', 'is_active', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    audit_log: ['id', 'table_name', 'record_id', 'action', 'user_id', 'user_name', 'branch_id', 'old_values', 'new_values', 'created_at'],
    branch_settings: ['id', 'branch_id', 'setting_key', 'setting_value', 'data_type', 'created_at', 'updated_at'],
    branch_transfers: ['id', 'transfer_no', 'from_branch_id', 'to_branch_id', 'product_id', 'quantity', 'unit_price', 'total_value', 'status', 'request_date', 'approved_date', 'shipped_date', 'received_date', 'notes', 'created_by', 'approved_by', 'created_at', 'updated_at'],
    branch_notifications: ['id', 'branch_id', 'notification_type', 'title', 'message', 'priority', 'is_read', 'read_by', 'read_at', 'expires_at', 'created_at'],
    user_branches: ['id', 'id_user', 'kode_branch', 'is_active', 'created_at', 'updated_at'],
    user_permissions: ['id', 'role', 'page', 'columns', 'can_access', 'created_at', 'updated_at'],
    crud_permissions: ['id', 'user_id', 'role', 'page', 'can_create', 'can_read', 'can_update', 'can_delete', 'created_at', 'updated_at'],
    pivot: ['id', 'date', 'subcategory', 'product', 'selisih', 'pemakaian', 'branch', 'analysis_data', 'created_at'],
    dashboard: ['id', 'widget_type', 'widget_data', 'user_id', 'position', 'is_visible', 'created_at', 'updated_at'],
  }

  const pages = Object.keys(pageColumns)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role)
    }
    fetchPermissions()
  }, [])

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .order('role')

      if (error) throw error
      setPermissions(data || [])
    } catch (error) {
      console.error('Error fetching permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePageAccess = async (role: string, page: string) => {
    try {
      const existing = permissions.find(p => p.role === role && p.page === page)
      const newAccess = !existing?.can_access
      
      // When enabling page access, give access to all columns
      // When disabling, remove all column access
      const columns = newAccess ? ['*'] : []
      
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          role,
          page,
          columns,
          can_access: newAccess
        }, {
          onConflict: 'role,page'
        })

      if (error) throw error
      await fetchPermissions()
    } catch (error) {
      console.error('Error updating permission:', error)
      alert('Error updating permission')
    }
  }

  const toggleColumnAccess = async (role: string, page: string, column: string) => {
    try {
      const existing = permissions.find(p => p.role === role && p.page === page)
      let currentColumns = existing?.columns || []
      
      if (currentColumns.includes('*')) {
        currentColumns = pageColumns[page as keyof typeof pageColumns] || []
      }
      
      const newColumns = currentColumns.includes(column)
        ? currentColumns.filter((c: string) => c !== column)
        : [...currentColumns, column]
      
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          role,
          page,
          columns: newColumns,
          can_access: newColumns.length > 0
        }, {
          onConflict: 'role,page'
        })

      if (error) throw error
      await fetchPermissions()
    } catch (error) {
      console.error('Error updating column permission:', error)
      alert('Error updating column permission')
    }
  }

  const hasColumnAccess = (role: string, page: string, column: string) => {
    const perm = permissions.find(p => p.role === role && p.page === page)
    if (!perm) return false
    if (perm.columns?.includes('*')) return true
    return perm.columns?.includes(column) || false
  }

  const canAccessPage = (role: string, page: string) => {
    const perm = permissions.find(p => p.role === role && p.page === page)
    return perm?.can_access || false
  }

  // Mobile filter component
  const MobileFilters = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="bg-white w-4/5 h-full p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Select Page</h3>
          <button onClick={() => setShowMobileFilters(false)}>
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
                className="ml-auto p-2 bg-gray-200 rounded-md"
              >
                <Filter size={20} />
              </button>
            )}
          </div>
          
          {/* Desktop Page Selector */}
          {!isMobile && (
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Select Page:</label>
              <select 
                value={selectedPage} 
                onChange={(e) => setSelectedPage(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="">-- Select Page --</option>
                {pages.map(page => (
                  <option key={page} value={page}>{page.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}

          {loading ? (
            <div className="text-center">Loading...</div>
          ) : selectedPage ? (
            <div className="bg-white p-2 md:p-4 rounded shadow">
              <h2 className="text-sm md:text-lg font-semibold mb-4">{selectedPage.toUpperCase()} Permissions</h2>
              
              {/* Desktop View */}
              {!isMobile ? (
                <>
                  {/* Page Access */}
                  <div className="mb-6">
                    <h3 className="font-medium mb-2">Page Access</h3>
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 text-left border">Role</th>
                          <th className="p-2 text-center border">Can Access Page</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map(role => {
                          const perm = permissions.find(p => p.role === role && p.page === selectedPage)
                          const hasAccess = perm?.can_access || false
                          
                          return (
                            <tr key={role}>
                              <td className="p-2 border capitalize">{role}</td>
                              <td className="p-2 text-center border">
                                <input
                                  type="checkbox"
                                  checked={hasAccess}
                                  onChange={() => togglePageAccess(role, selectedPage)}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Column Access */}
                  <div>
                    <h3 className="font-medium mb-2">Column Access</h3>
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 text-left border">Column</th>
                          {roles.map(role => (
                            <th key={role} className="p-2 text-center border capitalize">{role}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageColumns[selectedPage as keyof typeof pageColumns]?.map(column => (
                          <tr key={column}>
                            <td className="p-2 border font-medium">{column}</td>
                            {roles.map(role => {
                              const pageAccess = canAccessPage(role, selectedPage)
                              const columnAccess = hasColumnAccess(role, selectedPage, column)
                              
                              return (
                                <td key={role} className="p-2 text-center border">
                                  <input
                                    type="checkbox"
                                    checked={columnAccess}
                                    disabled={!pageAccess}
                                    onChange={() => toggleColumnAccess(role, selectedPage, column)}
                                    className={!pageAccess ? 'opacity-50 cursor-not-allowed' : ''}
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
                      {roles.map(role => {
                        const perm = permissions.find(p => p.role === role && p.page === selectedPage)
                        const hasAccess = perm?.can_access || false
                        
                        return (
                          <div key={role} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                            <span className="capitalize font-medium text-sm">{role}</span>
                            <input
                              type="checkbox"
                              checked={hasAccess}
                              onChange={() => togglePageAccess(role, selectedPage)}
                              className="w-5 h-5"
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
                      {pageColumns[selectedPage as keyof typeof pageColumns]?.map(column => (
                        <div key={column} className="bg-gray-50 rounded p-3">
                          <h4 className="font-medium text-sm mb-2">{column}</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {roles.map(role => {
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
                                  />
                                </div>
                              )
                            })}
                          </div>
                          {roles.some(role => !canAccessPage(role, selectedPage)) && (
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
                    className="bg-blue-600 text-white px-4 py-2 rounded-md"
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