"use client"
import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { COLUMN_PERMISSIONS } from '@/src/utils/columnPermissions'

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState(COLUMN_PERMISSIONS)
  const [userRole, setUserRole] = useState('')

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role)
    }
  }, [])

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

  const handlePermissionChange = (table: string, role: string, column: string, checked: boolean) => {
    setPermissions(prev => {
      const newPerms = { ...prev }
      const tablePerms = { ...newPerms[table as keyof typeof newPerms] }
      const rolePerms = [...(tablePerms[role as keyof typeof tablePerms] as string[])]
      
      if (checked) {
        if (!rolePerms.includes(column)) {
          rolePerms.push(column)
        }
      } else {
        const index = rolePerms.indexOf(column)
        if (index > -1) {
          rolePerms.splice(index, 1)
        }
      }
      
      tablePerms[role as keyof typeof tablePerms] = rolePerms as any
      newPerms[table as keyof typeof newPerms] = tablePerms as any
      return newPerms
    })
  }

  const savePermissions = () => {
    // Save to localStorage for now (in production, save to database)
    localStorage.setItem('customPermissions', JSON.stringify(permissions))
    alert('Permissions saved! (Restart app to apply changes)')
  }

  const roles = ['admin', 'manager', 'pic_branch', 'staff']
  const tables = Object.keys(permissions)

  // Sample columns for each table
  const tableColumns = {
    esb: ['sales_date', 'branch', 'product', 'sub_category', 'quantity', 'price', 'value_total'],
    users: ['email', 'nama_lengkap', 'no_telp', 'role', 'cabang', 'created_at'],
    ready: ['product_name', 'category', 'quantity', 'unit', 'branch', 'last_updated'],
    produksi: ['product_name', 'quantity', 'status', 'branch', 'created_at'],
    analysis: ['product_name', 'branch', 'status', 'date', 'variance', 'notes'],
    branches: ['nama_branch', 'kode_branch', 'alamat', 'kota', 'provinsi', 'manager'],
    categories: ['category_name', 'description', 'parent_category', 'is_active'],
    gudang: ['product_name', 'quantity', 'location', 'branch', 'last_update', 'min_stock'],
    product_name: ['product_name', 'category', 'unit', 'price', 'description', 'is_active'],
    product_settings: ['setting_name', 'value', 'description', 'category', 'is_active'],
    produksi_detail: ['batch_no', 'product_name', 'quantity', 'status', 'start_time', 'end_time'],
    recipes: ['recipe_name', 'ingredients', 'quantity', 'unit', 'instructions', 'prep_time'],
    stock_opname: ['product_name', 'system_qty', 'actual_qty', 'difference', 'branch', 'date'],
    supplier: ['supplier_name', 'contact', 'address', 'phone', 'email', 'payment_terms']
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">🔐 Role Permissions Manager</h1>
          <button
            onClick={savePermissions}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Save Changes
          </button>
        </div>

        <div className="space-y-8">
          {tables.map(table => (
            <div key={table} className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4 capitalize">{table} Table</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left p-2 font-medium">Column</th>
                      {roles.map(role => (
                        <th key={role} className="text-center p-2 font-medium capitalize">
                          {role}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableColumns[table as keyof typeof tableColumns]?.map(column => (
                      <tr key={column} className="border-t">
                        <td className="p-2 font-medium">{column}</td>
                        {roles.map(role => {
                          const rolePerms = permissions[table as keyof typeof permissions]?.[role as keyof any] as string[]
                          const hasWildcard = rolePerms?.includes('*')
                          const hasColumn = rolePerms?.includes(column)
                          const isChecked = hasWildcard || hasColumn
                          
                          return (
                            <td key={role} className="text-center p-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={hasWildcard}
                                onChange={(e) => handlePermissionChange(table, role, column, e.target.checked)}
                                className="w-4 h-4"
                              />
                              {hasWildcard && <span className="text-xs text-green-600 block">All</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    
                    {/* Wildcard row */}
                    <tr className="border-t bg-gray-50">
                      <td className="p-2 font-medium text-green-600">* (All Columns)</td>
                      {roles.map(role => {
                        const rolePerms = permissions[table as keyof typeof permissions]?.[role as keyof any] as string[]
                        const hasWildcard = rolePerms?.includes('*')
                        
                        return (
                          <td key={role} className="text-center p-2">
                            <input
                              type="checkbox"
                              checked={hasWildcard}
                              onChange={(e) => {
                                setPermissions(prev => {
                                  const newPerms = { ...prev }
                                  const tablePerms = { ...newPerms[table as keyof typeof newPerms] }
                                  
                                  if (e.target.checked) {
                                    tablePerms[role as keyof typeof tablePerms] = ['*'] as any
                                  } else {
                                    tablePerms[role as keyof typeof tablePerms] = [] as any
                                  }
                                  
                                  newPerms[table as keyof typeof newPerms] = tablePerms as any
                                  return newPerms
                                })
                              }}
                              className="w-4 h-4"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Instructions:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Check boxes to allow access to specific columns</li>
            <li>• "*" checkbox gives access to ALL columns in that table</li>
            <li>• Unchecked = no access to that column</li>
            <li>• Changes are saved locally (restart app to apply)</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}