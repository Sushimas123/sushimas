"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Plus, ShoppingCart, Search, Calendar, Building2, User, Package, Minus, Save, ArrowLeft } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'


interface Supplier {
  id_supplier: number
  nama_supplier: string
  nomor_rekening?: string
  bank_penerima?: string
  nama_penerima?: string
  termin_tempo?: number
  estimasi_pengiriman?: number
  divisi?: string
  nama_barang?: string
  merk?: string
}

interface Branch {
  id_branch: number
  nama_branch: string
}

interface Product {
  id_product: number
  product_name: string
  category: string
  sub_category: string
  unit_kecil: string
  unit_besar: string
  satuan_kecil: number
  satuan_besar: number
  harga: number
  merk: string
  stock_qty?: number
  id_supplier?: number
}

interface POItem {
  product_id: number
  product_name: string
  qty: number
  unit: string
  unit_besar: string
  satuan_besar: number
  keterangan: string
  supplier_name: string
  merk: string
}

function CreatePurchaseOrder() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [uniqueSuppliers, setUniqueSuppliers] = useState<Supplier[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [productSuppliers, setProductSuppliers] = useState<{product: Product, suppliers: Supplier[]}[]>([])
  const [loading, setLoading] = useState(true)
  const [searchProduct, setSearchProduct] = useState('')
  const [poItems, setPOItems] = useState<POItem[]>([])
  const [selectedProductSupplier, setSelectedProductSupplier] = useState<{product: Product, supplier: Supplier} | null>(null)
  const [formData, setFormData] = useState({
    supplier_id: '',
    cabang_id: '',
    po_date: new Date().toISOString().split('T')[0],
    termin_days: 30,
    notes: '',
    priority: 'biasa',
    status: 'belum di order',
    keterangan: ''
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (suppliers.length > 0) {
      fetchAllProducts()
    }
  }, [suppliers])

  useEffect(() => {
    if (searchProduct.length >= 2) {
      searchProductsWithSuppliers()
    } else {
      setProductSuppliers([])
    }
  }, [searchProduct, allProducts, suppliers])

  const fetchInitialData = async () => {
    try {
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id_supplier, nama_supplier, nomor_rekening, bank_penerima, nama_penerima, termin_tempo, estimasi_pengiriman, divisi, nama_barang, merk')
        .order('nama_supplier')

      const { data: branchesData } = await supabase
        .from('branches')
        .select('*')
        .order('nama_branch')

      // Keep all supplier records but create unique list for dropdown
      const allSuppliers = suppliersData || []
      const uniqueSuppliers = allSuppliers.filter((supplier, index, self) => 
        index === self.findIndex(s => s.nama_supplier.toLowerCase() === supplier.nama_supplier.toLowerCase())
      )

      setSuppliers(allSuppliers) // Keep all records for product lookup
      setUniqueSuppliers(uniqueSuppliers) // For dropdown display
      setBranches(branchesData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllProducts = async () => {
    try {
      const { data: products } = await supabase
        .from('nama_product')
        .select('*')
        .order('product_name')
      
      setAllProducts(products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const searchProductsWithSuppliers = () => {
    const filteredProducts = allProducts.filter(product =>
      product.product_name.toLowerCase().includes(searchProduct.toLowerCase())
    )

    const productsWithSuppliers = filteredProducts.map(product => {
      // Find suppliers that have this product in their nama_barang
      const matchingSuppliers = suppliers.filter(supplier => 
        supplier.nama_barang && 
        supplier.nama_barang.toLowerCase().includes(product.product_name.toLowerCase())
      )
      
      // Get unique suppliers
      const uniqueSuppliers = matchingSuppliers.filter((supplier, index, self) => 
        index === self.findIndex(s => s.nama_supplier.toLowerCase() === supplier.nama_supplier.toLowerCase())
      )

      return {
        product,
        suppliers: uniqueSuppliers
      }
    }).filter(item => item.suppliers.length > 0)

    setProductSuppliers(productsWithSuppliers)
  }

  const addProductToPO = (product: Product, supplier: Supplier) => {
    const existingItem = poItems.find(item => 
      item.product_id === product.id_product && 
      item.supplier_name === supplier.nama_supplier
    )
    
    if (existingItem) {
      setPOItems(poItems.map(item => 
        item.product_id === product.id_product && item.supplier_name === supplier.nama_supplier
          ? { 
              ...item, 
              qty: item.qty + 1
            }
          : item
      ))
    } else {
      const newItem: POItem = {
        product_id: product.id_product,
        product_name: product.product_name,
        qty: 1,
        unit: product.unit_kecil,
        unit_besar: product.unit_besar,
        satuan_besar: product.satuan_besar,
        keterangan: '',
        supplier_name: supplier.nama_supplier,
        merk: product.merk || ''
      }
      setPOItems([...poItems, newItem])
    }
    
    // Clear search and selection
    setSearchProduct('')
    setProductSuppliers([])
    setSelectedProductSupplier(null)
  }

  const updatePOItem = (productId: number, supplierName: string, field: string, value: number | string) => {
    setPOItems(poItems.map(item => {
      if (item.product_id === productId && item.supplier_name === supplierName) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const removePOItem = (productId: number, supplierName: string) => {
    setPOItems(poItems.filter(item => !(item.product_id === productId && item.supplier_name === supplierName)))
  }

  const groupedItems = poItems.reduce((groups, item) => {
    const supplier = item.supplier_name
    if (!groups[supplier]) {
      groups[supplier] = []
    }
    groups[supplier].push(item)
    return groups
  }, {} as Record<string, POItem[]>)

  const handleSavePO = async () => {
    try {
      // Validation
      if (!formData.cabang_id) {
        alert('Pilih cabang terlebih dahulu')
        return
      }
      
      if (poItems.length === 0) {
        alert('Tambahkan minimal satu item')
        return
      }
      
      console.log('Starting PO save...')
      
      // Generate PO number
      const poNumber = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
      
      // Group items by supplier to create separate POs
      const itemsBySupplier = poItems.reduce((groups, item) => {
        if (!groups[item.supplier_name]) {
          groups[item.supplier_name] = []
        }
        groups[item.supplier_name].push(item)
        return groups
      }, {} as Record<string, POItem[]>)

      // Create PO for each supplier
      for (const [supplierName, items] of Object.entries(itemsBySupplier)) {
        const supplier = suppliers.find(s => s.nama_supplier === supplierName)
        if (!supplier) continue
        
        const poInsertData = {
          po_number: `${poNumber}-${supplier.id_supplier}`,
          po_date: formData.po_date,
          cabang_id: parseInt(formData.cabang_id),
          supplier_id: supplier.id_supplier,
          status: 'Pending',
          priority: formData.priority,
          termin_days: supplier.termin_tempo || 30
        }

        console.log('Inserting PO data:', poInsertData)
        
        // Test database connection first
        const { data: testData, error: testError } = await supabase
          .from('purchase_orders')
          .select('id')
          .limit(1)
        
        if (testError) {
          console.error('Database connection test failed:', testError)
          throw new Error(`Database connection failed: ${testError.message}`)
        }
        
        const { data: poData, error: poError } = await supabase
          .from('purchase_orders')
          .insert(poInsertData)
          .select()
          .single()

        if (poError) {
          console.error('PO insert error details:', poError)
          console.error('Error message:', poError.message)
          console.error('Error code:', poError.code)
          console.error('Error details:', poError.details)
          throw new Error(`Failed to insert PO: ${poError.message || 'Unknown database error'}`)
        }
        
        console.log('PO created:', poData)

        // Save items for this PO
        const poItemsData = items.map(item => ({
          po_id: poData.id,
          product_id: item.product_id,
          qty: item.qty,
          unit_besar: item.unit_besar
        }))

        console.log('Inserting PO items:', poItemsData)
        
        const { error: itemsError } = await supabase
          .from('po_items')
          .insert(poItemsData)

        if (itemsError) {
          console.error('PO items insert error:', itemsError)
          console.error('Items error message:', itemsError.message)
          console.error('Items error code:', itemsError.code)
          throw new Error(`Failed to insert PO items: ${itemsError.message || 'Unknown database error'}`)
        }
      }

      console.log('All POs saved successfully, redirecting...')
      window.location.href = '/purchaseorder'
    } catch (error) {
      console.error('Error saving PO:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Gagal menyimpan PO: ${errorMessage}`)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/purchaseorder" className="text-gray-600 hover:text-gray-800">
            <ArrowLeft size={24} />
          </a>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart className="text-blue-600" size={28} />
              Buat Purchase Order Baru
            </h1>
            <p className="text-gray-600 mt-1">Buat pesanan pembelian ke supplier</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* PO Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Informasi PO</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal PO *</label>
              <input
                type="date"
                value={formData.po_date}
                onChange={(e) => setFormData({...formData, po_date: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cabang *</label>
              <select
                value={formData.cabang_id}
                onChange={(e) => setFormData({...formData, cabang_id: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">Pilih Cabang</option>
                {branches.map(branch => (
                  <option key={branch.id_branch} value={branch.id_branch}>
                    {branch.nama_branch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioritas</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="tinggi">Tinggi</option>
                <option value="sedang">Sedang</option>
                <option value="biasa">Biasa</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cari Produk</label>
              <input
                type="text"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Ketik nama produk untuk mencari..."
              />
              
              {productSuppliers.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                  {productSuppliers.map((item, index) => (
                    <div key={index} className="p-3 border-b border-gray-100 last:border-b-0">
                      <div className="font-medium text-gray-900 mb-2">
                        {item.product.product_name} - {item.product.merk || 'No Brand'}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        Tersedia di {item.suppliers.length} supplier:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.suppliers.map((supplier) => (
                          <button
                            key={supplier.id_supplier}
                            onClick={() => addProductToPO(item.product, supplier)}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200"
                          >
                            {supplier.nama_supplier}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
              <textarea
                value={formData.keterangan}
                onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={1}
                placeholder="Keterangan tambahan..."
              />
            </div>
          </div>
        </div>

        {/* Items PO */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Items PO</h3>
          {poItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package size={48} className="mx-auto mb-2 text-gray-300" />
              <p>Belum ada item yang dipilih</p>
              <p className="text-sm">Pilih supplier dan tambahkan produk</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([supplierName, items]) => {
                const supplier = suppliers.find(s => s.nama_supplier === supplierName)
                return (
                <div key={supplierName} className="border rounded-lg">
                  <div className="bg-blue-50 px-4 py-2 border-b">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-blue-800">Supplier: {supplierName}</h4>
                      <span className="text-sm text-blue-600">
                        Tempo: {supplier?.termin_tempo} hari
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-3 text-left">Produk</th>
                          <th className="p-3 text-left">Merk</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-center">Unit</th>
                          <th className="p-3 text-left">Keterangan</th>
                          <th className="p-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.product_id} className="border-b">
                            <td className="p-3">
                              <div className="font-medium">{item.product_name}</div>
                            </td>
                            <td className="p-3">
                              <div className="text-gray-600">{item.merk || 'No Brand'}</div>
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                value={item.qty}
                                onChange={(e) => updatePOItem(item.product_id, 'qty', parseInt(e.target.value) || 0)}
                                className="w-16 border rounded px-2 py-1 text-center"
                                min="1"
                              />
                            </td>
                            <td className="p-3 text-center">
                              {item.unit_besar}
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={item.keterangan}
                                onChange={(e) => updatePOItem(item.product_id, 'keterangan', e.target.value)}
                                className="w-full border rounded px-2 py-1 text-sm"
                                placeholder="Keterangan..."
                              />
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => removePOItem(item.product_id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Minus size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <a href="/purchaseorder" className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Batal
          </a>
          <button 
            onClick={handleSavePO}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            disabled={poItems.length === 0 || !formData.cabang_id}
          >
            <Save size={16} />
            Simpan PO
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CreatePurchaseOrderPage() {
  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <CreatePurchaseOrder />
      </PageAccessControl>
    </Layout>
  )
}