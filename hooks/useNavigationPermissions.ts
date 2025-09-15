import { useState, useEffect } from 'react'
import { checkPageAccess } from '@/src/utils/pagePermissions'

export const useNavigationPermissions = () => {
  const [userRole, setUserRole] = useState<string>('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAllPermissions = async () => {
      const userData = localStorage.getItem('user')
      if (!userData) {
        setLoading(false)
        return
      }

      try {
        const user = JSON.parse(userData)
        setUserRole(user.role)

        // Daftar semua page yang ada di menu
        const pageNames = [
          'dashboard',
          'ready', 
          'stock_opname_batch',
          'produksi',
          'produksi_detail',
          'analysis',
          'gudang',
          'esb',
          'branches',
          'users',
          'categories',
          'product_name',
          'recipes',
          'supplier',
          'pivot',
          'permissions-db',
          'purchaseorder',
          'barang_masuk',
          'transfer_barang',
          'product_settings',
          'crud_permissions',
          'audit_log',
          'price_history'
        ]

        const permissionChecks = await Promise.all(
          pageNames.map(async (pageName) => ({
            [pageName]: await checkPageAccess(user.role, pageName)
          }))
        )

        const permissionsMap = permissionChecks.reduce((acc, curr) => ({...acc, ...curr}), {})
        setPermissions(permissionsMap)
      } catch (error) {
        console.error('Error checking permissions:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAllPermissions()
  }, [])

  return { userRole, permissions, loading }
}