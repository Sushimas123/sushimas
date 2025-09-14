"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Package, ArrowLeft, Save, Menu, X } from 'lucide-react'
import Layout from '../../../../components/Layout'
import PageAccessControl from '../../../../components/PageAccessControl'

interface Product {
  id_product: number
  product_name: string
  harga: number
  unit_kecil: string
  satuan_kecil: number
  unit_besar: string
  satuan_besar: number
}

interface Supplier {
  id_supplier: number
  nama_supplier: string
}

interface Branch {
  id_branch: number
  nama_branch: string
}

export default function AddBarangMasukPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    id_barang: '',
    jumlah: '',
    unit_kecil: '',
    unit_besar: '',
    satuan_kecil: '',
    satuan_besar: '',
    total_real: '',
    id_supplier: '',
    id_branch: '',
    no_po: '',
    invoice_number: '',
    keterangan: ''
  })
  
  const [poData, setPOData] = useState<any>(null)
  const [poItems, setPOItems] = useState<any[]>([])
  const [editData, setEditData] = useState<any>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchProducts(),
          fetchSuppliers(),
          fetchBranches()
        ])
        
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search)
        const poId = urlParams.get('po_id')
        const editId = urlParams.get('edit')
        
        if (editId && !isNaN(parseInt(editId))) {
          setIsEditMode(true)
          await fetchEditData(parseInt(editId))
        } else if (poId && !isNaN(parseInt(poId))) {
          await fetchPOData(parseInt(poId))
        }
      } catch (error) {
        console.error('Error loading data:', error)
        alert('Terjadi kesalahan saat memuat data')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  // Auto-calculate unit conversion when jumlah or product changes
  useEffect(() => {
    if (formData.jumlah && formData.id_barang && products.length > 0) {
      const selectedProduct = products.find(p => p.id_product === parseInt(formData.id_barang))
      if (selectedProduct && selectedProduct.satuan_kecil && selectedProduct.satuan_besar) {
        const ratio = selectedProduct.satuan_kecil / selectedProduct.satuan_besar
        const unitKecil = parseFloat(formData.jumlah) * ratio
        const roundedUnitKecil = unitKecil.toFixed(2)
        
        setFormData(prev => ({ 
          ...prev, 
          unit_kecil: roundedUnitKecil,
          total_real: roundedUnitKecil // Always update total_real to follow conversion
        }))
      }
    }
  }, [formData.jumlah, formData.id_barang, products])

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('nama_product')
      .select('id_product, product_name, harga, unit_kecil, satuan_kecil, unit_besar, satuan_besar')
      .order('product_name')
    
    if (error) throw error
    setProducts(data || [])
  }

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('id_supplier, nama_supplier')
      .order('nama_supplier')
    
    if (error) throw error
    setSuppliers(data || [])
  }

  const fetchBranches = async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('id_branch, nama_branch')
      .order('nama_branch')
    
    if (error) throw error
    setBranches(data || [])
  }
  
  const fetchPOData = async (poId: number) => {
    try {
      // Get PO data
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .maybeSingle()

      if (poError || !po) {
        throw new Error('PO tidak ditemukan')
      }

      // Get supplier name
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('nama_supplier')
        .eq('id_supplier', po.supplier_id)
        .maybeSingle()

      setPOData({
        ...po,
        supplier_name: supplier?.nama_supplier || 'Unknown'
      })

      // Get PO items
      const { data: items } = await supabase
        .from('po_items')
        .select('*')
        .eq('po_id', poId)

      if (items) {
        const itemsWithProducts = await Promise.all(
          items.map(async (item) => {
            const { data: product } = await supabase
              .from('nama_product')
              .select('product_name, harga')
              .eq('id_product', item.product_id)
              .maybeSingle()

            return {
              ...item,
              product_name: product?.product_name || 'Unknown',
              product_price: product?.harga || 0
            }
          })
        )
        setPOItems(itemsWithProducts)
      }

      // Auto-fill form data
      setFormData(prev => ({
        ...prev,
        tanggal: po.po_date.split('T')[0], // Convert to YYYY-MM-DD format
        id_supplier: po.supplier_id.toString(),
        id_branch: po.cabang_id.toString(),
        no_po: po.po_number
      }))
    } catch (error) {
      console.error('Error fetching PO data:', error)
      alert('Gagal memuat data PO')
    }
  }

  const updateGudangRecord = async (oldData: any, newData: any) => {
    try {
      // Get branch code
      const { data: branchData } = await supabase
        .from('branches')
        .select('kode_branch')
        .eq('id_branch', newData.id_branch)
        .single()
      
      if (!branchData) return
      
      const branchCode = branchData.kode_branch
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      
      // Find existing gudang record
      const { data: existingGudang } = await supabase
        .from('gudang')
        .select('*')
        .eq('id_product', oldData.id_barang)
        .eq('cabang', branchCode)
        .eq('source_type', 'PO')
        .eq('source_reference', oldData.no_po)
        .eq('tanggal', oldData.tanggal)
        .maybeSingle()
      
      if (existingGudang) {
        // Calculate new total_gudang
        const quantityDifference = newData.jumlah - oldData.jumlah
        const newTotalGudang = existingGudang.total_gudang + quantityDifference
        
        // Update gudang record
        await supabase
          .from('gudang')
          .update({
            tanggal: newData.tanggal,
            jumlah_masuk: newData.jumlah,
            total_gudang: newTotalGudang,
            nama_pengambil_barang: user.nama_lengkap || 'System',
            updated_by: user.id_user || null
          })
          .eq('order_no', existingGudang.order_no)
        
        console.log('Gudang record updated successfully')
        
        // Recalculate all affected records after this date
        await recalculateGudangTotals(newData.id_barang, branchCode, newData.tanggal)
      }
    } catch (error) {
      console.error('Error updating gudang record:', error)
    }
  }
  
  const recalculateGudangTotals = async (productId: number, branchCode: string, fromDate: string) => {
    try {
      // Get all records for this product and branch after the updated date
      const { data: affectedRecords } = await supabase
        .from('gudang')
        .select('*')
        .eq('id_product', productId)
        .eq('cabang', branchCode)
        .gte('tanggal', fromDate)
        .order('tanggal', { ascending: true })
        .order('order_no', { ascending: true })
      
      if (!affectedRecords || affectedRecords.length === 0) return
      
      // Get the baseline (last record before fromDate)
      const { data: baselineRecord } = await supabase
        .from('gudang')
        .select('total_gudang')
        .eq('id_product', productId)
        .eq('cabang', branchCode)
        .lt('tanggal', fromDate)
        .order('tanggal', { ascending: false })
        .order('order_no', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      let runningTotal = baselineRecord?.total_gudang || 0
      
      // Recalculate each affected record
      for (const record of affectedRecords) {
        if (record.is_locked) {
          runningTotal = record.total_gudang // Use locked value as checkpoint
        } else {
          runningTotal = runningTotal + record.jumlah_masuk - record.jumlah_keluar
          
          // Update if different
          if (runningTotal !== record.total_gudang) {
            await supabase
              .from('gudang')
              .update({ total_gudang: runningTotal })
              .eq('order_no', record.order_no)
          }
        }
      }
      
      console.log('Gudang totals recalculated successfully')
    } catch (error) {
      console.error('Error recalculating gudang totals:', error)
    }
  }

  const fetchEditData = async (editId: number) => {
    try {
      // Get barang masuk data
      const { data: barangMasuk, error } = await supabase
        .from('barang_masuk')
        .select('*')
        .eq('id', editId)
        .single()

      if (error || !barangMasuk) {
        throw new Error('Data barang masuk tidak ditemukan')
      }

      setEditData(barangMasuk)

      // Get product details
      const { data: product } = await supabase
        .from('nama_product')
        .select('product_name, unit_kecil, unit_besar, satuan_kecil, satuan_besar')
        .eq('id_product', barangMasuk.id_barang)
        .single()

      // Fill form with existing data
      setFormData({
        tanggal: barangMasuk.tanggal.split('T')[0], // Convert to YYYY-MM-DD format
        id_barang: barangMasuk.id_barang.toString(),
        jumlah: barangMasuk.qty_po?.toString() || barangMasuk.jumlah.toString(), // Use qty_po if available
        unit_kecil: barangMasuk.unit_kecil?.toString() || '',
        unit_besar: barangMasuk.unit_besar?.toString() || '',
        satuan_kecil: product?.unit_kecil || barangMasuk.satuan_kecil || '',
        satuan_besar: product?.unit_besar || barangMasuk.satuan_besar || '',
        total_real: barangMasuk.jumlah.toString(), // jumlah in DB is the actual received amount
        id_supplier: barangMasuk.id_supplier?.toString() || '',
        id_branch: barangMasuk.id_branch.toString(),
        no_po: barangMasuk.no_po || '',
        invoice_number: barangMasuk.invoice_number || '',
        keterangan: barangMasuk.keterangan || ''
      })

      // If there's a PO number, try to fetch PO data
      if (barangMasuk.no_po) {
        const { data: po } = await supabase
          .from('purchase_orders')
          .select('*')
          .eq('po_number', barangMasuk.no_po)
          .single()

        if (po) {
          const { data: supplier } = await supabase
            .from('suppliers')
            .select('nama_supplier')
            .eq('id_supplier', po.supplier_id)
            .single()

          setPOData({
            ...po,
            supplier_name: supplier?.nama_supplier || 'Unknown'
          })
        }
      }
    } catch (error) {
      console.error('Error fetching edit data:', error)
      alert('Gagal memuat data untuk edit')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Validation
      if (!formData.id_barang) {
        throw new Error('Barang harus dipilih')
      }
      if (!formData.jumlah || parseInt(formData.jumlah) <= 0) {
        throw new Error('Jumlah harus lebih dari 0')
      }
      if (!formData.id_branch) {
        throw new Error('Branch harus dipilih')
      }

      if (!formData.total_real || parseInt(formData.total_real) <= 0) {
        throw new Error('Total barang masuk (REAL) harus lebih dari 0')
      }

      const user = JSON.parse(localStorage.getItem('user') || '{}')
      
      const insertData = {
        tanggal: formData.tanggal,
        id_barang: parseInt(formData.id_barang),
        jumlah: formData.total_real ? parseFloat(formData.total_real) : parseFloat(formData.jumlah), // Use total_real as jumlah
        qty_po: parseFloat(formData.jumlah), // Original PO quantity
        unit_kecil: formData.unit_kecil ? parseFloat(formData.unit_kecil) : null,
        unit_besar: formData.unit_besar ? parseFloat(formData.unit_besar) : null,
        satuan_kecil: formData.satuan_kecil || null,
        satuan_besar: formData.satuan_besar || null,
        harga: 0, // Default harga to 0 since field is removed
        id_supplier: formData.id_supplier ? parseInt(formData.id_supplier) : null,
        id_branch: parseInt(formData.id_branch),
        no_po: formData.no_po || null,
        invoice_number: formData.invoice_number || null,
        keterangan: formData.keterangan || null,
        created_by: user.id_user || null
      }
      
      console.log('Inserting data:', insertData)
      
      let data, error
      
      if (isEditMode && editData) {
        // Update existing record
        const updateResult = await supabase
          .from('barang_masuk')
          .update(insertData)
          .eq('id', editData.id)
          .select()
        data = updateResult.data
        error = updateResult.error
        
        // Update corresponding gudang record if exists
        if (!error && data) {
          await updateGudangRecord(editData, insertData)
        }
      } else {
        // Insert new record
        const insertResult = await supabase
          .from('barang_masuk')
          .insert(insertData)
          .select()
        data = insertResult.data
        error = insertResult.error
      }

      console.log('Insert result:', { data, error })
      
      if (error) {
        console.error('Supabase error:', error)
        const errorMsg = error.message || error.details || 'Database error occurred'
        throw new Error(`Database error: ${errorMsg}`)
      }

      alert(isEditMode ? 'Barang masuk berhasil diupdate' : 'Barang masuk berhasil ditambahkan')
      window.location.href = '/purchaseorder/barang_masuk'
    } catch (error) {
      console.error('Error saving:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Gagal menyimpan data: ${errorMessage}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Auto-fill product details when product is selected
    if (name === 'id_barang') {
      const selectedProduct = products.find(p => p.id_product === parseInt(value))
      if (selectedProduct) {
        setFormData(prev => ({
          ...prev,
          // Simpan nama satuan dari master product
          satuan_kecil: selectedProduct.unit_kecil || '',
          satuan_besar: selectedProduct.unit_besar || ''
        }))
      }
    }
    
    // Auto-calculate unit_kecil when jumlah changes (removed unit_besar logic since it's handled in onChange)
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-4 md:p-6">
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Memuat data...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <div className="p-4 md:p-6 space-y-6">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.history.back()}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-gray-800">
                {isEditMode ? 'Edit Barang' : 'Tambah Barang'}
              </h1>
            </div>
            <button 
              type="submit"
              form="barang-masuk-form"
              disabled={submitting}
              className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 text-sm"
            >
              <Save size={16} />
              {submitting ? 'Saving...' : isEditMode ? 'Update' : 'Simpan'}
            </button>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="text-green-600" size={28} />
                {isEditMode ? 'Edit Barang Masuk' : 'Tambah Barang Masuk'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isEditMode ? 'Edit data barang masuk' : poData ? `Input barang masuk dari PO #${poData.po_number}` : 'Input data barang yang masuk ke gudang'}
              </p>
            </div>
          </div>

          {poData && poItems.length > 0 && !isEditMode && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-3">Items dari PO #{poData.po_number}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {poItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="bg-white p-3 rounded border cursor-pointer hover:bg-blue-50"
                    onClick={() => {
                      // Auto-calculate konversi dari PO item
                      const selectedProduct = products.find(p => p.id_product === item.product_id)
                      let unitKecil = 0
                      if (selectedProduct && selectedProduct.satuan_kecil && selectedProduct.satuan_besar) {
                        const ratio = selectedProduct.satuan_kecil / selectedProduct.satuan_besar
                        unitKecil = Math.round(item.qty * ratio)
                      }
                      
                      setFormData(prev => ({
                        ...prev,
                        id_barang: item.product_id.toString(),
                        jumlah: item.qty.toString(),
                        unit_besar: item.qty.toString(),
                        unit_kecil: unitKecil.toString(),
                        total_real: unitKecil.toString(),
                        satuan_kecil: selectedProduct?.unit_kecil || '',
                        satuan_besar: selectedProduct?.unit_besar || ''
                      }))
                    }}
                  >
                    <div className="font-medium text-sm">{item.product_name}</div>
                    <div className="text-xs text-gray-600">Qty: {item.qty} (satuan besar)</div>

                    {(() => {
                      const product = products.find(p => p.id_product === item.product_id)
                      if (product && product.satuan_kecil && product.satuan_besar) {
                        const ratio = product.satuan_kecil / product.satuan_besar
                        const unitKecil = Math.round(item.qty * ratio)
                        return (
                          <div className="text-xs text-blue-600">
                            = {unitKecil} {product.unit_kecil}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-700 mt-2">Klik item untuk mengisi form otomatis</p>
            </div>
          )}

          <form id="barang-masuk-form" onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 md:p-6 space-y-4 pb-20 md:pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <h3 className="font-medium text-gray-700 mb-2 border-b pb-1">Informasi Dasar</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  name="tanggal"
                  value={formData.tanggal}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  readOnly
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Tanggal mengikuti tanggal PO</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barang</label>
                <select
                  name="id_barang"
                  value={formData.id_barang}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  disabled
                >
                  <option value="">Pilih Barang</option>
                  {products.map(product => (
                    <option key={product.id_product} value={product.id_product}>
                      {product.product_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Barang tidak dapat diubah</p>
              </div>

              <div className="md:col-span-2 mt-4">
                <h3 className="font-medium text-gray-700 mb-2 border-b pb-1">Informasi Kuantitas</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Purchase Order</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="jumlah"
                    value={formData.jumlah}
                    onChange={(e) => {
                      const { name, value } = e.target
                      setFormData(prev => ({ ...prev, [name]: value, unit_besar: value }))
                      
                      // Auto-calculate unit_kecil
                      const selectedProduct = products.find(p => p.id_product === parseInt(formData.id_barang))
                      if (selectedProduct && selectedProduct.satuan_kecil && selectedProduct.satuan_besar) {
                        const ratio = selectedProduct.satuan_kecil / selectedProduct.satuan_besar
                        const unitKecil = parseFloat(value) * ratio
                        const roundedUnitKecil = unitKecil.toFixed(2)
                        setFormData(prev => ({ 
                          ...prev, 
                          unit_kecil: roundedUnitKecil,
                          total_real: roundedUnitKecil
                        }))
                      }
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                    step="0.01"
                    min="0.01"
                    required
                  />
                  <input
                    type="text"
                    value={formData.satuan_besar}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hasil Konversi
                  {(() => {
                    const selectedProduct = products.find(p => p.id_product === parseInt(formData.id_barang))
                    if (selectedProduct && selectedProduct.satuan_kecil && selectedProduct.satuan_besar) {
                      return (
                        <span className="text-xs text-blue-600 ml-2">
                          (1 {selectedProduct.unit_besar} = {selectedProduct.satuan_kecil} {selectedProduct.unit_kecil})
                        </span>
                      )
                    }
                    return null
                  })()} 
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="unit_kecil"
                    value={formData.unit_kecil}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-blue-50 font-medium"
                    readOnly
                  />
                  <input
                    type="text"
                    value={formData.satuan_kecil}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                    readOnly
                  />
                </div>
                {formData.unit_kecil && formData.satuan_kecil && (
                  <p 
                    className="text-sm text-green-600 mt-1 font-medium cursor-pointer hover:text-green-700 hover:underline"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        total_real: formData.unit_kecil
                      }))
                    }}
                    title="Klik untuk mengisi Total Barang Masuk (REAL)"
                  >
                    Total: {formData.unit_kecil} {formData.satuan_kecil} 👆
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-red-700 mb-1">Total Barang Masuk (Gudang)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="total_real"
                    value={formData.total_real}
                    onChange={handleChange}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                    min="0"
                    step="0.1"
                    required
                  />
                  <input
                    type="text"
                    value={formData.satuan_kecil}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                    readOnly
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Jumlah aktual barang yang masuk (dapat disesuaikan)</p>
              </div>

              <div className="md:col-span-2 mt-4">
                <h3 className="font-medium text-gray-700 mb-2 border-b pb-1">Informasi Lainnya</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select
                  name="id_supplier"
                  value={formData.id_supplier}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  disabled
                >
                  <option value="">Pilih Supplier (Opsional)</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id_supplier} value={supplier.id_supplier}>
                      {supplier.nama_supplier}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Supplier tidak dapat diubah</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <select
                  name="id_branch"
                  value={formData.id_branch}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                  disabled={!!poData || isEditMode}
                >
                  <option value="">Pilih Branch</option>
                  {branches.map(branch => (
                    <option key={branch.id_branch} value={branch.id_branch}>
                      {branch.nama_branch}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No PO</label>
                <input
                  type="text"
                  name="no_po"
                  value={formData.no_po}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  readOnly
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">No PO tidak dapat diubah</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                <input
                  type="text"
                  name="invoice_number"
                  value={formData.invoice_number}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  readOnly
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Invoice number tidak dapat diubah</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
              <textarea
                name="keterangan"
                value={formData.keterangan}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                rows={3}
                placeholder="Keterangan tambahan (opsional)"
              />
            </div>

            {/* Mobile Action Buttons */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-10">
              <div className="flex justify-between gap-3">
                <button 
                  type="button"
                  onClick={() => window.history.back()}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 flex-1"
                >
                  <ArrowLeft size={16} />
                  <span>Batal</span>
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 flex-1"
                >
                  <Save size={16} />
                  <span>{submitting ? 'Menyimpan...' : isEditMode ? 'Update' : 'Simpan'}</span>
                </button>
              </div>
            </div>

            {/* Desktop Action Buttons */}
            <div className="hidden md:flex justify-between pt-4">
              <a href="/purchaseorder/barang_masuk" className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <ArrowLeft size={16} />
                Kembali
              </a>
              <button 
                type="submit"
                disabled={submitting}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={16} />
                {submitting ? 'Menyimpan...' : isEditMode ? 'Update' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </PageAccessControl>
    </Layout>
  )
}