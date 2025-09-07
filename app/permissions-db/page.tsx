"use client"
import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '@/src/lib/supabaseClient'

export default function PermissionsDBPage() {
  const [permissions, setPermissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [selectedPage, setSelectedPage] = useState('')

  const roles = ['super admin', 'admin', 'finance', 'pic_branch', 'staff']
  
  const pageColumns = {
    esb: ['sales_date', 'branch', 'product', 'sub_category', 'quantity', 'price', 'total'],
    ready: ['ready_no', 'tanggal_input', 'branch', 'category', 'product_name', 'quantity', 'unit'],
    users: ['email', 'nama_lengkap', 'no_telp', 'role', 'cabang', 'created_at'],
    produksi: ['tanggal_produksi', 'product_name', 'quantity', 'status', 'branch', 'notes'],
    analysis: ['date', 'branch', 'product', 'ready_stock', 'production', 'consumption', 'balance'],
    gudang: ['tanggal_input', 'product_name', 'quantity', 'location', 'branch', 'type'],
    produksi_detail: ['tanggal_produksi', 'item_id', 'quantity_used', 'unit', 'branch'],
    stock_opname: ['tanggal_opname', 'product_name', 'system_qty', 'actual_qty', 'difference', 'branch'],
    branches: ['nama_branch', 'kode_branch', 'alamat', 'kota', 'provinsi', 'is_active'],
    categories: ['category_name', 'description', 'is_active', 'created_at'],
    product_name: ['product_name', 'category', 'sub_category', 'unit', 'price', 'is_active'],
    product_settings: ['setting_name', 'setting_value', 'description', 'updated_at'],
    recipes: ['recipe_name', 'ingredients', 'quantity', 'unit', 'instructions'],
    supplier: ['supplier_name', 'contact_person', 'phone', 'email', 'address', 'is_active']
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
      
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          role,
          page,
          columns: newAccess ? ['*'] : [],
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
    if (!perm || !perm.can_access) return false
    if (perm.columns?.includes('*')) return true
    return perm.columns?.includes(column) || false
  }

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
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">🔐 Column-Level Permissions</h1>
        
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

        {loading ? (
          <div className="text-center">Loading...</div>
        ) : selectedPage ? (
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-lg font-semibold mb-4">{selectedPage.toUpperCase()} Permissions</h2>
            
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
                      {roles.map(role => (
                        <td key={role} className="p-2 text-center border">
                          <input
                            type="checkbox"
                            checked={hasColumnAccess(role, selectedPage, column)}
                            onChange={() => toggleColumnAccess(role, selectedPage, column)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            Please select a page to configure permissions
          </div>
        )}
      </div>
    </Layout>
  )
}