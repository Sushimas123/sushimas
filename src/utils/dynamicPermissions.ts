import { supabase } from '@/src/lib/supabaseClient'

// Cache untuk permissions
let permissionsCache: { [key: string]: any } = {}
let cacheExpiry = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Request deduplication
let ongoingRequests: { [key: string]: Promise<any> } = {}

// Function to get page permissions from database
export const getPagePermissions = async (userRole: string): Promise<string[]> => {
  const cacheKey = `page_permissions_${userRole}`
  const now = Date.now()
  
  // Return cached data if still valid
  if (permissionsCache[cacheKey] && now < cacheExpiry) {
    return permissionsCache[cacheKey]
  }
  
  // Return ongoing request if exists
  if (ongoingRequests[cacheKey]) {
    return ongoingRequests[cacheKey]
  }
  
  // Create and store the request promise
  ongoingRequests[cacheKey] = (async () => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('page')
        .eq('role', userRole)
        .eq('can_access', true)
      
      if (error) throw error
      
      const pages = data?.map(item => item.page) || []
      
      // Cache the result
      permissionsCache[cacheKey] = pages
      cacheExpiry = now + CACHE_DURATION
      
      return pages
    } catch (error) {
      console.error('Error fetching page permissions:', error)
      const fallback = getDefaultPagePermissions(userRole)
      permissionsCache[cacheKey] = fallback
      cacheExpiry = now + CACHE_DURATION
      return fallback
    } finally {
      // Clean up ongoing request
      delete ongoingRequests[cacheKey]
    }
  })()
  
  return ongoingRequests[cacheKey]
}

// Function to get CRUD permissions from database
export const getCrudPermissions = async (userRole: string): Promise<{ [key: string]: { create: boolean, edit: boolean, delete: boolean } }> => {
  const cacheKey = `crud_permissions_${userRole}`
  const now = Date.now()
  
  // Return cached data if still valid
  if (permissionsCache[cacheKey] && now < cacheExpiry) {
    return permissionsCache[cacheKey]
  }
  
  try {
    const { data, error } = await supabase
      .from('crud_permissions')
      .select('page, can_create, can_edit, can_delete')
      .eq('role', userRole)
    
    if (error) throw error
    
    const permissions: { [key: string]: { create: boolean, edit: boolean, delete: boolean } } = {}
    
    data?.forEach(item => {
      permissions[item.page] = {
        create: item.can_create,
        edit: item.can_edit,
        delete: item.can_delete
      }
    })
    
    // Cache the result
    permissionsCache[cacheKey] = permissions
    cacheExpiry = now + CACHE_DURATION
    
    return permissions
  } catch (error) {
    console.error('Error fetching CRUD permissions:', error)
    return getDefaultCrudPermissions(userRole)
  }
}

// Default fallback permissions
const getDefaultPagePermissions = (userRole: string): string[] => {
  switch (userRole) {
    case 'super admin':
      return ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'branches', 'categories', 'gudang-final', 'product_name', 'product_settings', 'produksi_detail', 'recipes', 'stock_opname_batch', 'supplier', 'permissions-db', 'audit-log', 'crud-permissions', 'pivot', 'price-history', 'purchaseorder', 'barang_masuk', 'stock-alert', 'transfer-barang', 'assets']
    case 'admin':
      return ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'branches', 'categories', 'gudang-final', 'product_name', 'product_settings', 'produksi_detail', 'recipes', 'stock_opname_batch', 'supplier', 'audit-log', 'crud-permissions', 'pivot', 'price-history', 'purchaseorder', 'barang_masuk', 'stock-alert', 'transfer_barang', 'transfer-barang', 'assets', 'finance', 'aging-report', 'pettycash']
    case 'finance':
      return ['dashboard', 'esb', 'ready', 'users', 'produksi', 'analysis', 'gudang-final', 'product_settings', 'produksi_detail', 'stock_opname_batch']
    case 'pic_branch':
      return ['dashboard', 'esb', 'ready', 'produksi', 'analysis', 'gudang-final', 'stock_opname_batch', 'produksi_detail', 'assets']
    case 'staff':
      return ['dashboard', 'esb', 'ready', 'produksi', 'gudang-final', 'stock_opname_batch', 'assets']
    default:
      return ['dashboard']
  }
}

const getDefaultCrudPermissions = (userRole: string): { [key: string]: { create: boolean, edit: boolean, delete: boolean } } => {
  switch (userRole) {
    case 'super admin':
    case 'admin':
      return { '*': { create: true, edit: true, delete: true } }
    case 'finance':
      return { '*': { create: false, edit: false, delete: false } }
    case 'pic_branch':
      return { '*': { create: true, edit: true, delete: false } }
    case 'staff':
      return { '*': { create: true, edit: false, delete: false } }
    default:
      return { '*': { create: false, edit: false, delete: false } }
  }
}

// Clear permissions cache
export const clearPermissionsCache = () => {
  permissionsCache = {}
  cacheExpiry = 0
}

// Check if user can access page (async version)
export const canAccessPageAsync = async (userRole: string, pageName: string): Promise<boolean> => {
  if (userRole === 'super admin') return true
  if (pageName === 'dashboard') return true
  
  const allowedPages = await getPagePermissions(userRole)
  return allowedPages.includes(pageName)
}

// Check CRUD permission (async version)
export const canPerformCrudAsync = async (userRole: string, pageName: string, action: 'create' | 'edit' | 'delete'): Promise<boolean> => {
  if (userRole === 'super admin' || userRole === 'admin') return true
  
  const crudPermissions = await getCrudPermissions(userRole)
  const pagePerms = crudPermissions[pageName] || crudPermissions['*']
  
  if (!pagePerms) return false
  
  return pagePerms[action]
}