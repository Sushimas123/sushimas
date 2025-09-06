"use client"
import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '@/src/lib/supabaseClient'

export default function PermissionsDBPage() {
  const [permissions, setPermissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')

  const roles = ['admin', 'manager', 'pic_branch', 'staff']
  const pages = ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'branches', 'categories', 'gudang', 'product_name', 'product_settings', 'produksi_detail', 'recipes', 'stock_opname', 'supplier']

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
          columns: ['*'],
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

  if (userRole !== 'admin') {
    return (
      <Layout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p>Only admin can access permissions settings</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">🔐 Database Permissions</h1>
        
        {loading ? (
          <div className="text-center">Loading...</div>
        ) : (
          <div className="space-y-6">
            {pages.map(page => (
              <div key={page} className="bg-white p-4 rounded shadow">
                <h2 className="text-lg font-semibold mb-4 capitalize">{page}</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Role</th>
                      <th className="p-2">Access</th>
                      <th className="p-2">Can Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map(role => {
                      const perm = permissions.find(p => p.role === role && p.page === page)
                      const hasAccess = perm?.can_access || false
                      
                      return (
                        <tr key={role} className="border-t">
                          <td className="p-2 capitalize">{role}</td>
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={hasAccess}
                              onChange={() => togglePageAccess(role, page)}
                            />
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${
                              hasAccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {hasAccess ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-6 p-4 bg-blue-50 rounded">
          <p className="text-sm text-blue-700">
            Database-based permissions: Changes are saved immediately to Supabase.
            Run the SQL script first to create the permissions table.
          </p>
        </div>
      </div>
    </Layout>
  )
}