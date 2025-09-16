"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { supabase } from "@/src/lib/supabaseClient"
import { ArrowUpDown, Plus, Edit2, Trash2, Save, X, Download, Upload } from "lucide-react"
import * as XLSX from 'xlsx'
import { useRouter } from "next/navigation"
import Layout from '../../components/Layout'
import { canPerformActionSync } from '@/src/utils/rolePermissions'
import PageAccessControl from '../../components/PageAccessControl'

// Helper function to convert text to Title Case
const toTitleCase = (str: string | null | undefined): string => {
  if (str === null || str === undefined) return ""
  // Sanitize input to prevent XSS
  const sanitized = String(str).replace(/[<>"'&]/g, '')
  return sanitized
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

interface Recipe {
  id?: number
  id_product: number
  item_id: number
  gramasi: number
  parent_product?: {
    product_name: string
    category: string
    sub_category?: string
  }
  child_product?: {
    product_name: string
    category: string
    sub_category?: string
    unit_kecil?: string
  }
}

export default function RecipesPage() {
  const router = useRouter()
  const [data, setData] = useState<Recipe[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Recipe>>({})
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [parentSearch, setParentSearch] = useState("")
  const [childSearch, setChildSearch] = useState("")
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [userRole, setUserRole] = useState<string>('guest')

  // Get user role
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role || 'guest')
    }
  }, [])

  // Filter products by category
  const parentProducts = useMemo(() => 
    products.filter(p => ['Menu', 'WIP'].includes(p.category)), [products]
  )
  
  const childProducts = useMemo(() => 
    products.filter(p => p.category === 'Bahan Baku'), [products]
  )

  // Filtered products for search
  const filteredParentProducts = useMemo(() => 
    parentProducts.filter(p => 
      p.product_name?.toLowerCase().includes(parentSearch.toLowerCase())
    ), [parentProducts, parentSearch]
  )
  
  const filteredChildProducts = useMemo(() => 
    childProducts.filter(p => 
      p.product_name?.toLowerCase().includes(childSearch.toLowerCase())
    ), [childProducts, childSearch]
  )

  // Get unique WIP subcategories
  const wipSubcategories = useMemo(() => {
    const wipProducts = products.filter(p => p.category === 'WIP' && p.sub_category)
    const normalizedSubcategories = wipProducts.map(p => {
      const sub = p.sub_category.trim()
      // Remove WIP prefix if exists, then add standardized WIP prefix
      const withoutWip = sub.replace(/^wip\s*/i, '').trim()
      return withoutWip ? `WIP ${withoutWip}` : 'WIP'
    })
    const subcategories = [...new Set(normalizedSubcategories)]
    return subcategories.filter(Boolean).sort()
  }, [products])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data: recipesData, error: recipesError } = await supabase
        .from("recipes")
        .select(`
          *,
          parent_product: nama_product!fk_recipes_parent_product (product_name, category, sub_category),
          child_product: nama_product!fk_recipes_child_product (product_name, category, sub_category, unit_kecil)
        `)
        .order('id', { ascending: false })

      if (recipesError) throw recipesError

      const { data: productsData, error: productsError } = await supabase
        .from("nama_product")
        .select("id_product, product_name, category, sub_category, unit_kecil")
        .order('product_name', { ascending: true })

      if (productsError) throw productsError

      setData(recipesData || [])
      setProducts(productsData || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(errorMessage)
      showToast(`Error: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: name === 'gramasi' ? parseFloat(value) || 0 : parseInt(value) || 0
    }))
  }

  const handleEdit = (recipe: Recipe) => {
    setEditingId(recipe.id || null)
    setForm({
      id_product: recipe.id_product,
      item_id: recipe.item_id,
      gramasi: recipe.gramasi
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setForm({})
    setParentSearch("")
    setChildSearch("")
  }

  const handleSave = async () => {
    if (!form.id_product || !form.item_id || !form.gramasi) {
      showToast("Please fill all required fields", 'error')
      return
    }

    const parentProduct = products.find(p => p.id_product === Number(form.id_product))
    const childProduct = products.find(p => p.id_product === Number(form.item_id))
    
    if (!parentProduct || !childProduct) {
      showToast("Selected products are invalid", 'error')
      return
    }

    // Validate parent can only be Menu or WIP
    if (!['Menu', 'WIP'].includes(parentProduct.category)) {
      showToast("Parent product must be Menu or WIP category", 'error')
      return
    }

    // Validate child can only be Bahan Baku
    if (childProduct.category !== 'Bahan Baku') {
      showToast("Child product must be Bahan Baku category", 'error')
      return
    }

    const recipeData = {
      id_product: Number(form.id_product),
      item_id: Number(form.item_id),
      gramasi: parseFloat(String(form.gramasi))
    }

    try {
      if (editingId && editingId !== -1) {
        const { error } = await supabase
          .from("recipes")
          .update(recipeData)
          .eq("id", editingId)

        if (error) throw error
        showToast("Recipe updated successfully", 'success')
      } else {
        const { error } = await supabase
          .from("recipes")
          .insert([recipeData])

        if (error) throw error
        showToast("Recipe created successfully", 'success')
      }

      setEditingId(null)
      setForm({})
      await fetchData()
    } catch (err: any) {
      console.error('Recipe save error:', err)
      showToast(`Error: ${err.message || 'Unknown error occurred'}`, 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this recipe?")) return

    try {
      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", id)

      if (error) throw error
      showToast("Recipe deleted successfully", 'success')
      fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      showToast(`Error: ${errorMessage}`, 'error')
    }
  }

  const toggleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const handleExport = () => {
    const exportData = data.map(recipe => ({
      ID: recipe.id || '',
      'Parent Product': recipe.parent_product?.product_name || '',
      'Child Product': recipe.child_product?.product_name || '',
      Gramasi: recipe.gramasi
    }))
    
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Recipes")
    XLSX.writeFile(wb, `recipes_${new Date().toISOString().split('T')[0]}.xlsx`)
    showToast('Recipes exported successfully', 'success')
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const arrayBuffer = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        const importData = []
        for (const row of jsonData as any[]) {
          const parentName = row['Parent Product']?.toString().trim()
          const childName = row['Child Product']?.toString().trim()
          const gramasi = parseFloat(row.Gramasi) || 0
          
          const parentProduct = products.find(p => 
            p.product_name.toLowerCase() === parentName?.toLowerCase()
          )
          const childProduct = products.find(p => 
            p.product_name.toLowerCase() === childName?.toLowerCase()
          )
          
          if (parentProduct && childProduct && gramasi > 0) {
            // Check if this recipe already exists in current recipes
            const existingRecipe = data.find(recipe => 
              recipe.id_product === parentProduct.id_product && 
              recipe.item_id === childProduct.id_product
            )
            
            if (!existingRecipe) {
              importData.push({
                id_product: parentProduct.id_product,
                item_id: childProduct.id_product,
                gramasi
              })
            }
          }
        }
        
        if (importData.length > 0) {
          const { error } = await supabase
            .from('recipes')
            .insert(importData)
          
          if (error) throw error
          const totalRows = jsonData.length
          const skipped = totalRows - importData.length
          const message = skipped > 0 
            ? `${importData.length} recipes imported, ${skipped} duplicates skipped`
            : `${importData.length} recipes imported successfully`
          showToast(message, 'success')
          fetchData()
        } else {
          showToast('No new recipes to import (all duplicates)', 'error')
        }
      } catch (err: any) {
        showToast(`Import error: ${err.message}`, 'error')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const { filteredAndSortedData, groupedData, totalPages } = useMemo(() => {
    const result = data.filter(recipe => {
      // Search filter
      const matchesSearch = recipe.parent_product?.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        recipe.child_product?.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        recipe.gramasi.toString().includes(search)
      
      // Category filter
      let matchesCategory = true
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'Menu') {
          matchesCategory = recipe.parent_product?.category === 'Menu'
        } else if (categoryFilter === 'WIP') {
          matchesCategory = recipe.parent_product?.category === 'WIP'
        } else {
          // Sub-category filter with case normalization
          const sub = recipe.parent_product?.sub_category?.trim() || ''
          const withoutWip = sub.replace(/^wip\s*/i, '').trim()
          const normalizedSub = withoutWip ? `WIP ${withoutWip}` : 'WIP'
          matchesCategory = recipe.parent_product?.category === 'WIP' && normalizedSub === categoryFilter
        }
      }
      
      return matchesSearch && matchesCategory
    })

    // Group by parent product
    const grouped = result.reduce((acc, recipe) => {
      const parentKey = recipe.id_product
      const parentName = recipe.parent_product?.product_name || 'Unknown'
      const parentCategory = recipe.parent_product?.category || 'Unknown'
      
      if (!acc[parentKey]) {
        acc[parentKey] = {
          parentName,
          parentCategory,
          recipes: [],
          totalGramasi: 0
        }
      }
      
      acc[parentKey].recipes.push(recipe)
      acc[parentKey].totalGramasi += recipe.gramasi
      return acc
    }, {} as Record<number, { parentName: string; parentCategory: string; recipes: Recipe[]; totalGramasi: number }>)

    const totalPages = Math.ceil(Object.keys(grouped).length / pageSize)
    const paginatedGroups = Object.entries(grouped).slice((page - 1) * pageSize, page * pageSize)

    return { 
      filteredAndSortedData: result, 
      groupedData: paginatedGroups, 
      totalPages 
    }
  }, [data, search, categoryFilter, page, pageSize])

  return (
    <Layout>
      <PageAccessControl pageName="recipes">
        <div className="p-4 md:p-6">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-base font-bold text-gray-800">📋 Recipe Management</h1>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by product name or gramasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border px-2 py-1 rounded-md text-xs w-full"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border px-2 py-1 rounded-md text-xs"
            >
              <option value="all">All Categories</option>
              <option value="Menu">Menu Only</option>
              <option value="WIP">All WIP</option>
              {wipSubcategories.map(subcategory => (
                <option key={subcategory} value={subcategory}>
                  {subcategory.startsWith('WIP') ? toTitleCase(subcategory) : `WIP ${toTitleCase(subcategory)}`}
                </option>
              ))}
            </select>
            
            <div className="flex gap-2">
              {(userRole === 'super admin' || userRole === 'admin') && (
                <button
                  onClick={handleExport}
                  className="bg-green-600 text-white px-2 py-1 rounded-md hover:bg-green-700 text-xs flex items-center gap-1"
                >
                  <Download size={16} />
                  Export
                </button>
              )}
              
              {(userRole === 'super admin' || userRole === 'admin') && (
                <label className="bg-orange-600 text-white px-2 py-1 rounded-md hover:bg-orange-700 text-xs flex items-center gap-1 cursor-pointer">
                  <Upload size={16} />
                  Import
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              )}
              
              {canPerformActionSync(userRole, 'recipes', 'create') && (
                <button
                  onClick={() => setEditingId(-1)}
                  className="bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 text-xs flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add New
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {(editingId !== null) && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h3 className="font-medium text-gray-800 mb-2 text-xs">
            {editingId === -1 ? "Create New Recipe" : "Edit Recipe"}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <div>
              <input
                type="text"
                placeholder="Search parent products..."
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                className="border px-3 py-1 rounded-md text-xs w-full mb-1"
              />
              <select
                name="id_product"
                value={form.id_product || ""}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                size={Math.min(filteredParentProducts.length + 1, 3)}
              >
                <option value="">Select Parent Product (Menu/WIP)</option>
                {filteredParentProducts.map(product => (
                  <option key={product.id_product} value={product.id_product}>
                    {toTitleCase(product.product_name)} ({product.category})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <input
                type="text"
                placeholder="Search child products..."
                value={childSearch}
                onChange={(e) => setChildSearch(e.target.value)}
                className="border px-3 py-1 rounded-md text-xs w-full mb-1"
              />
              <select
                name="item_id"
                value={form.item_id || ""}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                size={Math.min(filteredChildProducts.length + 1, 3)}
              >
                <option value="">Select Child Product (Bahan Baku)</option>
                {filteredChildProducts.map(product => (
                  <option key={product.id_product} value={product.id_product}>
                    {toTitleCase(product.product_name)} ({product.category})
                  </option>
                ))}
              </select>
            </div>
            
            <input
              type="number"
              name="gramasi"
              value={form.gramasi || ""}
              onChange={handleInputChange}
              placeholder="Enter gramasi"
              step="0.01"
              min="0"
              className="border px-2 py-1 rounded-md text-xs w-full"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-xs"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="bg-gray-600 text-white px-3 py-1 rounded-md hover:bg-gray-700 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white p-3 rounded-lg shadow text-center">
          <p className="text-xs text-gray-600">Loading recipes...</p>
        </div>
      ) : filteredAndSortedData.length === 0 ? (
        <div className="bg-white p-3 rounded-lg shadow text-center">
          <p className="text-gray-600 text-xs">No recipes found.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {groupedData.map(([parentKey, group]) => (
            <div key={parentKey} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              {/* Mini Header */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold">{toTitleCase(group.parentName)}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="px-1 py-0.5 bg-white/20 rounded text-xs">
                        {group.parentCategory}
                      </span>
                      <span className="px-1 py-0.5 bg-white/20 rounded text-xs">
                        {group.recipes.length} items • {group.totalGramasi}g
                      </span>
                    </div>
                  </div>
                  <div className="text-xs font-bold">{group.recipes.length}</div>
                </div>
              </div>

              {/* Mini Ingredients List */}
              <div className="p-1.5">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-1">
                  {group.recipes.map((recipe) => (
                    <div key={recipe.id} className="bg-gray-50 rounded p-1.5 border hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-xs text-gray-800 truncate">
                            {toTitleCase(recipe.child_product?.product_name)}
                          </h4>
                          <span className="inline-block px-1 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                            {recipe.child_product?.category}
                          </span>
                        </div>
                        <div className="flex gap-0.5 ml-0.5">
                          {canPerformActionSync(userRole, 'recipes', 'edit') && (
                            <button
                              onClick={() => handleEdit(recipe)}
                              className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50"
                              title="Edit"
                            >
                              <Edit2 size={6} />
                            </button>
                          )}
                          {canPerformActionSync(userRole, 'recipes', 'delete') && (
                            <button
                              onClick={() => recipe.id && handleDelete(recipe.id)}
                              className="text-red-600 hover:text-red-800 p-0.5 rounded hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 size={6} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-purple-600">
                          {recipe.gramasi} {toTitleCase(recipe.child_product?.unit_kecil)}
                        </div>
                        <div className="text-xs text-gray-400">
                          #{recipe.id}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
        
      {totalPages > 1 && (
        <div className="mt-8 bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-600">
              Page {page} of {totalPages} ({filteredAndSortedData.length} total recipes)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-200 transition-colors text-xs"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors text-xs"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </PageAccessControl>
    </Layout>
  )
}