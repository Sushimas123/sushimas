// Template untuk menerapkan sistem permission ke semua halaman
// Gunakan ini sebagai panduan untuk update halaman lain

// 1. Import yang diperlukan (tambahkan di bagian atas file):
import { canViewColumn } from '@/src/utils/dbPermissions'

// 2. State untuk column management (tambahkan ke state):
const [showColumnSelector, setShowColumnSelector] = useState(false)
const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
const [permittedColumns, setPermittedColumns] = useState<string[]>([])

// 3. Load permitted columns (tambahkan useEffect):
useEffect(() => {
  const loadPermittedColumns = async () => {
    if (data.length > 0) {
      const allColumns = Object.keys(data[0])
      const permitted = []
      
      for (const col of allColumns) {
        const hasPermission = await canViewColumn(userRole, 'PAGE_NAME', col) // Ganti PAGE_NAME
        if (hasPermission) {
          permitted.push(col)
        }
      }
      
      setPermittedColumns(permitted)
    }
  }
  
  loadPermittedColumns()
}, [data, userRole])

// 4. Visible columns (tambahkan computed value):
const visibleColumns = permittedColumns.filter(col => !hiddenColumns.includes(col))

// 5. Toggle column function:
const toggleColumn = async (col: string) => {
  const hasPermission = await canViewColumn(userRole, 'PAGE_NAME', col) // Ganti PAGE_NAME
  if (!hasPermission) {
    showToast(`You don't have permission to view ${col} column`, 'error')
    return
  }
  
  setHiddenColumns(prev =>
    prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
  )
}

// 6. Button untuk column selector (tambahkan ke toolbar):
<button
  onClick={() => setShowColumnSelector(!showColumnSelector)}
  className="bg-purple-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
>
  <Settings size={12} />
  {showColumnSelector ? 'Hide Columns' : 'Show Columns'}
</button>

// 7. Column Selector Component (tambahkan sebelum table):
{showColumnSelector && data.length > 0 && (
  <div className="bg-white p-4 rounded shadow mb-4">
    <h3 className="font-medium mb-2">Column Access</h3>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-2">
      {Object.keys(data[0]).map(col => {
        const hasPermission = permittedColumns.includes(col)
        return (
          <label key={col} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!hiddenColumns.includes(col) && hasPermission}
              disabled={!hasPermission}
              onChange={() => toggleColumn(col)}
              className="rounded text-blue-600"
            />
            <span className={hiddenColumns.includes(col) || !hasPermission ? 'text-gray-500' : 'text-gray-800'}>
              {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              {!hasPermission && <span className="text-red-500 text-xs ml-1">(No Access)</span>}
            </span>
          </label>
        )
      })}
    </div>
    <div className="flex gap-2">
      <button
        onClick={() => setHiddenColumns([])}
        className="px-3 py-1 bg-green-600 text-white rounded text-sm"
      >
        Show All Permitted
      </button>
      <button
        onClick={() => setHiddenColumns(permittedColumns)}
        className="px-3 py-1 bg-red-600 text-white rounded text-sm"
      >
        Hide All Permitted
      </button>
    </div>
  </div>
)}

// 8. Update table headers (ganti kondisi):
// DARI:
{!hiddenColumns.includes('column_name') && <th>Column Name</th>}

// MENJADI:
{visibleColumns.includes('column_name') && <th>Column Name</th>}

// 9. Update table body (ganti kondisi):
// DARI:
{!hiddenColumns.includes('column_name') && <td>{item.column_name}</td>}

// MENJADI:
{visibleColumns.includes('column_name') && <td>{item.column_name}</td>}

// 10. Export function update (gunakan visibleColumns):
const exportCSV = () => {
  if (data.length === 0) return
  
  const header = visibleColumns.map(col => col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(",")
  const rows = data.map(row =>
    visibleColumns.map(col => `"${row[col] ?? ""}"`).join(",")
  )
  const csvContent = [header, ...rows].join("\n")
  
  // ... rest of export logic
}

// HALAMAN YANG PERLU DIUPDATE:
// - /app/produksi/page.tsx
// - /app/produksi_detail/page.tsx  
// - /app/gudang/page.tsx
// - /app/stock_opname_batch/page.tsx
// - /app/analysis/page.tsx
// - /app/product_name/page.tsx
// - /app/categories/page.tsx
// - /app/recipes/page.tsx
// - /app/supplier/page.tsx
// - /app/branches/page.tsx
// - /app/users/page.tsx

// MAPPING KOLOM UNTUK SETIAP HALAMAN (sesuaikan dengan permissions-db):
const PAGE_COLUMN_MAPPING = {
  'ready': ['ready_no', 'tanggal_input', 'branch', 'category', 'product_name', 'quantity', 'unit'],
  'produksi': ['tanggal_produksi', 'product_name', 'quantity', 'status', 'branch', 'notes'],
  'gudang': ['tanggal_input', 'product_name', 'quantity', 'location', 'branch', 'type'],
  'stock_opname_batch': ['tanggal_opname', 'product_name', 'system_qty', 'actual_qty', 'difference', 'branch'],
  'analysis': ['date', 'branch', 'product', 'ready_stock', 'production', 'consumption', 'balance'],
  'users': ['email', 'nama_lengkap', 'no_telp', 'role', 'cabang', 'created_at'],
  'branches': ['nama_branch', 'kode_branch', 'alamat', 'kota', 'provinsi', 'is_active'],
  'categories': ['category_name', 'description', 'is_active', 'created_at'],
  'product_name': ['product_name', 'category', 'sub_category', 'unit', 'price', 'is_active'],
  'recipes': ['recipe_name', 'ingredients', 'quantity', 'unit', 'instructions'],
  'supplier': ['supplier_name', 'contact_person', 'phone', 'email', 'address', 'is_active']
}