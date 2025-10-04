import { useState, useEffect } from 'react'
import { getPagePermissions } from '@/src/utils/dynamicPermissions'
import { getUserData } from '@/utils/userStorage'

export const useNavigationPermissions = () => {
  const [userRole, setUserRole] = useState<string>('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPermissions = async () => {
      const userData = getUserData()
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
            'crud-permissions', 'esb', 'gudang-final', 'permissions-db', 'pivot',
            'price-history', 'product_name', 'product_settings', 'recipes',
            'purchaseorder', 'stock-alert', 'supplier', 'transfer_barang', 'transfer-barang', 'users',
            'price_history', 'finance', 'aging-report', 'pettycash', 'assets'
          ]
          
          allPossiblePages.forEach(page => {
            // Super admin always gets all permissions
            userPermissions[page] = user.role === 'super admin' ? true : allowedPages.includes(page)
          })
          
          setPermissions(userPermissions)
          setLoading(false)
          return
        } catch (dbError) {

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
            'gudang-final': true,
            'permissions-db': true,
            price_history: true,
            pivot: true,
            'price-history': true,
            product_name: true,
            product_settings: true,
            recipes: true,
            purchaseorder: true,
            'stock-alert': true,
            supplier: true,
            transfer_barang: true,
            users: true,
            finance: true,
            'aging-report': true,
            pettycash: true,
            assets: true,
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
            'gudang-final': true,
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
            'transfer-barang': true,
            users: true,
            finance: true,
            'aging-report': true,
            pettycash: true,
            assets: true,
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
            'gudang-final': true,
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
            users: true,
            finance: true,
            'aging-report': true,
            pettycash: true,
            assets: false,
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
            'gudang-final': true,
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
            users: false,
            pettycash: true,
            assets: true,
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
            'gudang-final': true,
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
            users: false,
            pettycash: true,
            assets: true,
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
            'gudang-final': false,
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
            users: false,
          }
        }

        setPermissions(userPermissions)
      } catch (error) {

      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [])

  return { userRole, permissions, loading }
}