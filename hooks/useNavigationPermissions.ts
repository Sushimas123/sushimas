import { useState, useEffect } from 'react'

export const useNavigationPermissions = () => {
  const [userRole, setUserRole] = useState<string>('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPermissions = () => {
      const userData = localStorage.getItem('user')
      if (!userData) {
        setLoading(false)
        return
      }

      try {
        const user = JSON.parse(userData)
        setUserRole(user.role)

        // Set permissions based on role
        let userPermissions = {}
        
        if (user.role === 'super admin') {
          // Super admin has access to everything
          userPermissions = {
            dashboard: true,
            ready: true,
            stock_opname_batch: true,
            produksi: true,
            produksi_detail: true,
            analysis: true,
            audit_log: true,
            barang_masuk: true,
            branches: true,
            categories: true,
            crud_permissions: true,
            esb: true,
            gudang: true,
            'permissions-db': true,
            pivot: true,
            price_history: true,
            product_name: true,
            product_settings: true,
            recipes: true,
            purchaseorder: true,
            'stock-alert': true,
            supplier: true,
            transfer_barang: true,
            users: true
          }
        } else if (user.role === 'pic_branch') {
          // Use the permissions for pic_branch role
          userPermissions = {
            dashboard: false,
            ready: true,
            stock_opname_batch: false,
            produksi: true,
            produksi_detail: true,
            analysis: false,
            audit_log: false,
            barang_masuk: false,
            branches: false,
            categories: false,
            crud_permissions: false,
            esb: false,
            gudang: true,
            'permissions-db': false,
            pivot: true,
            price_history: false,
            product_name: false,
            product_settings: false,
            recipes: false,
            purchaseorder: true,
            'stock-alert': true,
            supplier: false,
            transfer_barang: false,
            users: false
          }
        } else {
          // Default permissions for other roles
          userPermissions = {
            dashboard: true,
            ready: false,
            stock_opname_batch: false,
            produksi: false,
            produksi_detail: false,
            analysis: false,
            audit_log: false,
            barang_masuk: false,
            branches: false,
            categories: false,
            crud_permissions: false,
            esb: false,
            gudang: false,
            'permissions-db': false,
            pivot: false,
            price_history: false,
            product_name: false,
            product_settings: false,
            recipes: false,
            purchaseorder: false,
            'stock-alert': false,
            supplier: false,
            transfer_barang: false,
            users: false
          }
        }

        setPermissions(userPermissions)
      } catch (error) {
        console.error('Error loading permissions:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [])

  return { userRole, permissions, loading }
}