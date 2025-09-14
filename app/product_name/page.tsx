"use client"
// Helper function (paling atas di file kamu)
const toTitleCase = (str: any) => {
  if (str === null || str === undefined) return ""
  return String(str)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

import { useEffect, useState, useMemo, useCallback } from "react"
import { supabase } from "@/src/lib/supabaseClient"
import { ArrowUpDown, Edit2, Trash2, Filter, X, Plus, RefreshCw, Menu, ChevronDown, ChevronUp, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import * as XLSX from 'xlsx'
import Layout from '../../components/Layout'
import { canPerformActionSync } from '@/src/utils/rolePermissions'
import PageAccessControl from '../../components/PageAccessControl'

export default function ProductPage() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
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
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [supplierSearch, setSupplierSearch] = useState("")
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [selectedSupplierText, setSelectedSupplierText] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [userRole, setUserRole] = useState<string>('guest')
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState('list') // 'list' or 'details'
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Check if mobile on mount and on resize
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    
    return () => {
      window.removeEventListener('resize', checkIsMobile)
    }
  }, [])

  // Get user role
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role || 'guest')
    }
  }, [])

  // Load data
  useEffect(() => {
    fetchData()
    fetchSuppliers()
    fetchCategories()
    fetchBranches()
  }, [])

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1)
  }, [search, filters])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("nama_product")
      .select(`
        *,
        suppliers(nama_supplier),
        product_branches(branches(kode_branch, nama_branch))
      `)
    if (error) {
      console.error('Error fetching products:', error)
      showToast(`Database error: ${error.message}`, "error")
    } else {
      setData(data || [])
    }
    setLoading(false)
  }, [])

  const fetchSuppliers = useCallback(async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id_supplier, nama_supplier, nama_barang")
      .order("nama_supplier")
    
    if (error) {
      console.error('Error fetching suppliers:', error)
    } else {
      setSuppliers(data || [])
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id_category, category_name")
      .eq("is_active", true)
      .order("category_name")
    
    if (!error) {
      setCategories(data || [])
    }
  }, [])

  const fetchBranches = useCallback(async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("kode_branch, nama_branch")
      .eq("is_active", true)
      .order("nama_branch")
    
    if (!error) {
      setBranches(data || [])
    }
  }, [])

  const handleInput = (e: any) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === "checkbox" ? checked : value })
    // Clear error when user starts typing
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
    if (submitting) return;
    
    const newErrors: Record<string, string> = {};
    
    if (!form.product_name?.trim()) {
      newErrors.product_name = "Product name is required";
    }
    
    if (!form.supplier_id) {
      newErrors.supplier_id = "Supplier is required";
    }
    
    if (!form.category?.trim()) {
      newErrors.category = "Category is required";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast("❌ Please fix the errors in the form", "error");
      return;
    }
    
    setErrors({});
    setSubmitting(true);

    try {
      if (editing) {
        // Clean form data - only send valid table fields
        const updateData = {
          product_name: form.product_name,
          sub_category: form.sub_category,
          unit_kecil: form.unit_kecil,
          satuan_kecil: form.satuan_kecil ? parseFloat(form.satuan_kecil) : null,
          unit_besar: form.unit_besar,
          satuan_besar: form.satuan_besar ? parseFloat(form.satuan_besar) : null,
          supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
          category: form.category,
          harga: form.harga ? parseFloat(form.harga) : 0,
          merk: form.merk
        }
        
        const { error } = await supabase.from("nama_product").update(updateData).eq("id_product", form.id_product)
        if (error) {
          console.error('Update error:', error)
          throw new Error(error.message || 'Failed to update product')
        }
        showToast("✅ Product updated successfully", "success")
      } else {
        // Clean form data for insert
        const insertData = {
          product_name: form.product_name,
          sub_category: form.sub_category,
          unit_kecil: form.unit_kecil,
          satuan_kecil: form.satuan_kecil ? parseFloat(form.satuan_kecil) : null,
          unit_besar: form.unit_besar,
          satuan_besar: form.satuan_besar ? parseFloat(form.satuan_besar) : null,
          supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
          category: form.category,
          harga: form.harga ? parseFloat(form.harga) : 0,
          merk: form.merk
        }
        
        const { error } = await supabase.from("nama_product").insert([insertData])
        if (error) {
          console.error('Insert error:', error)
          throw new Error(error.message || 'Failed to create product')
        }
        showToast("✅ Product added successfully", "success")
      }
      // Save product branches
      if (selectedBranches.length > 0) {
        const productId = editing ? form.id_product : null
        if (!editing) {
          // Get the newly created product ID
          const { data: newProduct } = await supabase
            .from("nama_product")
            .select("id_product")
            .eq("product_name", form.product_name)
            .single()
          
          if (newProduct) {
            const branchData = selectedBranches.map(branchCode => ({
              product_id: newProduct.id_product,
              branch_code: branchCode
            }))
            
            await supabase.from("product_branches").insert(branchData)
          }
        } else {
          // Delete existing branches and insert new ones
          await supabase.from("product_branches").delete().eq("product_id", productId)
          
          const branchData = selectedBranches.map(branchCode => ({
            product_id: productId,
            branch_code: branchCode
          }))
          
          await supabase.from("product_branches").insert(branchData)
        }
      }
      
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Save error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast(`❌ ${errorMessage}`, "error")
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setForm({})
    setEditing(false)
    setErrors({})
    setSupplierSearch("")
    setSelectedSupplierText("")
    setSelectedBranches([])
    setShowSupplierDropdown(false)
    setShowAddForm(false)
  }

  const handleEdit = (row: any) => {
    setForm(row)
    setEditing(true)
    setShowAddForm(true)
    setSupplierSearch("")
    setShowSupplierDropdown(false)
    
    // Set selected supplier text
    const supplier = suppliers.find(s => s.id_supplier === row.supplier_id)
    setSelectedSupplierText(supplier ? `${supplier.nama_supplier} - ${supplier.nama_barang}` : "")
    
    // Set selected branches
    const productBranches = row.product_branches?.map((pb: any) => pb.branches.kode_branch) || []
    setSelectedBranches(productBranches)
    
    // Scroll to form
    setTimeout(() => {
      document.getElementById('product-form')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from("nama_product").delete().eq("id_product", id)
      if (error) {
        console.error('Delete error:', error)
        throw new Error(error.message || 'Failed to delete product')
      }
      showToast("✅ Product deleted successfully", "success")
      fetchData()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast(`❌ Delete failed: ${errorMessage}`, "error")
    } finally {
      setDeleteConfirm({show: false, id: null});
    }
  }

  const toggleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  // Filter + Sort dengan useMemo untuk optimasi
  const filteredData = useMemo(() => {
    let result = data.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(search.toLowerCase()))
    )
    
    // Apply advanced filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(row => row[key] === value);
      }
    })
    
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
    }
    
    return result
  }, [data, search, filters, sortConfig])

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  // Export XLSX
  const exportXLSX = () => {
    if (filteredData.length === 0) {
      showToast("❌ No data to export", "error")
      return
    }
    
    // Include merk field in export - use filtered data
    const exportData = filteredData.map(item => ({
      id_product: item.id_product,
      product_name: item.product_name,
      sub_category: item.sub_category,
      unit_kecil: item.unit_kecil,
      satuan_kecil: item.satuan_kecil,
      unit_besar: item.unit_besar,
      satuan_besar: item.satuan_besar,
      supplier_id: item.supplier_id,
      category: item.category,
      harga: item.harga,
      merk: item.merk,
      branches: item.product_branches?.filter((pb: any) => pb.branches).map((pb: any) => pb.branches.nama_branch).join(', ') || 'No branches'
    }))
    
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Products")
    XLSX.writeFile(wb, `products_${new Date().toISOString().split('T')[0]}.xlsx`)
    showToast("✅ Products exported successfully", "success")
  }

  // Import XLSX
  const importXLSX = (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        const entries = jsonData
          .map((row: any) => {
            const entry: any = {}
            
            if (row.product_name?.toString().trim()) entry.product_name = row.product_name.toString().trim()
            if (row.sub_category?.toString().trim()) entry.sub_category = row.sub_category.toString().trim()
            if (row.unit_kecil?.toString().trim()) entry.unit_kecil = row.unit_kecil.toString().trim()
            if (row.unit_besar?.toString().trim()) entry.unit_besar = row.unit_besar.toString().trim()
            if (row.merk?.toString().trim()) entry.merk = row.merk.toString().trim()
            if (row.branches?.toString().trim()) entry.branches = row.branches.toString().trim()
            
            if (row.supplier_id) {
              const supplierId = parseInt(row.supplier_id)
              if (!isNaN(supplierId)) entry.supplier_id = supplierId
            }
            
            if (row.satuan_kecil) {
              const val = parseFloat(row.satuan_kecil)
              if (!isNaN(val)) entry.satuan_kecil = val
            }
            if (row.satuan_besar) {
              const val = parseFloat(row.satuan_besar)
              if (!isNaN(val)) entry.satuan_besar = val
            }
            if (row.harga) {
              const val = parseFloat(String(row.harga).replace(/[^0-9.-]/g, ''))
              entry.harga = !isNaN(val) ? val : 0
            } else {
              entry.harga = 0
            }
            
            if (row.category?.toString().trim()) {
              const category = row.category.toString().trim()
              if (categories.some(cat => cat.category_name === category)) {
                entry.category = category
              }
            }
            
            return entry
          })
          .filter((entry: any) => entry.product_name)
        
        if (entries.length === 0) {
          showToast("❌ No valid data found", "error")
          return
        }
        
        let successCount = 0
        let updateCount = 0
        
        for (const entry of entries) {
          // Extract branches data from entry
          const branchesData = entry.branches ? entry.branches.toString().split(',').map((b: string) => b.trim()) : []
          
          // Remove branches from entry before saving to nama_product
          const productEntry = { ...entry }
          delete productEntry.branches
          
          const { data: existing } = await supabase
            .from("nama_product")
            .select("id_product")
            .eq("product_name", productEntry.product_name)
            .single()
          
          let productId = null
          
          if (existing) {
            const { error } = await supabase
              .from("nama_product")
              .update(productEntry)
              .eq("id_product", existing.id_product)
            
            if (!error) {
              productId = existing.id_product
              updateCount++
              successCount++
            }
          } else {
            const { data: newProduct, error } = await supabase
              .from("nama_product")
              .insert([productEntry])
              .select('id_product')
              .single()
            
            if (!error && newProduct) {
              productId = newProduct.id_product
              successCount++
            }
          }
          
          // Handle branches if product was saved successfully
          if (productId && branchesData.length > 0) {
            // Delete existing branches
            await supabase
              .from("product_branches")
              .delete()
              .eq("product_id", productId)
            
            // Insert new branches
            const validBranches = branchesData
              .map((branchName: string) => {
                const branch = branches.find(b => b.nama_branch === branchName)
                return branch ? branch.kode_branch : null
              })
              .filter(Boolean)
            
            if (validBranches.length > 0) {
              const branchInsertData = validBranches.map((branchCode: string) => ({
                product_id: productId,
                branch_code: branchCode
              }))
              
              await supabase
                .from("product_branches")
                .insert(branchInsertData)
            }
          }
        }
        
        if (successCount > 0) {
          showToast(`✅ Imported ${successCount} products (${updateCount} updated, ${successCount - updateCount} new)`, "success")
          fetchData()
        } else {
          showToast("❌ Failed to import any products", "error")
        }
        
      } catch (error) {
        showToast("❌ Failed to import Excel file", "error")
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  // Reset filters
  const resetFilters = () => {
    setFilters({})
    setSearch("")
  }

  // Mobile view handlers
  const viewProductDetails = (product: any) => {
    setSelectedProduct(product)
    setMobileView('details')
  }

  const closeProductDetails = () => {
    setMobileView('list')
    setSelectedProduct(null)
  }

  // Mobile filter component
  const MobileFilters = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="bg-white w-4/5 h-full p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Filters</h3>
          <button onClick={() => setShowMobileFilters(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border px-3 py-2 rounded-md w-full"
            />
          </div>
          
          {['sub_category', 'category', 'unit_kecil', 'unit_besar'].map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">
                {toTitleCase(field.replace(/_/g, ' '))}
              </label>
              <select
                value={filters[field] || ''}
                onChange={(e) => setFilters({...filters, [field]: e.target.value})}
                className="border px-3 py-2 rounded-md w-full"
              >
                <option value="">All {toTitleCase(field.replace(/_/g, ' '))}</option>
                {[...new Set(data.map(item => item[field]))].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
          ))}
          
          <div className="flex gap-2">
            <button 
              onClick={resetFilters}
              className="px-4 py-2 bg-gray-200 rounded-md flex-1"
            >
              Reset
            </button>
            <button 
              onClick={() => setShowMobileFilters(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md flex-1"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <Layout>
      <PageAccessControl pageName="product_name">
        <div className="p-4 md:p-6">
          {/* Toast Notification */}
          {toast && (
            <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 flex items-center shadow-lg transform transition-all duration-300 ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}>
              <span className="mr-2">{toast.type === 'success' ? '✅' : '❌'}</span>
              {toast.message}
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirm.show && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
                <h3 className="font-bold text-lg mb-4">Confirm Delete</h3>
                <p>Are you sure you want to delete this product? This action cannot be undone.</p>
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

          {/* Mobile Filters */}
          {showMobileFilters && <MobileFilters />}

          {/* Mobile Product Details View */}
          {isMobile && mobileView === 'details' && selectedProduct && (
            <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Product Details</h2>
                  <button onClick={closeProductDetails} className="p-2">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold">Product Name:</label>
                    <p>{toTitleCase(selectedProduct.product_name)}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Sub Category:</label>
                    <p>{toTitleCase(selectedProduct.sub_category)}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Small Unit:</label>
                    <p>{toTitleCase(selectedProduct.unit_kecil)}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Small Unit Type:</label>
                    <p>{toTitleCase(selectedProduct.satuan_kecil)}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Large Unit:</label>
                    <p>{toTitleCase(selectedProduct.unit_besar)}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Large Unit Type:</label>
                    <p>{toTitleCase(selectedProduct.satuan_besar)}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Supplier:</label>
                    <p>{selectedProduct.suppliers ? toTitleCase(selectedProduct.suppliers.nama_supplier) : 'No Supplier'}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Harga:</label>
                    <p>{selectedProduct.harga}</p>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Category:</label>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      selectedProduct.category === 'Menu' ? 'bg-blue-100 text-blue-800' :
                      selectedProduct.category === 'WIP' ? 'bg-yellow-100 text-yellow-800' :
                      selectedProduct.category === 'Bahan Baku' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedProduct.category || 'Not Set'}
                    </span>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Branches:</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedProduct.product_branches?.filter((pb: any) => pb.branches).map((pb: any) => (
                        <span key={pb.branches.kode_branch} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {pb.branches.nama_branch}
                        </span>
                      )) || <span className="text-gray-400 text-xs">No branches</span>}
                    </div>
                  </div>
                  
                  <div>
                    <label className="font-semibold">Merk:</label>
                    <p>{toTitleCase(selectedProduct.merk)}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-6">
                  {canPerformActionSync(userRole, 'product_name', 'edit') && (
                    <button 
                      onClick={() => {
                        closeProductDetails();
                        handleEdit(selectedProduct);
                      }} 
                      className="flex-1 bg-blue-600 text-white py-2 rounded-md"
                    >
                      Edit
                    </button>
                  )}
                  {canPerformActionSync(userRole, 'product_name', 'delete') && (
                    <button 
                      onClick={() => setDeleteConfirm({show: true, id: selectedProduct.id_product})} 
                      className="flex-1 bg-red-600 text-white py-2 rounded-md"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-xl font-bold text-gray-800">📦 Product Management</h1>
            {isMobile && (
              <button 
                onClick={() => setShowMobileFilters(true)}
                className="ml-auto p-2 bg-gray-200 rounded-md"
              >
                <Filter size={20} />
              </button>
            )}
          </div>

          {/* Search + Import/Export */}
          <div className="space-y-3 mb-4">
            {!isMobile ? (
              <input
                type="text"
                placeholder="🔍 Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border px-2 py-1 rounded-md text-xs w-full sm:w-64"
              />
            ) : (
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border pl-8 pr-2 py-2 rounded-md w-full"
                />
              </div>
            )}
            
            {/* Primary Actions */}
            <div className="flex flex-wrap gap-2">
              {canPerformActionSync(userRole, 'product_name', 'create') && (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add New
                </button>
              )}
              <button
                onClick={() => {
                  fetchData()
                  fetchSuppliers()
                  fetchCategories()
                  fetchBranches()
                  showToast("✅ Data refreshed", "success")
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              {!isMobile && (
                <button 
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`px-3 py-1 rounded-md text-xs flex items-center gap-1 ${
                    showAdvancedFilters ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  <Filter size={16} />
                  Filters
                </button>
              )}
            </div>
            
            {/* Secondary Actions */}
            <div className="flex flex-wrap gap-2">
              {(userRole === 'super admin' || userRole === 'admin') && (
                <button onClick={exportXLSX} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs">
                  Export Excel
                </button>
              )}
              {(userRole === 'super admin' || userRole === 'admin') && (
                <label className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-xs cursor-pointer">
                  Import Excel
                  <input type="file" accept=".xlsx,.xls" onChange={importXLSX} className="hidden" />
                </label>
              )}
              {(search || Object.values(filters).some(f => f)) && (
                <button 
                  onClick={resetFilters}
                  className="px-3 py-1 rounded-md text-xs flex items-center gap-1 bg-red-100 text-red-700 hover:bg-red-200"
                >
                  <X size={16} />
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Advanced Filters (Desktop only) */}
          {showAdvancedFilters && !isMobile && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 my-4 p-4 bg-white rounded-lg shadow">
              {['sub_category', 'category', 'unit_kecil', 'unit_besar'].map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1 text-gray-700">{toTitleCase(field.replace(/_/g, ' '))}</label>
                  <select
                    value={filters[field] || ''}
                    onChange={(e) => setFilters({...filters, [field]: e.target.value})}
                    className="border px-2 py-1 rounded-md text-xs w-full"
                  >
                    <option value="">All {toTitleCase(field.replace(/_/g, ' '))}</option>
                    {[...new Set(data.map(item => item[field]))].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          {showAddForm && (
            <div id="product-form" className="mt-6 bg-white p-4 shadow rounded-lg">
              <h2 className="font-semibold text-base mb-2 text-gray-800">{editing ? "✏️ Edit Product" : "➕ Add New Product"}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "product_name",
                  "sub_category",
                  "unit_kecil",
                  "satuan_kecil",
                  "unit_besar",
                  "satuan_besar",
                  "harga",
                  "merk",
                ].map((field) => (
                  <div key={field}>
                    <input
                      name={field}
                      value={form[field] || ""}
                      onChange={handleInput}
                      placeholder={toTitleCase(field.replace(/_/g, ' '))}
                      onInput={(e) => {
                        if (['satuan_kecil', 'satuan_besar', 'harga'].includes(field)) {
                          (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '');
                        }
                      }}
                      className={`border px-2 py-1 rounded-md text-xs focus:ring focus:ring-blue-200 w-full ${
                        errors[field] ? 'border-red-500' : ''
                      }`}
                    />
                    {errors[field] && <p className="text-red-500 text-xs mt-0.5">{errors[field]}</p>}
                  </div>
                ))}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type to search suppliers..."
                    value={editing ? selectedSupplierText : supplierSearch}
                    onChange={(e) => {
                      const value = e.target.value
                      setSupplierSearch(value)
                      setSelectedSupplierText(value)
                      setShowSupplierDropdown(value.length > 0)
                      // Clear selection if text doesn't match any supplier
                      if (!suppliers.some(s => `${s.nama_supplier} - ${s.nama_barang}` === value)) {
                        setForm((prev: any) => ({ ...prev, supplier_id: '' }))
                      }
                    }}
                    onFocus={() => {
                      if (supplierSearch.length > 0) setShowSupplierDropdown(true)
                    }}
                    onBlur={() => {
                      // Delay hiding dropdown to allow clicks
                      setTimeout(() => setShowSupplierDropdown(false), 200)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowSupplierDropdown(false)
                      }
                    }}
                    className={`border px-2 py-1 rounded-md text-xs w-full ${
                      errors.supplier_id ? 'border-red-500' : ''
                    }`}
                  />
                  {showSupplierDropdown && (
                    <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                      {suppliers
                        .filter(supplier => 
                          supplier.nama_supplier?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                          supplier.nama_barang?.toLowerCase().includes(supplierSearch.toLowerCase())
                        )
                        .slice(0, 10)
                        .map((supplier) => (
                          <div
                            key={supplier.id_supplier}
                            onClick={() => {
                              setForm((prev: any) => ({ ...prev, supplier_id: supplier.id_supplier }))
                              setSelectedSupplierText(`${supplier.nama_supplier} - ${supplier.nama_barang}`)
                              setSupplierSearch('')
                              setShowSupplierDropdown(false)
                            }}
                            className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900 text-xs">{supplier.nama_supplier}</div>
                            <div className="text-xs text-gray-500">{supplier.nama_barang}</div>
                          </div>
                        ))}
                      {suppliers.filter(supplier => 
                        supplier.nama_supplier?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                        supplier.nama_barang?.toLowerCase().includes(supplierSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-2 py-1 text-xs text-gray-500">No suppliers found</div>
                      )}
                    </div>
                  )}
                  {errors.supplier_id && <p className="text-red-500 text-xs mt-0.5">{errors.supplier_id}</p>}
                </div>
                <div>
                  <select
                    name="category"
                    value={form.category || ""}
                    onChange={handleInput}
                    className={`border px-2 py-1 rounded-md text-xs w-full ${
                      errors.category ? 'border-red-500' : ''
                    }`}
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id_category} value={cat.category_name}>
                        {cat.category_name}
                      </option>
                    ))}
                  </select>
                  {errors.category && <p className="text-red-500 text-xs mt-0.5">{errors.category}</p>}
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1 text-gray-700">Branches</label>
                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                    {branches.map((branch) => (
                      <label key={branch.kode_branch} className="flex items-center gap-2 text-xs py-1">
                        <input
                          type="checkbox"
                          checked={selectedBranches.includes(branch.kode_branch)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBranches([...selectedBranches, branch.kode_branch])
                            } else {
                              setSelectedBranches(selectedBranches.filter(b => b !== branch.kode_branch))
                            }
                          }}
                          className="rounded"
                        />
                        <span>{branch.nama_branch}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{selectedBranches.length} branch(es) selected</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={handleSubmit} 
                  disabled={submitting}
                  className={`px-3 py-1 rounded-md text-xs ${
                    submitting 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white`}
                >
                  {submitting ? 'Saving...' : (editing ? "Update Product" : "Add Product")}
                </button>
                {editing && (
                  <button 
                    onClick={resetForm} 
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-xs"
                  >
                    Cancel Edit
                  </button>
                )}
                <button 
                  onClick={resetForm} 
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Desktop Table */}
          {!isMobile && (
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="w-full text-xs border border-gray-200">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    {[
                      { key: "id_product", label: "ID" },
                      { key: "product_name", label: "Product Name" },
                      { key: "sub_category", label: "Sub Category" },
                      { key: "unit_kecil", label: "Small Unit" },
                      { key: "satuan_kecil", label: "Small Unit Type" },
                      { key: "unit_besar", label: "Large Unit" },
                      { key: "satuan_besar", label: "Large Unit Type" },
                      { key: "supplier", label: "Supplier" },
                      { key: "harga", label: "Harga" },
                      { key: "category", label: "Category" },
                      { key: "branches", label: "Branches" }, 
                      { key: "merk", label:"Merk"}
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="border px-1 py-1 text-left font-medium cursor-pointer hover:bg-gray-200 min-w-0"
                        onClick={() => toggleSort(col.key)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          <ArrowUpDown size={8} />
                        </div>
                      </th>
                    ))}
                    <th className="border px-1 py-1 text-left font-medium min-w-0">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: pageSize }).map((_, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        {Array.from({ length: 11 }).map((_, cellIdx) => (
                          <td key={cellIdx} className="border px-1 py-1">
                            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                          </td>
                        ))}
                        <td className="border px-1 py-1 flex gap-1">
                          <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
                          <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center py-2 text-gray-500 text-xs">
                        No products found. {search || Object.values(filters).some(f => f) ? 'Try changing your search or filters.' : ''}
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row, idx) => (
                      <tr key={row.id_product} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border px-1 py-1 truncate">{row.id_product}</td>
                        <td className="border px-1 py-1 truncate">{toTitleCase(row.product_name)}</td>
                        <td className="border px-1 py-1 truncate">{toTitleCase(row.sub_category)}</td>
                        <td className="border px-1 py-1 truncate">{toTitleCase(row.unit_kecil)}</td>
                        <td className="border px-1 py-1 truncate">{toTitleCase(row.satuan_kecil)}</td>
                        <td className="border px-1 py-1 truncate">{toTitleCase(row.unit_besar)}</td>
                        <td className="border px-1 py-1 truncate">{toTitleCase(row.satuan_besar)}</td>
                        <td className="border px-1 py-1 truncate">
                          {row.suppliers ? toTitleCase(row.suppliers.nama_supplier) : 'No Supplier'}
                        </td>
                        <td className="border px-1 py-1 truncate">{row.harga}</td>
                        <td className="border px-1 py-1 text-center">
                          <span className={`px-1 py-0.5 rounded text-xs font-semibold ${
                            row.category === 'Menu' ? 'bg-blue-100 text-blue-800' :
                            row.category === 'WIP' ? 'bg-yellow-100 text-yellow-800' :
                            row.category === 'Bahan Baku' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {row.category || 'Not Set'}
                          </span>
                        </td>
                        <td className="border px-1 py-1">
                          <div className="flex flex-wrap gap-1">
                            {row.product_branches?.filter((pb: any) => pb.branches).map((pb: any) => (
                              <span key={pb.branches.kode_branch} className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                {pb.branches.nama_branch}
                              </span>
                            )) || <span className="text-gray-400 text-xs">No branches</span>}
                          </div>
                        </td>
                        <td className="border px-1 py-1 truncate">{toTitleCase(row.merk)}</td>
                        <td className="border px-1 py-1">
                          <div className="flex gap-1">
                            {canPerformActionSync(userRole, 'product_name', 'edit') && (
                              <button 
                                onClick={() => handleEdit(row)} 
                                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                                title="Edit"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                            {canPerformActionSync(userRole, 'product_name', 'delete') && (
                              <button 
                                onClick={() => setDeleteConfirm({show: true, id: row.id_product})} 
                                className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                title="Delete"
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
          )}

          {/* Mobile List View */}
          {isMobile && mobileView === 'list' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {loading ? (
                Array.from({ length: pageSize }).map((_, idx) => (
                  <div key={idx} className="p-3 border-b border-gray-200">
                    <div className="h-4 bg-gray-200 rounded animate-pulse mb-2 w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
                  </div>
                ))
              ) : paginatedData.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No products found. {search || Object.values(filters).some(f => f) ? 'Try changing your search or filters.' : ''}
                </div>
              ) : (
                paginatedData.map((row) => (
                  <div 
                    key={row.id_product} 
                    className="p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                    onClick={() => viewProductDetails(row)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{toTitleCase(row.product_name)}</h3>
                        <p className="text-xs text-gray-600">{toTitleCase(row.sub_category)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        row.category === 'Menu' ? 'bg-blue-100 text-blue-800' :
                        row.category === 'WIP' ? 'bg-yellow-100 text-yellow-800' :
                        row.category === 'Bahan Baku' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {row.category || 'Not Set'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {row.product_branches?.filter((pb: any) => pb.branches).slice(0, 3).map((pb: any) => (
                        <span key={pb.branches.kode_branch} className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                          {pb.branches.nama_branch}
                        </span>
                      ))}
                      {row.product_branches?.length > 3 && (
                        <span className="px-1 py-0.5 bg-gray-100 text-gray-800 rounded text-xs">
                          +{row.product_branches.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
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
              <div className="flex items-center gap-1">
                <span className="text-xs">Page</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={page}
                  onChange={(e) => {
                    const newPage = Math.max(1, Math.min(totalPages, Number(e.target.value)))
                    setPage(newPage)
                  }}
                  className="w-12 px-1 py-0.5 border rounded text-xs text-center"
                />
                <span className="text-xs">of {totalPages || 1}</span>
              </div>
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