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

function EditPurchaseOrder() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [uniqueSuppliers, setUniqueSuppliers] = useState<Supplier[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [supplierProducts, setSupplierProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [poItems, setPOItems] = useState<POItem[]>([])
  const [poId, setPOId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    supplier_id: '',
    cabang_id: '',
    po_date: new Date().toISOString().split('T')[0],
    termin_days: 30,
    notes: '',
    priority: 'biasa',
    status: 'belum di order'
  })

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const id = urlParams.get('id')
    if (id) {
      setPOId(parseInt(id))
      fetchPOData(parseInt(id))
    }
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (formData.supplier_id && suppliers.length > 0) {
      fetchSupplierProducts()
    } else {
      setSupplierProducts([])
    }
  }, [formData.supplier_id, suppliers])

  const fetchPOData = async (id: number) => {
    try {
      // Fetch PO data
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id)
        .single()

      if (po) {
        setFormData({
          supplier_id: po.supplier_id.toString(),
          cabang_id: po.cabang_id.toString(),
          po_date: po.po_date,
          termin_days: po.termin_days,
          notes: po.notes || '',
          priority: po.priority,
          status: po.status
        })

        // Fetch PO items
        const { data: items } = await supabase
          .from('po_items')
          .select('*')
          .eq('po_id', id)

        // Get product details for each item
        const itemsWithSupplier = await Promise.all(
          (items || []).map(async (item) => {
            const { data: product } = await supabase
              .from('nama_product')
              .select('product_name, merk, unit_besar')
              .eq('id_product', item.product_id)
              .single()

            return {
              product_id: item.product_id,
              product_name: product?.product_name || 'Unknown Product',
              qty: item.qty,
              unit: product?.unit_besar || '',
              unit_besar: item.unit_besar || product?.unit_besar || '',
              satuan_besar: 1,
              keterangan: item.keterangan || '',
              supplier_name: '',
              merk: product?.merk || ''
            }
          })
        )

        setPOItems(itemsWithSupplier)
      }
    } catch (error) {
      console.error('Error fetching PO data:', error)
    }
  }

  const fetchInitialData = async () => {
    try {
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .order('nama_supplier')

      const { data: branchesData } = await supabase
        .from('branches')
        .select('*')
        .order('nama_branch')

      const allSuppliers = suppliersData || []
      const uniqueSuppliers = allSuppliers.filter((supplier, index, self) => 
        index === self.findIndex(s => s.nama_supplier.toLowerCase() === supplier.nama_supplier.toLowerCase())
      )

      setSuppliers(allSuppliers)
      setUniqueSuppliers(uniqueSuppliers)
      setBranches(branchesData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSupplierProducts = async () => {
    try {
      const selectedSupplier = suppliers.find(s => s.id_supplier.toString() === formData.supplier_id)
      if (!selectedSupplier) {
        setSupplierProducts([])
        return
      }

      const supplierRecords = suppliers.filter(s => 
        s.nama_supplier.toLowerCase() === selectedSupplier.nama_supplier.toLowerCase()
      )
      
      const allBarang = supplierRecords
        .map(s => s.nama_barang)
        .filter(barang => barang && barang.trim())
        .map(barang => barang!.trim())
      
      if (allBarang.length === 0) {
        setSupplierProducts([])
        return
      }
      
      const productPromises = allBarang.map(async (namaBarang) => {
        const { data } = await supabase
          .from('nama_product')
          .select('*')
          .ilike('product_name', `%${namaBarang}%`)
        return data || []
      })
      
      const allProductArrays = await Promise.all(productPromises)
      const allProducts = allProductArrays.flat()
      
      const uniqueProducts = allProducts.filter((product, index, self) => 
        index === self.findIndex(p => p.id_product === product.id_product)
      )
      
      setSupplierProducts(uniqueProducts)
    } catch (error) {
      console.error('Error fetching supplier products:', error)
    }
  }

  const addProductToPO = (product: Product) => {
    const existingItem = poItems.find(item => item.product_id === product.id_product)
    
    if (existingItem) {
      setPOItems(poItems.map(item => 
        item.product_id === product.id_product 
          ? { ...item, qty: item.qty + 1 }
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
        supplier_name: selectedSupplier?.nama_supplier || '',
        merk: product.merk || ''
      }
      setPOItems([...poItems, newItem])
    }
  }

  const updatePOItem = (productId: number, field: string, value: number | string) => {
    setPOItems(poItems.map(item => {
      if (item.product_id === productId) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const removePOItem = (productId: number) => {
    setPOItems(poItems.filter(item => item.product_id !== productId))
  }

  const handleUpdatePO = async () => {
    if (!poId) return

    try {
      // Update PO (only editable fields)
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          priority: formData.priority,
          notes: formData.notes
        })
        .eq('id', poId)

      if (poError) throw poError

      // Delete existing items
      await supabase
        .from('po_items')
        .delete()
        .eq('po_id', poId)

      // Insert updated items
      const poItemsData = poItems.map(item => ({
        po_id: poId,
        product_id: item.product_id,
        qty: item.qty,
        unit_besar: item.unit_besar,
        keterangan: item.keterangan
      }))

      const { error: itemsError } = await supabase
        .from('po_items')
        .insert(poItemsData)

      if (itemsError) throw itemsError

      alert('PO berhasil diupdate!')
      window.location.href = '/purchaseorder'
    } catch (error) {
      console.error('Error updating PO:', error)
      alert('Gagal mengupdate PO')
    }
  }

  const selectedSupplier = suppliers.find(s => s.id_supplier.toString() === formData.supplier_id)
  const selectedBranch = branches.find(b => b.id_branch.toString() === formData.cabang_id)

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
              Edit Purchase Order
            </h1>
            <p className="text-gray-600 mt-1">Edit pesanan pembelian</p>
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-600"
                disabled
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cabang *</label>
              <input
                type="text"
                value={selectedBranch?.nama_branch || ''}
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-600"
                disabled
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
              <input
                type="text"
                value={selectedSupplier?.nama_supplier || ''}
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-600"
                disabled
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tempo (Hari)</label>
              <input
                type="number"
                value={formData.termin_days}
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-600"
                disabled
                readOnly
              />
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
            {formData.supplier_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tambah Produk</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  onChange={(e) => {
                    const productId = e.target.value
                    if (productId) {
                      const product = supplierProducts.find(p => p.id_product.toString() === productId)
                      if (product) {
                        addProductToPO(product)
                        e.target.value = ''
                      }
                    }
                  }}
                >
                  <option value="">Pilih produk untuk ditambahkan...</option>
                  {supplierProducts.map((product) => (
                    <option key={product.id_product} value={product.id_product}>
                      {product.product_name} - {product.merk || 'No Brand'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
              placeholder="Catatan tambahan untuk PO ini..."
            />
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
                  {poItems.map((item) => (
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
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <a href="/purchaseorder" className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Batal
          </a>
          <button 
            onClick={handleUpdatePO}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            disabled={poItems.length === 0}
          >
            <Save size={16} />
            Update PO
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EditPurchaseOrderPage() {
  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <EditPurchaseOrder />
      </PageAccessControl>
    </Layout>
  )
}