"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { supabase } from "@/src/lib/supabaseClient"
import { ArrowUpDown, Edit2, Trash2, Plus, RefreshCw, Search, Download, Upload, Filter, X } from "lucide-react"
import * as XLSX from 'xlsx'
import Layout from '../../components/Layout'

export default function StockOpnamePage() {
  const [data, setData] = useState<any[]>([])
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [branchProducts, setBranchProducts] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingBranchData, setLoadingBranchData] = useState(false)
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    branch: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    pic: ''
  })

  useEffect(() => {
    fetchData()
    fetchBranches()
    fetchUsers()
    
    // Check for highlight parameter in URL
    const urlParams = new URLSearchParams(window.location.search)
    const highlight = urlParams.get('highlight')
    if (highlight) {
      setHighlightId(highlight)
      // Remove highlight after 5 seconds
      setTimeout(() => setHighlightId(null), 5000)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("stock_opname")
      .select("*")
      .order("created_at", { ascending: false })
    if (!error) setData(data || [])
    setLoading(false)
  }, [])

  const fetchBranches = useCallback(async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("kode_branch, nama_branch")
      .eq("is_active", true)
      .order("nama_branch")
    if (!error) setBranches(data || [])
  }, [])

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id_user, nama_lengkap")
      .eq("is_active", true)
      .order("nama_lengkap")
    
    if (error) {
      console.error('Error fetching users:', error)
    } else {
      setUsers(data || [])
    }
  }, [])

  const fetchBranchProducts = useCallback(async (branchCode: string) => {
    if (!branchCode) {
      setBranchProducts([])
      return
    }
    
    setLoadingBranchData(true)
    
    // Get products assigned to this branch
    const { data: branchProductsData, error: branchError } = await supabase
      .from("product_branches")
      .select(`
        nama_product(
          id_product,
          product_name,
          unit_kecil
        )
      `)
      .eq("branch_code", branchCode)
    
    if (branchError) {
      console.error('Error fetching branch products:', branchError)
      setLoadingBranchData(false)
      return
    }
    
    if (!branchProductsData || branchProductsData.length === 0) {
      setBranchProducts([])
      setLoadingBranchData(false)
      return
    }
    
    // Get latest stock from gudang for each product
    const processedData = await Promise.all(
      branchProductsData.map(async (item) => {
        const { data: latestStock } = await supabase
          .from("gudang")
          .select("total_gudang")
          .eq("id_product", item.nama_product.id_product)
          .eq("cabang", branchCode)
          .order("tanggal", { ascending: false })
          .order("order_no", { ascending: false })
          .limit(1)
        
        return {
          product_name: item.nama_product.product_name,
          system_stock: latestStock?.[0]?.total_gudang || 0,
          unit: item.nama_product.unit_kecil || 'pcs'
        }
      })
    )
    
    setBranchProducts(processedData)
    setLoadingBranchData(false)
  }, [])

  const handleInput = (e: any) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === "checkbox" ? checked : value })
    
    if (name === 'branch_code') {
      setSelectedBranch(value)
      fetchBranchProducts(value)
    }
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = {...prev}
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleBranchSelect = (branchCode: string) => {
    setSelectedBranch(branchCode)
    setForm({ ...form, branch_code: branchCode })
    fetchBranchProducts(branchCode)
  }

  const handlePhysicalStockChange = (productName: string, physicalStock: string) => {
    const product = branchProducts.find(p => p.product_name === productName)
    if (product) {
      const updatedProducts = branchProducts.map(p => 
        p.product_name === productName 
          ? { ...p, physical_stock: parseFloat(physicalStock) || 0 }
          : p
      )
      setBranchProducts(updatedProducts)
    }
  }

  const handleProductNotesChange = (productName: string, notes: string) => {
    const updatedProducts = branchProducts.map(p => 
      p.product_name === productName 
        ? { ...p, notes: notes }
        : p
    )
    setBranchProducts(updatedProducts)
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {}
    
    if (!selectedBranch) {
      newErrors.branch_code = "Branch is required"
    }
    const opnameDate = form.opname_date || selectedDate
    if (!opnameDate) {
      newErrors.opname_date = "Date is required"
    }
    if (!form.pic_name?.trim()) {
      newErrors.pic_name = "PIC is required"
    }
    
    const productsWithPhysicalStock = branchProducts.filter(p => 
      p.physical_stock !== undefined && p.physical_stock !== null && p.physical_stock !== '' && p.physical_stock !== 0
    )
    
    if (productsWithPhysicalStock.length === 0) {
      newErrors.physical_stock = "At least one product physical stock is required"
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      showToast("❌ Please fix the errors in the form", "error")
      return
    }
    
    setErrors({})

    try {
      const submitData = productsWithPhysicalStock.map(product => ({
        product_name: product.product_name,
        opname_date: form.opname_date || selectedDate,
        opname_time: form.opname_time || new Date().toTimeString().split(' ')[0].substring(0,8),
        branch_code: selectedBranch,
        system_stock: parseFloat(product.system_stock) || 0,
        physical_stock: parseFloat(product.physical_stock) || 0,
        unit: product.unit,
        notes: product.notes || form.notes || null,
        pic_name: form.pic_name,
        status: 'pending'
      }))

      const { error } = await supabase
        .from("stock_opname")
        .insert(submitData)
      
      if (error) throw error
      showToast(`✅ Stock opname saved for ${submitData.length} products (Pending Approval)`, "success")
      
      setForm({})
      setSelectedBranch("")
      setBranchProducts([])
      setShowAddForm(false)
      fetchData()
    } catch (error: any) {
      console.error('Submit error:', error)
      showToast(`❌ ${error.message || 'Failed to save stock opname'}`, "error")
    }
  }

  const handleEdit = (row: any) => {
    setForm(row)
    setEditing(true)
    setShowAddForm(true)
  }

  const handleDelete = async (id: number) => {
    try {
      // Delete related gudang entries first
      const { error: gudangError } = await supabase
        .from("gudang")
        .delete()
        .eq("source_type", "stock_opname")
        .eq("source_reference", `SO-${id}`)
      
      if (gudangError) {
        console.error('Error deleting gudang entries:', gudangError)
      }
      
      // Delete SO record
      const { error } = await supabase.from("stock_opname").delete().eq("id_opname", id)
      if (error) throw error
      
      showToast("✅ Stock opname and related warehouse entries deleted", "success")
      fetchData()
    } catch (error) {
      showToast("❌ Failed to delete stock opname", "error")
    } finally {
      setDeleteConfirm({show: false, id: null})
    }
  }

  const handleApprove = async (id: number) => {
    try {
      // Get SO data first
      const { data: soData, error: soError } = await supabase
        .from("stock_opname")
        .select("*")
        .eq("id_opname", id)
        .single()
      
      if (soError) throw soError
      
      // Check if already approved
      if (soData.status === 'approved') {
        showToast("❌ Stock Opname already approved", "error")
        return
      }
      
      console.log('SO Data:', soData)
      
      // Get product id
      const { data: productData, error: productError } = await supabase
        .from("nama_product")
        .select("id_product")
        .eq("product_name", soData.product_name)
        .single()
      
      if (productError) {
        console.error('Product error:', productError)
        throw new Error(`Product not found: ${soData.product_name}`)
      }
      
      console.log('Product Data:', productData)
      
      // Insert SO adjustment entry to gudang
      const adjustment = soData.physical_stock - soData.system_stock
      console.log('Adjustment:', adjustment)
      
      const gudangEntry = {
        id_product: productData.id_product,
        tanggal: `${soData.opname_date}T${soData.opname_time || '12:00:00'}`,
        jumlah_masuk: adjustment > 0 ? Math.abs(adjustment) : 0,
        jumlah_keluar: adjustment < 0 ? Math.abs(adjustment) : 0,
        total_gudang: soData.physical_stock,
        nama_pengambil_barang: `SO Adjustment by ${soData.pic_name}`,
        cabang: soData.branch_code,
        source_type: 'stock_opname',
        source_reference: `SO-${id}`
      }
      
      console.log('Gudang Entry:', gudangEntry)
      
      const { error: gudangError } = await supabase
        .from("gudang")
        .insert(gudangEntry)
      
      if (gudangError) {
        console.error('Gudang insert error:', gudangError)
        throw gudangError
      }
      
      // Recalculate all records after this SO date
      await recalculateFromDate(productData.id_product, soData.branch_code, `${soData.opname_date}T${soData.opname_time || '12:00:00'}`)
      
      // Update SO status to approved
      const { error } = await supabase
        .from("stock_opname")
        .update({ status: 'approved' })
        .eq("id_opname", id)
      
      if (error) throw error
      showToast("✅ Stock opname approved and warehouse updated", "success")
      fetchData()
    } catch (error: any) {
      console.error('Approval error:', error)
      showToast(`❌ Failed to approve: ${error.message || 'Unknown error'}`, "error")
    }
  }
  
  const recalculateFromDate = async (idProduct: number, branchCode: string, fromDate: string) => {
    try {
      // Get all records for this product and branch from the SO date onwards
      const { data: affectedRecords } = await supabase
        .from('gudang')
        .select('*')
        .eq('id_product', idProduct)
        .eq('cabang', branchCode)
        .gt('tanggal', fromDate)
        .order('tanggal', { ascending: true })
        .order('order_no', { ascending: true })

      if (!affectedRecords || affectedRecords.length === 0) return

      // Get the SO record as starting balance
      const { data: soRecord } = await supabase
        .from('gudang')
        .select('total_gudang')
        .eq('id_product', idProduct)
        .eq('cabang', branchCode)
        .eq('tanggal', fromDate)
        .eq('source_type', 'stock_opname')
        .single()

      let runningTotal = soRecord?.total_gudang || 0

      // Recalculate all records after SO
      for (const record of affectedRecords) {
        runningTotal = runningTotal + record.jumlah_masuk - record.jumlah_keluar
        
        await supabase
          .from('gudang')
          .update({ total_gudang: runningTotal })
          .eq('uniqueid_gudang', record.uniqueid_gudang)
      }
    } catch (error) {
      console.error('Error recalculating from date:', error)
    }
  }

  const handleReject = async (id: number) => {
    try {
      const { error } = await supabase
        .from("stock_opname")
        .update({ status: 'rejected' })
        .eq("id_opname", id)
      
      if (error) throw error
      showToast("✅ Stock opname rejected", "success")
      fetchData()
    } catch (error) {
      showToast("❌ Failed to reject stock opname", "error")
    }
  }

  const exportXLSX = () => {
    if (data.length === 0) {
      showToast("❌ No data to export", "error")
      return
    }
    
    const exportData = data.map(row => ({
      Date: row.opname_date,
      Time: row.opname_time,
      Branch: row.branch_code,
      Product: row.product_name,
      'System Stock': row.system_stock,
      'Physical Stock': row.physical_stock,
      Difference: row.difference,
      Unit: row.unit,
      PIC: row.pic_name,
      Status: row.status,
      Notes: row.notes
    }))
    
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Stock Opname")
    XLSX.writeFile(wb, `stock_opname_${new Date().toISOString().split('T')[0]}.xlsx`)
    showToast("✅ Stock opname exported successfully", "success")
  }

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
            
            if (row.Date) entry.opname_date = row.Date
            if (row.Time) entry.opname_time = row.Time
            if (row.Branch) entry.branch_code = row.Branch
            if (row.Product) entry.product_name = row.Product
            if (row['System Stock']) entry.system_stock = parseFloat(row['System Stock']) || 0
            if (row['Physical Stock']) entry.physical_stock = parseFloat(row['Physical Stock']) || 0
            if (row.Unit) entry.unit = row.Unit
            if (row.PIC) entry.pic_name = row.PIC
            if (row.Status) entry.status = row.Status
            if (row.Notes) entry.notes = row.Notes
            
            return entry
          })
          .filter((entry: any) => entry.product_name && entry.branch_code)
        
        if (entries.length === 0) {
          showToast("❌ No valid data found", "error")
          return
        }
        
        // Check for duplicates and filter them out
        let insertCount = 0
        let duplicateCount = 0
        
        for (const entry of entries) {
          // Check if record already exists
          const { data: existing } = await supabase
            .from("stock_opname")
            .select("id_opname")
            .eq("product_name", entry.product_name)
            .eq("branch_code", entry.branch_code)
            .eq("opname_date", entry.opname_date)
            .single()
          
          if (existing) {
            duplicateCount++
          } else {
            const { error } = await supabase
              .from("stock_opname")
              .insert([entry])
            
            if (!error) {
              insertCount++
            }
          }
        }
        
        let message = `✅ Imported ${insertCount} new records`
        if (duplicateCount > 0) {
          message += ` (${duplicateCount} duplicates skipped)`
        }
        showToast(message, "success")
        fetchData()
        
      } catch (error) {
        showToast("❌ Failed to import Excel file", "error")
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([])
    } else {
      setSelectedItems(paginatedData.map(item => item.id_opname))
    }
    setSelectAll(!selectAll)
  }

  const handleSelectItem = (id: number) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id))
    } else {
      setSelectedItems([...selectedItems, id])
    }
  }

  const handleBulkApprove = async () => {
    if (!confirm(`Approve ${selectedItems.length} selected Stock Opname records?`)) return
    
    try {
      let approvedCount = 0
      let skippedCount = 0
      
      for (const id of selectedItems) {
        // Check if already approved before processing
        const { data: checkData } = await supabase
          .from("stock_opname")
          .select("status")
          .eq("id_opname", id)
          .single()
        
        if (checkData?.status === 'approved') {
          skippedCount++
          continue
        }
        
        await handleApprove(id)
        approvedCount++
      }
      
      setSelectedItems([])
      setSelectAll(false)
      
      let message = `✅ Approved ${approvedCount} Stock Opname records`
      if (skippedCount > 0) {
        message += ` (${skippedCount} already approved)`
      }
      showToast(message, "success")
      
    } catch (error) {
      showToast("❌ Failed to approve some records", "error")
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedItems.length} selected items?`)) return
    
    try {
      for (const id of selectedItems) {
        // Delete related gudang entries first
        const { error: gudangError } = await supabase
          .from("gudang")
          .delete()
          .eq("source_type", "stock_opname")
          .eq("source_reference", `SO-${id}`)
        
        if (gudangError) {
          console.error('Error deleting gudang entries:', gudangError)
        }
        
        // Delete SO record
        await supabase.from("stock_opname").delete().eq("id_opname", id)
      }
      
      setSelectedItems([])
      setSelectAll(false)
      showToast(`✅ Deleted ${selectedItems.length} Stock Opname records and related warehouse entries`, "success")
      fetchData()
    } catch (error) {
      showToast("❌ Failed to delete records", "error")
    }
  }

  const resetFilters = () => {
    setFilters({
      branch: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      pic: ''
    })
  }

  const toggleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const filteredData = useMemo(() => {
    let result = data.filter((row) => {
      const matchesSearch = Object.values(row).some((val) => 
        String(val).toLowerCase().includes(search.toLowerCase())
      )
      
      const matchesBranch = !filters.branch || row.branch_code === filters.branch
      const matchesStatus = !filters.status || row.status === filters.status
      const matchesPIC = !filters.pic || row.pic_name?.toLowerCase().includes(filters.pic.toLowerCase())
      
      const matchesDateFrom = !filters.dateFrom || row.opname_date >= filters.dateFrom
      const matchesDateTo = !filters.dateTo || row.opname_date <= filters.dateTo
      
      return matchesSearch && matchesBranch && matchesStatus && matchesPIC && matchesDateFrom && matchesDateTo
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

  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  return (
    <Layout>
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
              <p>Are you sure you want to delete this stock opname record?</p>
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
          <h1 className="text-xl font-bold text-gray-800">📊 Stock Opname</h1>
        </div>

        <div className="space-y-3 mb-4">
          <input
            type="text"
            placeholder="🔍 Search stock opname..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-2 py-1 rounded-md text-xs w-full sm:w-64"
          />
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Plus size={16} />
              Add New
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1 rounded-md text-xs flex items-center gap-1 ${
                showFilters ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              <Filter size={16} />
              Filters
            </button>
            {selectedItems.length > 0 && (
              <>
                <button
                  onClick={handleBulkApprove}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
                >
                  ✓ Approve ({selectedItems.length})
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
                >
                  <Trash2 size={16} />
                  Delete ({selectedItems.length})
                </button>
              </>
            )}
            <button
              onClick={exportXLSX}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Download size={16} />
              Export Excel
            </button>
            <label className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-md text-xs cursor-pointer flex items-center gap-1">
              <Upload size={16} />
              Import Excel
              <input type="file" accept=".xlsx,.xls" onChange={importXLSX} className="hidden" />
            </label>
            <button
              onClick={() => {
                fetchData()
                fetchBranches()
                fetchUsers()
                showToast("✅ Data refreshed", "success")
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm text-gray-800">Filters</h3>
              <button
                onClick={resetFilters}
                className="text-red-600 hover:text-red-800 text-xs flex items-center gap-1"
              >
                <X size={14} />
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700">Branch</label>
                <select
                  value={filters.branch}
                  onChange={(e) => setFilters({...filters, branch: e.target.value})}
                  className="border px-2 py-1 rounded-md text-xs w-full"
                >
                  <option value="">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.kode_branch} value={branch.kode_branch}>
                      {branch.nama_branch}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="border px-2 py-1 rounded-md text-xs w-full"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700">Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                  className="border px-2 py-1 rounded-md text-xs w-full"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700">Date To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                  className="border px-2 py-1 rounded-md text-xs w-full"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700">PIC</label>
                <input
                  type="text"
                  value={filters.pic}
                  onChange={(e) => setFilters({...filters, pic: e.target.value})}
                  placeholder="Search PIC..."
                  className="border px-2 py-1 rounded-md text-xs w-full"
                />
              </div>
            </div>
          </div>
        )}

        {showAddForm && (
          <div className="mt-6 bg-white p-4 shadow rounded-lg">
            <h2 className="font-semibold text-base mb-4 text-gray-800">
              📊 Stock Opname Entry
            </h2>
            
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 rounded">
              <div>
                <select
                  name="branch_code"
                  value={selectedBranch}
                  onChange={handleInput}
                  className={`border px-2 py-1 rounded-md text-xs w-full ${
                    errors.branch_code ? 'border-red-500' : ''
                  }`}
                >
                  <option value="">Select Branch</option>
                  {branches.map((branch) => (
                    <option key={branch.kode_branch} value={branch.kode_branch}>
                      {branch.nama_branch}
                    </option>
                  ))}
                </select>
                {errors.branch_code && <p className="text-red-500 text-xs mt-0.5">{errors.branch_code}</p>}
              </div>
              
              <div>
                <input
                  type="date"
                  name="opname_date"
                  value={form.opname_date || selectedDate}
                  onChange={handleInput}
                  className={`border px-2 py-1 rounded-md text-xs w-full ${
                    errors.opname_date ? 'border-red-500' : ''
                  }`}
                />
                {errors.opname_date && <p className="text-red-500 text-xs mt-0.5">{errors.opname_date}</p>}
              </div>
              
              <div>
                <input
                  type="time"
                  name="opname_time"
                  value={form.opname_time || new Date().toTimeString().split(' ')[0].substring(0,5)}
                  onChange={handleInput}
                  className="border px-2 py-1 rounded-md text-xs w-full"
                />
              </div>
              
              <div>
                <select
                  name="pic_name"
                  value={form.pic_name || ""}
                  onChange={handleInput}
                  className={`border px-2 py-1 rounded-md text-xs w-full ${
                    errors.pic_name ? 'border-red-500' : ''
                  }`}
                  required
                >
                  <option value="">Select PIC * ({users.length} users)</option>
                  {users.length === 0 ? (
                    <option value="" disabled>No users found</option>
                  ) : (
                    users.map((user) => (
                      <option key={user.id_user} value={user.nama_lengkap}>
                        {user.nama_lengkap}
                      </option>
                    ))
                  )}
                </select>
                {errors.pic_name && <p className="text-red-500 text-xs mt-0.5">{errors.pic_name}</p>}
              </div>
            </div>

            {/* Products Table */}
            {selectedBranch && (
              <div className="mb-4">
                <h3 className="font-medium text-sm mb-2">Products in {branches.find(b => b.kode_branch === selectedBranch)?.nama_branch}</h3>
                {loadingBranchData ? (
                  <div className="text-center py-4 text-gray-500">Loading products...</div>
                ) : branchProducts.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No products found in this branch</div>
                ) : (
                  <div className="overflow-x-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-2 py-1 text-left">Product Name</th>
                          <th className="border px-2 py-1 text-center">System Stock</th>
                          <th className="border px-2 py-1 text-center">Physical Stock</th>
                          <th className="border px-2 py-1 text-center">Unit</th>
                          <th className="border px-2 py-1 text-center">Difference</th>
                          <th className="border px-2 py-1 text-left">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchProducts.map((product, idx) => (
                          <tr key={product.product_name} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="border px-2 py-1">{product.product_name}</td>
                            <td className="border px-2 py-1 text-center">{product.system_stock}</td>
                            <td className="border px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                onChange={(e) => handlePhysicalStockChange(product.product_name, e.target.value)}
                                className="w-full text-center border-0 bg-transparent focus:bg-white focus:border focus:rounded px-1"
                              />
                            </td>
                            <td className="border px-2 py-1 text-center">{product.unit}</td>
                            <td className={`border px-2 py-1 text-center font-medium ${
                              product.physical_stock !== undefined 
                                ? (product.physical_stock - product.system_stock) > 0 
                                  ? 'text-green-600' 
                                  : (product.physical_stock - product.system_stock) < 0 
                                    ? 'text-red-600' 
                                    : 'text-gray-600'
                                : 'text-gray-400'
                            }`}>
                              {product.physical_stock !== undefined 
                                ? (product.physical_stock - product.system_stock).toFixed(2)
                                : '-'
                              }
                            </td>
                            <td className="border px-2 py-1">
                              <input
                                type="text"
                                placeholder="Notes..."
                                onChange={(e) => handleProductNotesChange(product.product_name, e.target.value)}
                                className="w-full border-0 bg-transparent focus:bg-white focus:border focus:rounded px-1 text-xs"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="mb-4">
              <textarea
                name="notes"
                value={form.notes || ""}
                onChange={handleInput}
                placeholder="Notes (optional)"
                rows={2}
                className="border px-2 py-1 rounded-md text-xs w-full"
              />
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={handleSubmit} 
                disabled={!selectedBranch || branchProducts.filter(p => p.physical_stock !== undefined).length === 0}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1 rounded-md text-xs"
              >
                Save Stock Opname
              </button>
              <button 
                onClick={() => {
                  setForm({})
                  setSelectedBranch("")
                  setBranchProducts([])
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
                <th className="border px-2 py-1 text-center font-medium">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="w-3 h-3"
                  />
                </th>
                {[
                  { key: "id_opname", label: "ID" },
                  { key: "opname_date", label: "Date" },
                  { key: "product_name", label: "Product" },
                  { key: "branch_code", label: "Branch" },
                  { key: "system_stock", label: "System" },
                  { key: "physical_stock", label: "Physical" },
                  { key: "difference", label: "Diff" },
                  { key: "unit", label: "Unit" },
                  { key: "pic_name", label: "PIC" },
                  { key: "status", label: "Status" }
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
                    <td className="border px-2 py-1 text-center">
                    <div className="h-3 w-3 bg-gray-200 rounded mx-auto"></div>
                  </td>
                  {Array.from({ length: 10 }).map((_, cellIdx) => (
                      <td key={cellIdx} className="border px-2 py-1">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-2 text-gray-500 text-xs">
                    No stock opname records found
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr key={row.id_opname} className={`${
                    highlightId && row.id_opname.toString() === highlightId 
                      ? "bg-yellow-100 border-2 border-yellow-400" 
                      : idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(row.id_opname)}
                        onChange={() => handleSelectItem(row.id_opname)}
                        className="w-3 h-3"
                      />
                    </td>
                    <td className="border px-2 py-1">{row.id_opname}</td>
                    <td className="border px-2 py-1">{row.opname_date}</td>
                    <td className="border px-2 py-1">{row.product_name}</td>
                    <td className="border px-2 py-1">
                      {branches.find(b => b.kode_branch === row.branch_code)?.nama_branch || row.branch_code}
                    </td>
                    <td className="border px-2 py-1 text-right">{row.system_stock}</td>
                    <td className="border px-2 py-1 text-right">{row.physical_stock}</td>
                    <td className={`border px-2 py-1 text-right font-medium ${
                      row.difference > 0 ? 'text-green-600' : 
                      row.difference < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {row.difference}
                    </td>
                    <td className="border px-2 py-1">{row.unit}</td>
                    <td className="border px-2 py-1">{row.pic_name}</td>
                    <td className="border px-2 py-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        row.status === 'approved' ? 'bg-green-100 text-green-800' :
                        row.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="border px-2 py-1">
                      <div className="flex gap-1">
                        {row.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleApprove(row.id_opname)}
                              className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 text-xs"
                              title="Approve"
                            >
                              ✓
                            </button>
                            <button 
                              onClick={() => handleReject(row.id_opname)}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 text-xs"
                              title="Reject"
                            >
                              ✗
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => handleEdit(row)} 
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({show: true, id: row.id_opname})} 
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                        >
                          <Trash2 size={12} />
                        </button>
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
    </Layout>
  )
}