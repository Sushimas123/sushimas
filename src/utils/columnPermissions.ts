// Column permissions berdasarkan role
export const COLUMN_PERMISSIONS = {
  // ESB Report columns
  esb: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['sales_date', 'branch', 'product', 'sub_category', 'quantity', 'price'],
    staff: []
  },
  
  // Users table columns
  users: {
    admin: ['*'],
    manager: ['email', 'nama_lengkap', 'no_telp', 'role', 'cabang', 'created_at'],
    pic_branch: ['email', 'nama_lengkap', 'no_telp', 'cabang'],
    staff: []
  },
  
  // Ready stock columns
  ready: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['ready_no', 'tanggal_input', 'branch', 'category', 'product_name', 'product_id', 'quantity', 'waste'],
    staff: ['product_name', 'quantity']
  },
  
  // Production columns
  produksi: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['product_name', 'quantity', 'status', 'branch', 'created_at'],
    staff: []
  },
  
  // Analysis columns
  analysis: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['product_name', 'branch', 'status', 'date'],
    staff: []
  },
  
  // Branches columns
  branches: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['nama_branch', 'alamat', 'kota'],
    staff: ['nama_branch']
  },
  
  // Categories columns
  categories: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['category_name', 'description'],
    staff: ['category_name']
  },
  
  // Gudang columns
  gudang: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['product_name', 'quantity', 'location', 'branch'],
    staff: ['product_name', 'quantity', 'branch']
  },
  
  // Product Name columns
  product_name: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['product_name', 'category', 'unit', 'price'],
    staff: ['product_name', 'category', 'unit']
  },
  
  // Product Settings columns
  product_settings: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: [],
    staff: []
  },
  
  // Production Detail columns
  produksi_detail: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: [],
    staff: []
  },
  
  // Recipes columns
  recipes: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['recipe_name', 'ingredients', 'quantity'],
    staff: ['recipe_name', 'ingredients']
  },
  
  // Stock Opname columns
  stock_opname: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['product_name', 'system_qty', 'actual_qty', 'difference', 'branch'],
    staff: []
  },
  
  // Supplier columns
  supplier: {
    admin: ['*'],
    manager: ['*'],
    pic_branch: ['supplier_name', 'contact', 'address'],
    staff: ['supplier_name']
  }
}

// Function to check if user can see a column
export const canViewColumn = (userRole: string, tableName: string, columnName: string): boolean => {
  // Check for custom permissions first (only in browser)
  let customPerms = null
  if (typeof window !== 'undefined') {
    customPerms = localStorage.getItem('customPermissions')
  }
  const permissions = customPerms ? JSON.parse(customPerms) : COLUMN_PERMISSIONS
  
  const tablePermissions = permissions[tableName as keyof typeof permissions]
  if (!tablePermissions) return true // jika tidak ada aturan, tampilkan semua
  
  const rolePermissions = tablePermissions[userRole as keyof typeof tablePermissions]
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