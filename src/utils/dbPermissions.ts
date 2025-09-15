import { supabase } from '@/src/lib/supabaseClient'

// Cache untuk permissions agar tidak query database terus-menerus
let permissionsCache: { [key: string]: any } = {}
let cacheExpiry = 0

// Function to get permissions from database with caching
export const getPermissions = async (userRole: string): Promise<any> => {
  const cacheKey = `permissions_${userRole}`
  const now = Date.now()
  
  // Return cached data if still valid (5 minutes cache)
  if (permissionsCache[cacheKey] && now < cacheExpiry) {
    return permissionsCache[cacheKey]
  }
  
  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('role', userRole)
      .eq('can_access', true)
    
    if (error) {
      console.error('Error fetching permissions:', error)
      return getDefaultPermissions(userRole)
    }
    
    // Convert to object format for easy access
    const permissions: { [key: string]: string[] } = {}
    data?.forEach(perm => {
      permissions[perm.page] = perm.columns || []
    })
    
    // If no permissions found, use defaults
    if (Object.keys(permissions).length === 0) {
      return getDefaultPermissions(userRole)
    }
    
    // Cache the result
    permissionsCache[cacheKey] = permissions
    cacheExpiry = now + (5 * 60 * 1000) // 5 minutes
    
    return permissions
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return getDefaultPermissions(userRole)
  }
}

// Default permissions fallback
const getDefaultPermissions = (userRole: string) => {
  const permissions: { [key: string]: string[] } = {}
  
  if (userRole === 'super admin') {
    // Super admin gets access to all pages
    const allPages = ['ready', 'produksi', 'produksi_detail', 'gudang', 'analysis', 'product_settings', 'stock_opname_batch', 'esb', 'product_name', 'categories', 'recipes', 'supplier', 'branches', 'users', 'permissions-db', 'crud-permissions', 'audit-log']
    allPages.forEach(page => {
      permissions[page] = ['*'] // Full access
    })
    return permissions
  }
  
  if (userRole === 'admin') {
    const adminPages = ['ready', 'produksi', 'produksi_detail', 'gudang', 'analysis', 'product_settings', 'stock_opname_batch', 'esb', 'product_name', 'categories', 'recipes', 'supplier', 'branches', 'users', 'permissions-db', 'crud-permissions', 'audit-log']
    adminPages.forEach(page => {
      permissions[page] = ['*']
    })
    return permissions
  }
  
  if (userRole === 'finance') {
    const financePages = ['ready', 'produksi', 'produksi_detail', 'gudang', 'analysis', 'stock_opname_batch', 'esb', 'users']
    financePages.forEach(page => {
      permissions[page] = ['*']
    })
    return permissions
  }
  
  if (userRole === 'pic_branch' || userRole === 'pic') {
    const picPages = ['ready', 'produksi', 'gudang', 'stock_opname_batch', 'esb']
    picPages.forEach(page => {
      permissions[page] = ['*']
    })
    return permissions
  }
  
  if (userRole === 'staff') {
    const staffPages = ['ready', 'produksi', 'stock_opname_batch', 'esb']
    staffPages.forEach(page => {
      permissions[page] = ['*']
    })
    return permissions
  }
  
  return {}
}

// Function to check if user can access a page
export const canAccessPage = async (userRole: string, pagePath: string): Promise<boolean> => {
  // Special cases - admin only pages
  if (pagePath === 'permissions-db' || pagePath === 'crud-permissions') {
    return userRole === 'super admin' || userRole === 'admin'
  }
  if (pagePath === 'dashboard' || pagePath === '' || pagePath === '/') return true
  
  // Remove leading slash and get page name
  const pageName = pagePath.replace('/', '')
  
  try {
    const permissions = await getPermissions(userRole)
    return !!permissions[pageName]
  } catch (error) {
    console.error('Error checking page access:', error)
    // Fallback: allow access for basic pages
    const basicPages = ['ready', 'produksi', 'produksi_detail', 'gudang', 'analysis', 'esb']
    return basicPages.includes(pageName)
  }
}

// Function to check if user can view a column
export const canViewColumn = async (userRole: string, tableName: string, columnName: string): Promise<boolean> => {
  const permissions = await getPermissions(userRole)
  const tablePermissions = permissions[tableName]
  
  if (!tablePermissions) return false
  if (tablePermissions.includes('*')) return true
  
  return tablePermissions.includes(columnName)
}

// Function to get visible columns for a table
export const getVisibleColumns = async (userRole: string, tableName: string, allColumns: string[]): Promise<string[]> => {
  const permissions = await getPermissions(userRole)
  const tablePermissions = permissions[tableName]
  
  if (!tablePermissions) return []
  if (tablePermissions.includes('*')) return allColumns
  
  return allColumns.filter(col => tablePermissions.includes(col))
}

// Function to clear permissions cache (call when permissions are updated)
export const clearPermissionsCache = () => {
  permissionsCache = {}
  cacheExpiry = 0
}

// Clear cache immediately on module load to ensure fresh permissions
clearPermissionsCache()

// Function to update permissions in database
export const updatePermissions = async (role: string, page: string, columns: string[], canAccess: boolean = true) => {
  try {
    const { error } = await supabase
      .from('user_permissions')
      .upsert({
        role,
        page,
        columns,
        can_access: canAccess,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'role,page'
      })
    
    if (error) {
      console.error('Error updating permissions:', error)
      return false
    }
    
    // Clear cache after update
    clearPermissionsCache()
    return true
  } catch (error) {
    console.error('Error updating permissions:', error)
    return false
  }
}