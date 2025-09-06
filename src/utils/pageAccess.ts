// This file is deprecated - use dbPermissions.ts instead

// Mapping halaman ke table permissions
const PAGE_TABLE_MAPPING = {
  '/esb': 'esb',
  '/ready': 'ready',
  '/users': 'users',
  '/produksi': 'produksi',
  '/analysis': 'analysis',
  '/branches': 'branches',
  '/categories': 'categories',
  '/gudang': 'gudang',
  '/product_name': 'product_name',
  '/product_settings': 'product_settings',
  '/produksi_detail': 'produksi_detail',
  '/recipes': 'recipes',
  '/stock_opname': 'stock_opname',
  '/supplier': 'supplier',
  '/permissions': 'permissions' // special case - only admin
}

// DEPRECATED: Use dbPermissions.ts instead
export const canAccessPage = (userRole: string, pagePath: string): boolean => {
  console.warn('pageAccess.ts is deprecated. Use dbPermissions.ts instead.')
  return false
}

// DEPRECATED: Use dbPermissions.ts instead
export const getAccessiblePages = (userRole: string): string[] => {
  console.warn('pageAccess.ts is deprecated. Use dbPermissions.ts instead.')
  return []
}

export const hasTableAccess = (userRole: string, tableName: string): boolean => {
  console.warn('pageAccess.ts is deprecated. Use dbPermissions.ts instead.')
  return false
}