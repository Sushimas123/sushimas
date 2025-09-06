// Column permissions berdasarkan role
export const COLUMN_PERMISSIONS = {
  // ESB Report columns
  esb: {
    admin: ['*'], // semua kolom
    manager: ['*'], // semua kolom
    pic_branch: ['sales_date', 'branch', 'product', 'sub_category', 'quantity', 'price'], // tanpa value_total
    staff: ['sales_date', 'branch', 'product', 'sub_category', 'quantity'] // tanpa price dan value_total
  },
  
  // Users table columns
  users: {
    admin: ['*'], // semua kolom
    manager: ['email', 'nama_lengkap', 'no_telp', 'role', 'cabang', 'created_at'], // tanpa password dan actions
    pic_branch: ['email', 'nama_lengkap', 'no_telp', 'cabang'], // hanya info dasar
    staff: [] // tidak bisa akses
  },
  
  // Ready stock columns
  ready: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['product_name', 'category', 'quantity', 'unit', 'branch', 'last_updated'],
    staff: ['product_name', 'category', 'quantity', 'unit', 'branch']
  },
  
  // Production columns
  produksi: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['product_name', 'quantity', 'status', 'branch', 'created_at'],
    staff: []
  }
}

// Function to check if user can see a column
export const canViewColumn = (userRole: string, tableName: string, columnName: string): boolean => {
  const permissions = COLUMN_PERMISSIONS[tableName as keyof typeof COLUMN_PERMISSIONS]
  if (!permissions) return true // jika tidak ada aturan, tampilkan semua
  
  const rolePermissions = permissions[userRole as keyof typeof permissions]
  if (!rolePermissions) return false // jika role tidak ada, sembunyikan semua
  
  // Jika ada wildcard (*), tampilkan semua kolom
  if (rolePermissions.includes('*')) return true
  
  // Check specific column permission
  return rolePermissions.includes(columnName)
}

// Function to filter columns based on role
export const filterColumnsByRole = (userRole: string, tableName: string, columns: string[]): string[] => {
  return columns.filter(column => canViewColumn(userRole, tableName, column))
}

// Function to get hidden columns for a role
export const getHiddenColumns = (userRole: string, tableName: string, allColumns: string[]): string[] => {
  return allColumns.filter(column => !canViewColumn(userRole, tableName, column))
}