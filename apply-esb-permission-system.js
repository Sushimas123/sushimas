// Script untuk menerapkan sistem permission ESB ke semua halaman
// Jalankan ini untuk setiap halaman yang perlu diupdate

// 1. IMPORTS yang perlu ditambahkan di bagian atas setiap file:
/*
import { canViewColumn } from '@/src/utils/dbPermissions'
import { getBranchFilter } from '@/src/utils/branchAccess'
*/

// 2. STATE yang perlu ditambahkan:
/*
const [permittedColumns, setPermittedColumns] = useState<string[]>([])
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
*/

// 3. FUNCTIONS yang perlu ditambahkan:
/*
const showToast = (message: string, type: 'success' | 'error') => {
  setToast({ message, type })
  setTimeout(() => setToast(null), 3000)
}

// Get columns based on permissions
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

const visibleColumns = permittedColumns.filter(col => !hiddenColumns.includes(col))

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
*/

// 4. TOAST NOTIFICATION (tambahkan setelah <div className="p-1 md:p-2">):
/*
{toast && (
  <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 flex items-center shadow-lg transform transition-all duration-300 ${
    toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
  }`}>
    <span className="mr-2">{toast.type === 'success' ? '✅' : '❌'}</span>
    {toast.message}
  </div>
)}
*/

// 5. COLUMN SELECTOR UPDATE:
/*
{showColumnSelector && data.length > 0 && (
  <div className="bg-white p-4 rounded shadow mb-4">
    <h3 className="font-medium mb-2">Column Access Control</h3>
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
*/

// 6. TABLE HEADERS UPDATE (ganti semua !hiddenColumns.includes dengan visibleColumns.includes):
/*
// DARI:
{!hiddenColumns.includes('column_name') && <th>Column Name</th>}

// MENJADI:
{visibleColumns.includes('column_name') && <th>Column Name</th>}
*/

// 7. TABLE BODY UPDATE (ganti semua !hiddenColumns.includes dengan visibleColumns.includes):
/*
// DARI:
{!hiddenColumns.includes('column_name') && <td>{item.column_name}</td>}

// MENJADI:
{visibleColumns.includes('column_name') && <td>{item.column_name}</td>}
*/

// 8. EXPORT FUNCTION UPDATE:
/*
const exportCSV = () => {
  if (data.length === 0) {
    showToast("No data to export", 'error')
    return
  }
  
  try {
    const header = visibleColumns.map(col => col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(",")
    const rows = data.map(row =>
      visibleColumns.map(col => `"${row[col] ?? ""}"`).join(",")
    )
    const csvContent = [header, ...rows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `PAGE_NAME_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("CSV exported successfully", 'success')
  } catch (err) {
    showToast("Failed to export CSV", 'error')
  }
}
*/

// DAFTAR HALAMAN YANG PERLU DIUPDATE:
const PAGES_TO_UPDATE = [
  { path: '/app/gudang/page.tsx', pageName: 'gudang' },
  { path: '/app/stock_opname_batch/page.tsx', pageName: 'stock_opname_batch' },
  { path: '/app/analysis/page.tsx', pageName: 'analysis' },
  { path: '/app/product_name/page.tsx', pageName: 'product_name' },
  { path: '/app/categories/page.tsx', pageName: 'categories' },
  { path: '/app/recipes/page.tsx', pageName: 'recipes' },
  { path: '/app/supplier/page.tsx', pageName: 'supplier' },
  { path: '/app/branches/page.tsx', pageName: 'branches' },
  { path: '/app/users/page.tsx', pageName: 'users' },
  { path: '/app/produksi_detail/page.tsx', pageName: 'produksi_detail' },
  { path: '/app/product_settings/page.tsx', pageName: 'product_settings' }
]

console.log('✅ Sistem permission ESB siap diterapkan ke semua halaman!')
console.log('📋 Jalankan SQL script: update-all-pages.sql')
console.log('🔧 Update setiap halaman dengan template di atas')
console.log('🎯 Ganti PAGE_NAME dengan nama halaman yang sesuai')