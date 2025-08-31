"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/src/lib/supabaseClient"

export default function ESBPage() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [totalCount, setTotalCount] = useState(0)

  // filter state
  const [tanggal, setTanggal] = useState("")
  const [cabang, setCabang] = useState("")
  const [produk, setProduk] = useState("")
  const [subCategory, setSubCategory] = useState("")
  
  // sort state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // fetch data dengan filter
  const fetchData = async (page: number = 1) => {
    setLoading(true)
    setError(null)
    
    try {
      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      let query = supabase
        .from("esb_harian")
        .select("*", { count: 'exact' })

      // Apply filters
      if (tanggal) query = query.eq("sales_date", tanggal)
      if (cabang) query = query.ilike("branch", `%${cabang}%`)
      if (produk) query = query.ilike("product", `%${produk}%`)
      if (subCategory) query = query.ilike("sub_category", `%${subCategory}%`)
      
      // Apply sorting
      if (sortColumn) {
        query = query.order(sortColumn, { ascending: sortDirection === 'asc' })
      }

      query = query.range(from, to)
      
      const { data, error, count } = await query
      
      if (error) {
        setError(`Error fetching data: ${error.message}`)
        setData([])
        setTotalCount(0)
      } else {
        setData(data || [])
        setTotalCount(count || 0)
        setCurrentPage(page)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(`Unexpected error: ${errorMessage}`)
      setData([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [tanggal, cabang, produk, subCategory])

  useEffect(() => {
    fetchData(1)
  }, [])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchData(newPage)
    }
  }
  
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
    fetchData(1)
  }

  return (
    <div className="p-4 text-sm">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold">Laporan ESB Harian</h1>
      </div>

      {/* Filter Section */}
      <div className="flex flex-wrap gap-2 items-end mb-3">
        <input
          type="date"
          value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchData(1)}
          className="border p-1 rounded text-xs w-28"
          placeholder="Pilih tanggal"
        />
        <input
          type="text"
          placeholder="Cabang"
          value={cabang}
          onChange={(e) => setCabang(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchData(1)}
          className="border p-1 rounded text-xs w-20"
        />
        <input
          type="text"
          placeholder="Produk"
          value={produk}
          onChange={(e) => setProduk(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchData(1)}
          className="border p-1 rounded text-xs w-20"
        />
        <input
          type="text"
          placeholder="Sub Category"
          value={subCategory}
          onChange={(e) => setSubCategory(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchData(1)}
          className="border p-1 rounded text-xs w-24"
        />
        <button
          onClick={() => fetchData(1)}
          disabled={loading}
          className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:bg-blue-300 text-xs"
        >
          Filter
        </button>
        <button
          onClick={() => {
            setTanggal("")
            setCabang("")
            setProduk("")
            setSubCategory("")
            fetchData(1)
          }}
          className="bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 text-xs"
        >
          Reset
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm">
          <p>{error}</p>
        </div>
      )}

      <div className="mb-2">
        <p className="text-xs text-gray-600">
          Menampilkan {data.length} dari {totalCount} hasil
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm">Memuat data...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded text-sm">
          <p>Tidak ada data ditemukan.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="w-full border-collapse border text-xs">
              <thead>
                <tr className="bg-gray-100">
                  {Object.keys(data[0]).map((col) => (
                    <th 
                      key={col} 
                      className="border p-1.5 text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort(col)}
                    >
                      <div className="flex items-center gap-1">
                        {col}
                        {sortColumn === col && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="border p-1.5">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-xs text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded text-xs"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded text-xs"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
