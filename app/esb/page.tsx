"use client"

import { useEffect, useState, useMemo, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/src/lib/supabaseClient"
import { ArrowUpDown, Filter, X, Download } from "lucide-react"
import Layout from '../../components/Layout'
import { canViewColumn } from '@/src/utils/dbPermissions'
import { getBranchFilter } from '@/src/utils/branchAccess'
import PageAccessControl from '../../components/PageAccessControl'

// Helper function to convert text to Title Case
const toTitleCase = (str: any) => {
  if (str === null || str === undefined) return ""
  return String(str)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

function ESBPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(15)
  const [totalCount, setTotalCount] = useState(0)

  // filter state
  const [tanggal, setTanggal] = useState("")
  const [cabang, setCabang] = useState("")
  const [produk, setProduk] = useState("")
  const [subCategory, setSubCategory] = useState("")

  // global search
  const [globalSearch, setGlobalSearch] = useState("")
  
  // sort state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)

  // kolom hide/show
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(["id", "product_code"])
  const [userRole, setUserRole] = useState<string>('guest')

  const [userId, setUserId] = useState<number | null>(null)

  // Get user role from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role || 'guest')
      setUserId(user.id_user || null)
    }
  }, [])

  // Handle URL parameters from Analysis page
  useEffect(() => {
    const date = searchParams.get('date')
    const branch = searchParams.get('branch')
    const product = searchParams.get('product')
    
    if (date || branch || product) {
      if (date) setTanggal(date)
      if (branch) setCabang(branch)
      if (product) setProduk(product)
      
      showToast(`Filtered by: ${[date, branch, product].filter(Boolean).join(', ')}`, 'success')
    }
  }, [searchParams])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }



  const fetchData = useCallback(async (page: number = 1) => {
    setLoading(true)
    setError(null)
    
    try {
      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      // Get branch filter first
      const branchFilter = await getBranchFilter()
      
      let query = supabase
        .from("esb_harian")
        .select("*", { count: 'exact' })

      // Apply branch filter first (for non-admin/manager users)
      if (branchFilter && branchFilter.length > 0) {
        query = query.in('branch', branchFilter)
      }

      // Apply other filters
      if (tanggal) query = query.eq("sales_date", tanggal)
      if (cabang) query = query.ilike("branch", `%${cabang}%`)
      if (produk) query = query.ilike("product", `%${produk}%`)
      if (subCategory) query = query.ilike("sub_category", `%${subCategory}%`)

      // Global search across multiple fields
      if (globalSearch) {
        query = query.or(
          `branch.ilike.%${globalSearch}%,product.ilike.%${globalSearch}%,sub_category.ilike.%${globalSearch}%`
        )
      }
      
      // Apply sorting
      if (sortConfig?.key) {
        query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
      } else {
        query = query.order('sales_date', { ascending: false })
      }

      query = query.range(from, to)
      
      const { data, error, count } = await query
      
      if (error) {
        setError(`Error fetching data: ${error.message}`)
        setData([])
        setTotalCount(0)
        showToast(`Error: ${error.message}`, 'error')
      } else {
        setData(data || [])
        setTotalCount(count || 0)
        setCurrentPage(page)
        if (data && data.length === 0) {
          showToast('No data found with current filters', 'error')
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(`Unexpected error: ${errorMessage}`)
      setData([])
      setTotalCount(0)
      showToast(`Error: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [tanggal, cabang, produk, subCategory, globalSearch, sortConfig, itemsPerPage])

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [tanggal, cabang, produk, subCategory, globalSearch])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchData(newPage)
    }
  }
  
  const handleSort = (column: string) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === column && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key: column, direction })
  }



  const resetFilters = () => {
    setTanggal("")
    setCabang("")
    setProduk("")
    setSubCategory("")
    setGlobalSearch("")
    setSortConfig(null)
    showToast("Filters reset", 'success')
    fetchData(1)
  }

  // Get columns based on permissions
  const [permittedColumns, setPermittedColumns] = useState<string[]>([])
  
  useEffect(() => {
    const loadPermittedColumns = async () => {
      if (data.length > 0) {
        const allColumns = Object.keys(data[0])
        const permitted = []
        
        for (const col of allColumns) {
          const hasPermission = await canViewColumn(userRole, 'esb', col)
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

  // Export CSV
  const exportCSV = () => {
    if (data.length === 0) {
      showToast("No data to export", 'error')
      return
    }
    
    try {
      const header = visibleColumns.map(col => toTitleCase(col)).join(",")
      const rows = data.map(row =>
        visibleColumns.map(col => `"${row[col] ?? ""}"`).join(",")
      )
      const csvContent = [header, ...rows].join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `esb_export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast("CSV exported successfully", 'success')
    } catch (err) {
      showToast("Failed to export CSV", 'error')
    }
  }

  // Summary values
  const totalValue = data.reduce((sum, row) => sum + (Number(row.value_total) || 0), 0)

  // Format number to Indonesian currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value)
  }

  return (
        <div className="p-1 md:p-2 text-xs">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 flex items-center shadow-lg transform transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span className="mr-2">{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-800">📊 Laporan ESB Harian</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Access Level:</span>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            userRole === 'super admin' ? 'bg-red-100 text-red-800' :
            userRole === 'admin' ? 'bg-blue-100 text-blue-800' :
            userRole === 'finance' ? 'bg-purple-100 text-purple-800' :
            userRole === 'pic_branch' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {userRole.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-1 rounded-lg shadow mb-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-1 mb-1">
          <div>
            <label className="block text-xs font-medium mb-0.5 text-gray-700">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="border px-1 py-0.5 rounded-md text-xs w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5 text-gray-700">Cabang</label>
            <input
              type="text"
              placeholder="Cari cabang"
              value={cabang}
              onChange={(e) => setCabang(e.target.value)}
              className="border px-1 py-0.5 rounded-md text-xs w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5 text-gray-700">Produk</label>
            <input
              type="text"
              placeholder="Cari produk"
              value={produk}
              onChange={(e) => setProduk(e.target.value)}
              className="border px-1 py-0.5 rounded-md text-xs w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5 text-gray-700">Sub Kategori</label>
            <input
              type="text"
              placeholder="Cari sub kategori"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className="border px-1 py-0.5 rounded-md text-xs w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5 text-gray-700">Pencarian Global</label>
            <input
              type="text"
              placeholder="🔍 Cari di semua kolom"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="border px-1 py-0.5 rounded-md text-xs w-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => fetchData(1)}
            disabled={loading}
            className="bg-blue-600 text-white px-1 py-0.5 rounded-md hover:bg-blue-700 disabled:bg-blue-300 text-xs flex items-center gap-0.5"
          >
            <Filter size={12} />
            Terapkan Filter
          </button>
          <button
            onClick={resetFilters}
            className="bg-gray-600 text-white px-1 py-0.5 rounded-md hover:bg-gray-700 text-xs flex items-center gap-0.5"
          >
            <X size={12} />
            Reset Filter
          </button>

          {(userRole === 'super admin' || userRole === 'admin') && (
            <button
              onClick={exportCSV}
              className="bg-green-600 text-white px-1 py-0.5 rounded-md hover:bg-green-700 text-xs flex items-center gap-0.5"
            >
              <Download size={12} />
              Export CSV
            </button>
          )}

        </div>
      </div>



      {/* Summary Card */}
      {data.length > 0 && (
        <div className="bg-white p-1 rounded-lg shadow mb-1">
          <div className="flex flex-wrap gap-1">
            <div className="bg-blue-50 p-1 rounded-md flex-1 min-w-[120px]">
              <h3 className="text-xs text-gray-600">Total Records</h3>
              <p className="text-sm font-bold text-blue-700">{totalCount.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 p-1 rounded-md flex-1 min-w-[120px]">
              <h3 className="text-xs text-gray-600">Total Value</h3>
              <p className="text-sm font-bold text-green-700">{formatCurrency(totalValue)}</p>
            </div>
            <div className="bg-purple-50 p-1 rounded-md flex-1 min-w-[120px]">
              <h3 className="text-xs text-gray-600">Current Page</h3>
              <p className="text-sm font-bold text-purple-700">
                {currentPage} of {totalPages}
              </p>
            </div>
            <div className="bg-yellow-50 p-1 rounded-md flex-1 min-w-[120px]">
              <h3 className="text-xs text-gray-600">Access Level</h3>
              <p className="text-sm font-bold text-yellow-700 capitalize">{userRole}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          <p>{toTitleCase(error)}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white p-2 rounded-lg shadow text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mb-1"></div>
            <p className="text-xs text-gray-600">Memuat data...</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white p-2 rounded-lg shadow text-center">
          <p className="text-gray-600 text-xs">Tidak ada data ditemukan.</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {tanggal || cabang || produk || subCategory || globalSearch 
              ? 'Coba ubah filter pencarian Anda.' 
              : 'Tidak ada data ESB yang tersedia.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100 z-10">
                  <tr>
                    {visibleColumns.map((col) => (
                      <th 
                        key={col} 
                        className="border-b p-1 text-left cursor-pointer hover:bg-gray-200 font-medium text-gray-700"
                        onClick={() => handleSort(col)}
                      >
                        <div className="flex items-center gap-1">
                          {toTitleCase(col)}
                          {sortConfig?.key === col && (
                            <span className="text-xs">
                              {sortConfig.direction === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                          {!sortConfig?.key && col === 'sales_date' && (
                            <span className="text-xs text-gray-400">↓</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr 
                      key={i} 
                      className={`${
                        i % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } hover:bg-blue-50 transition`}
                    >
                      {visibleColumns.map((col, j) => (
                        <td key={j} className="border-b p-1">
                          {col === 'value_total' || col === 'price' ? 
                            formatCurrency(Number(row[col]) || 0) : 
                            toTitleCase(row[col] ?? "")
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {totalPages > 1 && (
            <div className="bg-white p-1 rounded-lg shadow mt-1">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-1">
                <div className="text-xs text-gray-600">
                  Menampilkan {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} dari {totalCount} records
                </div>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1 || loading}
                    className="px-1 py-0.5 border rounded disabled:opacity-50 text-xs hover:bg-gray-100"
                  >
                    First
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="px-1 py-0.5 border rounded disabled:opacity-50 text-xs hover:bg-gray-100"
                  >
                    Previous
                  </button>
                  <span className="px-1 py-0.5 border rounded text-xs bg-gray-100">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    className="px-1 py-0.5 border rounded disabled:opacity-50 text-xs hover:bg-gray-100"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages || loading}
                    className="px-1 py-0.5 border rounded disabled:opacity-50 text-xs hover:bg-gray-100"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
        </div>
  )
}

export default function ESBPage() {
  return (
    <Layout>
      <PageAccessControl pageName="esb">
        <Suspense fallback={<div className="p-4">Loading...</div>}>
          <ESBPageContent />
        </Suspense>
      </PageAccessControl>
    </Layout>
  )
}