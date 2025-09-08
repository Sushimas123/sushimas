'use client'

import React, { useEffect, useState, useCallback } from "react"
import { supabase } from "@/src/lib/supabaseClient"
import { Edit2, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react"
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'

export default function StockOpnameBatchPage() {
  const [batches, setBatches] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])
  const [branchProducts, setBranchProducts] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [selectedSubCategory, setSelectedSubCategory] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingBranchData, setLoadingBranchData] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null)
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null)
  const [batchDetails, setBatchDetails] = useState<any[]>([])
  const [form, setForm] = useState<any>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchBatches()
    fetchBranches()
    fetchSubCategories()
  }, [])

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("stock_opname_batch_summary")
      .select("*")
    if (!error) setBatches(data || [])
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

  const fetchSubCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("nama_product")
      .select("sub_category")
      .not("sub_category", "is", null)
      .order("sub_category")
    
    if (!error) {
      const uniqueSubCategories = [...new Set(data?.map(item => item.sub_category).filter(Boolean))]
      setSubCategories(uniqueSubCategories.map(sub => ({ sub_category: sub })))
    }
  }, [])

  const fetchBranchProducts = useCallback(async (branchCode: string, subCategory: string, soDate?: string) => {
    if (!branchCode || !subCategory) {
      setBranchProducts([])
      return
    }
    
    setLoadingBranchData(true)
    
    const { data: productsData, error: productError } = await supabase
      .from("nama_product")
      .select("id_product, product_name, unit_kecil, sub_category")
      .eq("sub_category", subCategory)
      .order("product_name")
    
    if (productError || !productsData) {
      setBranchProducts([])
      setLoadingBranchData(false)
      return
    }
    
    const productIds = productsData.map(product => product.id_product)
    const cutoffDate = soDate || selectedDate
    const cutoffDateTime = `${cutoffDate}T23:59:59.999Z`
    
    const { data: stockData } = await supabase
      .from("gudang")
      .select("id_product, total_gudang")
      .eq("cabang", branchCode)
      .in("id_product", productIds)
      .lte("tanggal", cutoffDateTime)
      .order("tanggal", { ascending: false })
      .order("order_no", { ascending: false })
    
    const stockMap = new Map()
    stockData?.forEach(stock => {
      if (!stockMap.has(stock.id_product)) {
        stockMap.set(stock.id_product, stock.total_gudang)
      }
    })
    
    const processedData = productsData.map(product => ({
      id_product: product.id_product,
      product_name: product.product_name,
      system_stock: stockMap.get(product.id_product) || 0,
      unit: product.unit_kecil || 'pcs',
      sub_category: product.sub_category,
      physical_stock: 0,
      notes: ''
    }))
    
    setBranchProducts(processedData)
    setLoadingBranchData(false)
  }, [selectedDate])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {}
    
    if (!selectedBranch) newErrors.branch_code = "Branch is required"
    if (!selectedSubCategory) newErrors.sub_category = "Sub category is required"
    if (!form.opname_date) newErrors.opname_date = "Date is required"
    if (!form.pic_name?.trim()) newErrors.pic_name = "PIC is required"
    
    const productsWithPhysicalStock = branchProducts.filter(p => p.physical_stock > 0)
    
    if (productsWithPhysicalStock.length === 0) {
      newErrors.physical_stock = "At least one product physical stock is required"
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    try {
      if (editingBatchId) {
        await supabase
          .from('stock_opname_batch')
          .update({
            batch_date: form.opname_date,
            batch_time: form.opname_time || '12:00:00',
            branch_code: selectedBranch,
            sub_category: selectedSubCategory,
            pic_name: form.pic_name.trim()
          })
          .eq('batch_id', editingBatchId)
        
        await supabase.from('stock_opname_detail').delete().eq('batch_id', editingBatchId)
        
        const details = productsWithPhysicalStock.map(product => ({
          batch_id: editingBatchId,
          product_name: product.product_name,
          system_stock: product.system_stock,
          physical_stock: product.physical_stock,
          unit: product.unit,
          notes: product.notes || null
        }))
        
        await supabase.from('stock_opname_detail').insert(details)
        showToast('✅ Batch updated', 'success')
      } else {
        const { data: batchData } = await supabase
          .from('stock_opname_batch')
          .insert({
            batch_date: form.opname_date,
            batch_time: form.opname_time || '12:00:00',
            branch_code: selectedBranch,
            sub_category: selectedSubCategory,
            pic_name: form.pic_name.trim()
          })
          .select('batch_id')
          .single()
        
        const details = productsWithPhysicalStock.map(product => ({
          batch_id: batchData.batch_id,
          product_name: product.product_name,
          system_stock: product.system_stock,
          physical_stock: product.physical_stock,
          unit: product.unit,
          notes: product.notes || null
        }))
        
        await supabase.from('stock_opname_detail').insert(details)
        showToast('✅ Batch created', 'success')
      }
      
      resetForm()
      fetchBatches()
      
    } catch (error: any) {
      showToast('❌ Failed to save batch', 'error')
    }
  }

  const resetForm = () => {
    setForm({})
    setSelectedBranch('')
    setSelectedSubCategory('')
    setBranchProducts([])
    setShowAddForm(false)
    setEditing(false)
    setEditingBatchId(null)
    setErrors({})
  }

  const handleEditBatch = async (batchId: number) => {
    try {
      const { data: batchData } = await supabase
        .from('stock_opname_batch')
        .select('*')
        .eq('batch_id', batchId)
        .single()
      
      const { data: detailData } = await supabase
        .from('stock_opname_detail')
        .select('*')
        .eq('batch_id', batchId)
      
      setForm({
        opname_date: batchData.batch_date,
        opname_time: batchData.batch_time,
        pic_name: batchData.pic_name
      })
      
      setSelectedBranch(batchData.branch_code)
      setSelectedSubCategory(batchData.sub_category)
      setEditingBatchId(batchId)
      setEditing(true)
      setShowAddForm(true)
      
      await fetchBranchProducts(batchData.branch_code, batchData.sub_category, batchData.batch_date)
      
      setTimeout(() => {
        setBranchProducts(prev => prev.map(product => {
          const detail = detailData.find(d => d.product_name === product.product_name)
          return detail ? {
            ...product,
            physical_stock: detail.physical_stock,
            notes: detail.notes
          } : product
        }))
      }, 500)
      
    } catch (error) {
      showToast('❌ Failed to load batch', 'error')
    }
  }

  const handleDeleteBatch = async (batchId: number) => {
    if (!confirm('Delete this batch?')) return
    
    try {
      await supabase.from('stock_opname_batch').delete().eq('batch_id', batchId)
      showToast('✅ Batch deleted', 'success')
      fetchBatches()
    } catch (error) {
      showToast('❌ Failed to delete batch', 'error')
    }
  }

  const handleApproveBatch = async (batchId: number) => {
    if (!confirm('Approve this batch?')) return
    
    try {
      const { data: batchData } = await supabase
        .from('stock_opname_batch')
        .select('*')
        .eq('batch_id', batchId)
        .single()
      
      const { data: detailData } = await supabase
        .from('stock_opname_detail')
        .select('*')
        .eq('batch_id', batchId)
        .gt('physical_stock', 0)
      
      for (const detail of detailData || []) {
        if (detail.difference === 0) continue
        
        const { data: productData } = await supabase
          .from('nama_product')
          .select('id_product')
          .eq('product_name', detail.product_name)
          .single()
        
        if (!productData) continue
        
        const gudangEntry = {
          id_product: productData.id_product,
          tanggal: `${batchData.batch_date}T${batchData.batch_time}`,
          jumlah_masuk: detail.difference > 0 ? Math.abs(detail.difference) : 0,
          jumlah_keluar: detail.difference < 0 ? Math.abs(detail.difference) : 0,
          total_gudang: detail.physical_stock,
          nama_pengambil_barang: `SO Batch by ${batchData.pic_name}`,
          cabang: batchData.branch_code,
          source_type: 'stock_opname_batch',
          source_reference: `BATCH-${batchId}`
        }
        
        await supabase.from('gudang').insert(gudangEntry)
        
        // Recalculate records after this SO date
        await recalculateFromDate(productData.id_product, batchData.branch_code, `${batchData.batch_date}T${batchData.batch_time}`)
      }
      
      await supabase
        .from('stock_opname_batch')
        .update({ status: 'approved' })
        .eq('batch_id', batchId)
      
      showToast('✅ Batch approved', 'success')
      fetchBatches()
      
    } catch (error) {
      showToast('❌ Failed to approve batch', 'error')
    }
  }

  const toggleBatchExpansion = async (batchId: number) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null)
      setBatchDetails([])
    } else {
      setExpandedBatch(batchId)
      
      const { data } = await supabase
        .from('stock_opname_detail')
        .select('*')
        .eq('batch_id', batchId)
        .order('product_name')
      
      setBatchDetails(data || [])
    }
  }

  const handlePhysicalStockChange = (productName: string, value: string) => {
    setBranchProducts(prev => prev.map(p => 
      p.product_name === productName 
        ? { ...p, physical_stock: parseFloat(value) || 0 }
        : p
    ))
  }

  const handleNotesChange = (productName: string, value: string) => {
    setBranchProducts(prev => prev.map(p => 
      p.product_name === productName 
        ? { ...p, notes: value }
        : p
    ))
  }

  const recalculateFromDate = async (idProduct: number, branchCode: string, fromDate: string) => {
    try {
      const { data: affectedRecords } = await supabase
        .from('gudang')
        .select('*')
        .eq('id_product', idProduct)
        .eq('cabang', branchCode)
        .gt('tanggal', fromDate)
        .order('tanggal', { ascending: true })
        .order('order_no', { ascending: true })

      if (!affectedRecords || affectedRecords.length === 0) return

      const { data: soRecord } = await supabase
        .from('gudang')
        .select('total_gudang')
        .eq('id_product', idProduct)
        .eq('cabang', branchCode)
        .eq('tanggal', fromDate)
        .eq('source_type', 'stock_opname_batch')
        .single()

      let runningTotal = soRecord?.total_gudang || 0

      for (const record of affectedRecords) {
        runningTotal = runningTotal + record.jumlah_masuk - record.jumlah_keluar
        
        await supabase
          .from('gudang')
          .update({ total_gudang: runningTotal })
          .eq('order_no', record.order_no)
      }
    } catch (error) {
      console.error('Error recalculating from date:', error)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-4">
          <div className="text-center">Loading...</div>
        </div>
      </Layout>
    )
  }

  return (
    <PageAccessControl pageName="stock_opname_batch">
      <Layout>
        <div className="p-4">
          {toast && (
            <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}>
              {toast.message}
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-2xl font-bold">📊 Stock Opname Batch</h1>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Batch
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold mb-4">
                {editing ? 'Edit Batch' : 'Add New Batch'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input
                    type="date"
                    value={form.opname_date || selectedDate}
                    onChange={(e) => setForm({...form, opname_date: e.target.value})}
                    className="w-full border px-3 py-2 rounded-md"
                  />
                  {errors.opname_date && <p className="text-red-500 text-xs mt-1">{errors.opname_date}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Time</label>
                  <input
                    type="time"
                    value={form.opname_time || '12:00'}
                    onChange={(e) => setForm({...form, opname_time: e.target.value})}
                    className="w-full border px-3 py-2 rounded-md"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Branch *</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => {
                      setSelectedBranch(e.target.value)
                      setBranchProducts([])
                      if (e.target.value && selectedSubCategory) {
                        fetchBranchProducts(e.target.value, selectedSubCategory, form.opname_date)
                      }
                    }}
                    className="w-full border px-3 py-2 rounded-md"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(branch => (
                      <option key={branch.kode_branch} value={branch.kode_branch}>
                        {branch.nama_branch}
                      </option>
                    ))}
                  </select>
                  {errors.branch_code && <p className="text-red-500 text-xs mt-1">{errors.branch_code}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Sub Category *</label>
                  <select
                    value={selectedSubCategory}
                    onChange={(e) => {
                      setSelectedSubCategory(e.target.value)
                      setBranchProducts([])
                      if (selectedBranch && e.target.value) {
                        fetchBranchProducts(selectedBranch, e.target.value, form.opname_date)
                      }
                    }}
                    className="w-full border px-3 py-2 rounded-md"
                  >
                    <option value="">Select Sub Category</option>
                    {subCategories.map(sub => (
                      <option key={sub.sub_category} value={sub.sub_category}>
                        {sub.sub_category}
                      </option>
                    ))}
                  </select>
                  {errors.sub_category && <p className="text-red-500 text-xs mt-1">{errors.sub_category}</p>}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">PIC Name *</label>
                <input
                  type="text"
                  value={form.pic_name || ''}
                  onChange={(e) => setForm({...form, pic_name: e.target.value})}
                  className="w-full border px-3 py-2 rounded-md"
                  placeholder="Person in charge"
                />
                {errors.pic_name && <p className="text-red-500 text-xs mt-1">{errors.pic_name}</p>}
              </div>

              {loadingBranchData ? (
                <div className="text-center py-4">Loading products...</div>
              ) : branchProducts.length > 0 ? (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Products ({branchProducts.length})</h4>
                  <div className="max-h-96 overflow-y-auto border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-left">System Stock</th>
                          <th className="px-3 py-2 text-left">Physical Stock</th>
                          <th className="px-3 py-2 text-left">Difference</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-left">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchProducts.map((product, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-2 font-medium">{product.product_name}</td>
                            <td className="px-3 py-2">{product.system_stock}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={product.physical_stock || ''}
                                onChange={(e) => handlePhysicalStockChange(product.product_name, e.target.value)}
                                className="w-20 border px-2 py-1 rounded text-center"
                              />
                            </td>
                            <td className={`px-3 py-2 font-medium ${
                              (product.physical_stock - product.system_stock) > 0 ? 'text-green-600' : 
                              (product.physical_stock - product.system_stock) < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {product.physical_stock ? (product.physical_stock - product.system_stock).toFixed(2) : '0.00'}
                            </td>
                            <td className="px-3 py-2">{product.unit}</td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={product.notes || ''}
                                onChange={(e) => handleNotesChange(product.product_name, e.target.value)}
                                className="w-32 border px-2 py-1 rounded text-xs"
                                placeholder="Notes"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {errors.physical_stock && <p className="text-red-500 text-xs mt-1">{errors.physical_stock}</p>}
                </div>
              ) : selectedBranch && selectedSubCategory ? (
                <div className="text-center py-4 text-gray-500">No products found</div>
              ) : null}

              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  {editing ? 'Update Batch' : 'Save Batch'}
                </button>
                <button
                  onClick={resetForm}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Batch ID</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Branch</th>
                    <th className="px-4 py-3 text-left">Sub Category</th>
                    <th className="px-4 py-3 text-left">PIC</th>
                    <th className="px-4 py-3 text-left">Products</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <React.Fragment key={batch.batch_id}>
                      <tr className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleBatchExpansion(batch.batch_id)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            {expandedBatch === batch.batch_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            BATCH-{batch.batch_id}
                          </button>
                        </td>
                        <td className="px-4 py-3">{batch.batch_date}</td>
                        <td className="px-4 py-3">{batch.nama_branch}</td>
                        <td className="px-4 py-3">{batch.sub_category}</td>
                        <td className="px-4 py-3">{batch.pic_name}</td>
                        <td className="px-4 py-3">{batch.products_counted}/{batch.total_products}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            batch.status === 'approved' ? 'bg-green-100 text-green-800' :
                            batch.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {batch.status_icon} {batch.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {batch.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleEditBatch(batch.batch_id)}
                                  className="text-blue-600 hover:text-blue-800 p-1"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteBatch(batch.batch_id)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleApproveBatch(batch.batch_id)}
                                  className="text-green-600 hover:text-green-800 p-1 text-xs px-2 py-1 border border-green-600 rounded"
                                  title="Approve"
                                >
                                  Approve
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedBatch === batch.batch_id && (
                        <tr>
                          <td colSpan={8} className="px-4 py-2 bg-gray-50">
                            <div className="max-h-64 overflow-y-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="px-2 py-1 text-left">Product</th>
                                    <th className="px-2 py-1 text-left">System</th>
                                    <th className="px-2 py-1 text-left">Physical</th>
                                    <th className="px-2 py-1 text-left">Difference</th>
                                    <th className="px-2 py-1 text-left">Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {batchDetails.map((detail) => (
                                    <tr key={detail.detail_id} className="border-t">
                                      <td className="px-2 py-1">{detail.product_name}</td>
                                      <td className="px-2 py-1">{detail.system_stock}</td>
                                      <td className="px-2 py-1">{detail.physical_stock}</td>
                                      <td className={`px-2 py-1 font-medium ${
                                        detail.difference > 0 ? 'text-green-600' : 
                                        detail.difference < 0 ? 'text-red-600' : 'text-gray-600'
                                      }`}>
                                        {detail.difference}
                                      </td>
                                      <td className="px-2 py-1">{detail.notes}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Layout>
    </PageAccessControl>
  )
}