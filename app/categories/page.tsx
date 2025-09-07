"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { supabase } from "@/src/lib/supabaseClient"
import { ArrowUpDown, Edit2, Trash2, Plus } from "lucide-react"
import Layout from '../../components/Layout'
import { canPerformActionSync } from '@/src/utils/rolePermissions'
import PageAccessControl from '../../components/PageAccessControl'

export default function CategoriesPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [form, setForm] = useState<any>({})
  const [editing, setEditing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: number | null}>({show: false, id: null})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [userRole, setUserRole] = useState<string>('guest')

  // Get user role
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role || 'guest')
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: false })
    if (!error) setData(data || [])
    setLoading(false)
  }, [])

  const handleInput = (e: any) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === "checkbox" ? checked : value })
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = {...prev}
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {}
    
    if (!form.category_name?.trim()) {
      newErrors.category_name = "Category name is required"
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      showToast("❌ Please fix the errors in the form", "error")
      return
    }
    
    setErrors({})

    try {
      if (editing) {
        const { error } = await supabase
          .from("categories")
          .update({
            category_name: form.category_name,
            description: form.description,
            is_active: form.is_active ?? true
          })
          .eq("id_category", form.id_category)
        
        if (error) throw error
        showToast("✅ Category updated successfully", "success")
      } else {
        const { error } = await supabase
          .from("categories")
          .insert([{
            category_name: form.category_name,
            description: form.description,
            is_active: form.is_active ?? true
          }])
        
        if (error) throw error
        showToast("✅ Category added successfully", "success")
      }
      
      setForm({})
      setEditing(false)
      setShowAddForm(false)
      fetchData()
    } catch (error: any) {
      showToast(`❌ ${error.message}`, "error")
    }
  }

  const handleEdit = (row: any) => {
    setForm(row)
    setEditing(true)
    setShowAddForm(true)
  }

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from("categories").delete().eq("id_category", id)
      if (error) throw error
      showToast("✅ Category deleted successfully", "success")
      fetchData()
    } catch (error) {
      showToast("❌ Failed to delete category", "error")
    } finally {
      setDeleteConfirm({show: false, id: null})
    }
  }

  const toggleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const filteredData = useMemo(() => {
    let result = data.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(search.toLowerCase()))
    )
    
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
    }
    
    return result
  }, [data, search, sortConfig])

  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  return (
    <Layout>
      <PageAccessControl pageName="categories">
        <div className="p-4 md:p-6">
        {toast && (
          <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 flex items-center shadow-lg transform transition-all duration-300 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            <span className="mr-2">{toast.type === 'success' ? '✅' : '❌'}</span>
            {toast.message}
          </div>
        )}

        {deleteConfirm.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h3 className="font-bold text-lg mb-4">Confirm Delete</h3>
              <p>Are you sure you want to delete this category?</p>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setDeleteConfirm({show: false, id: null})}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(deleteConfirm.id!)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-xl font-bold text-gray-800">🏷️ Category Management</h1>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="🔍 Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-2 py-1 rounded-md text-xs w-full sm:w-64"
          />
          {canPerformActionSync(userRole, 'categories', 'create') && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Plus size={16} />
              Add New
            </button>
          )}
        </div>

        {showAddForm && (
          <div className="mt-6 bg-white p-4 shadow rounded-lg">
            <h2 className="font-semibold text-base mb-2 text-gray-800">
              {editing ? "✏️ Edit Category" : "➕ Add New Category"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <input
                  name="category_name"
                  value={form.category_name || ""}
                  onChange={handleInput}
                  placeholder="Category Name"
                  className={`border px-2 py-1 rounded-md text-xs w-full ${
                    errors.category_name ? 'border-red-500' : ''
                  }`}
                />
                {errors.category_name && <p className="text-red-500 text-xs mt-0.5">{errors.category_name}</p>}
              </div>
              <div>
                <input
                  name="description"
                  value={form.description || ""}
                  onChange={handleInput}
                  placeholder="Description"
                  className="border px-2 py-1 rounded-md text-xs w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active ?? true}
                  onChange={handleInput}
                  className="rounded"
                />
                <label className="text-xs">Active</label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button 
                onClick={handleSubmit} 
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs"
              >
                {editing ? "Update" : "Add"} Category
              </button>
              <button 
                onClick={() => {
                  setForm({})
                  setEditing(false)
                  setErrors({})
                  setShowAddForm(false)
                }} 
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full text-xs border border-gray-200">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                {[
                  { key: "id_category", label: "ID" },
                  { key: "category_name", label: "Category Name" },
                  { key: "description", label: "Description" },
                  { key: "is_active", label: "Status" },
                  { key: "created_at", label: "Created" }
                ].map((col) => (
                  <th
                    key={col.key}
                    className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200"
                    onClick={() => toggleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown size={8} />
                    </div>
                  </th>
                ))}
                <th className="border px-2 py-1 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {Array.from({ length: 6 }).map((_, cellIdx) => (
                      <td key={cellIdx} className="border px-2 py-1">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-2 text-gray-500 text-xs">
                    No categories found
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr key={row.id_category} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border px-2 py-1">{row.id_category}</td>
                    <td className="border px-2 py-1 font-medium">{row.category_name}</td>
                    <td className="border px-2 py-1">{row.description || '-'}</td>
                    <td className="border px-2 py-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        row.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="border px-2 py-1">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="border px-2 py-1">
                      <div className="flex gap-1">
                        {canPerformActionSync(userRole, 'categories', 'edit') && (
                          <button 
                            onClick={() => handleEdit(row)} 
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        {canPerformActionSync(userRole, 'categories', 'delete') && (
                          <button 
                            onClick={() => setDeleteConfirm({show: true, id: row.id_category})} 
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4">
          <p className="text-xs text-gray-600">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredData.length)} of {filteredData.length} entries
          </p>
          <div className="flex gap-1">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(1)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              First
            </button>
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              Prev
            </button>
            <span className="px-2 py-0.5 border rounded text-xs">
              Page {page} of {totalPages || 1}
            </span>
            <button 
              disabled={page === totalPages || totalPages === 0} 
              onClick={() => setPage(p => p + 1)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              Next
            </button>
            <button 
              disabled={page === totalPages || totalPages === 0} 
              onClick={() => setPage(totalPages)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              Last
            </button>
          </div>
        </div>
        </div>
      </PageAccessControl>
    </Layout>
  )
}