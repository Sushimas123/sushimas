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
      return {}
    }
    
    // Convert to object format for easy access
    const permissions: { [key: string]: string[] } = {}
    data?.forEach(perm => {
      permissions[perm.page] = perm.columns || []
    })
    
    // Cache the result
    permissionsCache[cacheKey] = permissions
    cacheExpiry = now + (5 * 60 * 1000) // 5 minutes
    
    return permissions
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return {}
  }
}

// Function to check if user can access a page
export const canAccessPage = async (userRole: string, pagePath: string): Promise<boolean> => {
  // Special cases
  if (pagePath === '/permissions') return userRole === 'admin'
  if (pagePath === '/dashboard' || pagePath === '/') return true
  
  // Remove leading slash and get page name
  const pageName = pagePath.replace('/', '')
  
  const permissions = await getPermissions(userRole)
  return !!permissions[pageName]
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