import { useState, useEffect } from 'react'
import { getPagePermissions } from '@/src/utils/dynamicPermissions'

export const useNavigationPermissions = () => {
  const [userRole, setUserRole] = useState<string>('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPermissions = async () => {
      const userData = localStorage.getItem('user')
      if (!userData) {
        setLoading(false)
        return
      }

      try {
        const user = JSON.parse(userData)
        setUserRole(user.role)

        // Try to get permissions from database first
        try {
          const allowedPages = await getPagePermissions(user.role)
          const userPermissions: Record<string, boolean> = {}
          
          // Convert page list to permission object
          const allPossiblePages = [
            'dashboard', 'ready', 'stock_opname_batch', 'produksi', 'produksi_detail',
            'analysis', 'audit-log', 'barang_masuk', 'branches', 'categories',
            'crud-permissions', 'esb', 'gudang', 'permissions-db', 'pivot',
            'price-history', 'product_name', 'product_settings', 'recipes',
            'purchaseorder', 'stock-alert', 'supplier', 'transfer_barang', 'users'
          ]
          
          allPossiblePages.forEach(page => {
            userPermissions[page] = allowedPages.includes(page)
          })
          
          setPermissions(userPermissions)
          setLoading(false)
          return
        } catch (dbError) {
          console.warn('Failed to load permissions from database, using fallback:', dbError)
        }

        // Fallback to hardcoded permissions
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
            'audit-log': true,
            barang_masuk: true,
            branches: true,
            categories: true,
            'crud-permissions': true,
            esb: true,
            gudang: true,
            'permissions-db': true,
            pivot: true,
            'price-history': true,
            product_name: true,
            product_settings: true,
            recipes: true,
            purchaseorder: true,
            'stock-alert': true,
            supplier: true,
            transfer_barang: true,
            users: true
          }
        } else if (user.role === 'admin') {
          // Admin has access to most things including audit and crud permissions
          userPermissions = {
            dashboard: true,
            ready: true,
            stock_opname_batch: true,
            produksi: true,
            produksi_detail: true,
            analysis: true,
            'audit-log': true,
            barang_masuk: true,
            branches: true,
            categories: true,
            'crud-permissions': true,
            esb: true,
            gudang: true,
            'permissions-db': false,
            pivot: true,
            'price-history': true,
            product_name: true,
            product_settings: true,
            recipes: true,
            purchaseorder: true,
            'stock-alert': true,
            supplier: true,
            transfer_barang: true,
            users: true
          }
        } else if (user.role === 'finance') {
          // Finance role permissions
          userPermissions = {
            dashboard: true,
            ready: true,
            stock_opname_batch: true,
            produksi: true,
            produksi_detail: true,
            analysis: true,
            'audit-log': false,
            barang_masuk: false,
            branches: false,
            categories: false,
            'crud-permissions': false,
            esb: true,
            gudang: true,
            'permissions-db': false,
            pivot: false,
            'price-history': false,
            product_name: false,
            product_settings: true,
            recipes: false,
            purchaseorder: false,
            'stock-alert': false,
            supplier: false,
            transfer_barang: false,
            users: true
          }
        } else if (user.role === 'pic_branch') {
          // PIC Branch role permissions
          userPermissions = {
            dashboard: true,
            ready: true,
            stock_opname_batch: true,
            produksi: true,
            produksi_detail: true,
            analysis: true,
            'audit-log': false,
            barang_masuk: false,
            branches: false,
            categories: false,
            'crud-permissions': false,
            esb: true,
            gudang: true,
            'permissions-db': false,
            pivot: false,
            'price-history': false,
            product_name: false,
            product_settings: false,
            recipes: false,
            purchaseorder: false,
            'stock-alert': false,
            supplier: false,
            transfer_barang: false,
            users: false
          }
        } else if (user.role === 'staff') {
          // Staff role permissions
          userPermissions = {
            dashboard: true,
            ready: true,
            stock_opname_batch: true,
            produksi: true,
            produksi_detail: false,
            analysis: false,
            'audit-log': false,
            barang_masuk: false,
            branches: false,
            categories: false,
            'crud-permissions': false,
            esb: true,
            gudang: true,
            'permissions-db': false,
            pivot: false,
            'price-history': false,
            product_name: false,
            product_settings: false,
            recipes: false,
            purchaseorder: false,
            'stock-alert': false,
            supplier: false,
            transfer_barang: false,
            users: false
          }
        } else {
          // Default permissions for unknown roles
          userPermissions = {
            dashboard: true,
            ready: false,
            stock_opname_batch: false,
            produksi: false,
            produksi_detail: false,
            analysis: false,
            'audit-log': false,
            barang_masuk: false,
            branches: false,
            categories: false,
            'crud-permissions': false,
            esb: false,
            gudang: false,
            'permissions-db': false,
            pivot: false,
            'price-history': false,
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