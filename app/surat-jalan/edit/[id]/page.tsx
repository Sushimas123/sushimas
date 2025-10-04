"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Search, ChevronDown, Save } from 'lucide-react'
import Layout from '../../../../components/Layout'
import PageAccessControl from '../../../../components/PageAccessControl'

interface SuratJalan {
  id_surat_jalan: number
  no_surat_jalan: string
  tanggal: string
  cabang_tujuan_id: number
  driver: string
  dibuat_oleh: string
  disetujui_oleh: string
  diterima_oleh?: string
}

interface Branch {
  id_branch: number
  nama_branch: string
  alamat: string
  kota: string
}

interface Product {
  id_product: number
  product_name: string
  unit_kecil: string
}

interface SuratJalanItem {
  no_urut: number
  id_product: string
  jumlah_barang: string
  satuan: string
  keterangan: string
}

interface ProductSelectProps {
  products: Product[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function ProductSelect({ products, value, onChange, placeholder = "Pilih Produk" }: ProductSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  
  const filteredProducts = products.filter(product => 
    product.product_name.toLowerCase().includes(search.toLowerCase())
  )
  
  const selectedProduct = products.find(p => p.id_product.toString() === value)
  
  const handleSelect = (productId: string) => {
    onChange(productId)
    setIsOpen(false)
    setSearch('')
  }
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between bg-white"
      >
        <span className={selectedProduct ? 'text-gray-900' : 'text-gray-500'}>
          {selectedProduct ? selectedProduct.product_name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="p-3 text-gray-500 text-center">Produk tidak ditemukan</div>
            ) : (
              filteredProducts.map(product => (
                <button
                  key={product.id_product}
                  type="button"
                  onClick={() => handleSelect(product.id_product.toString())}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 ${
                    value === product.id_product.toString() ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="font-medium text-gray-900 text-sm">{product.product_name}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setIsOpen(false)
            setSearch('')
          }}
        />
      )}
    </div>
  )
}

export default function EditSuratJalanPage() {
  const params = useParams()
  const router = useRouter()
  const [suratJalan, setSuratJalan] = useState<SuratJalan | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    tanggal: '',
    cabang_tujuan_id: '',
    driver: '',
    dibuat_oleh: '',
    disetujui_oleh: '',
    items: [] as SuratJalanItem[]
  })

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (params.id) {
      fetchSuratJalan(parseInt(params.id as string))
      fetchBranches()
      fetchProducts()
    }
  }, [params.id])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchSuratJalan = async (id: number) => {
    try {
      const { data: sjData, error: sjError } = await supabase
        .from('surat_jalan')
        .select('*')
        .eq('id_surat_jalan', id)
        .single()

      if (sjError) throw sjError

      const { data: itemsData, error: itemsError } = await supabase
        .from('surat_jalan_items')
        .select('*')
        .eq('id_surat_jalan', id)
        .order('no_urut')

      if (itemsError) throw itemsError

      setSuratJalan(sjData)
      setForm({
        tanggal: sjData.tanggal,
        cabang_tujuan_id: sjData.cabang_tujuan_id.toString(),
        driver: sjData.driver || '',
        dibuat_oleh: sjData.dibuat_oleh || '',
        disetujui_oleh: sjData.disetujui_oleh || '',
        items: itemsData.map(item => ({
          no_urut: item.no_urut,
          id_product: item.id_product.toString(),
          jumlah_barang: item.jumlah_barang.toString(),
          satuan: item.satuan || '',
          keterangan: item.keterangan || ''
        }))
      })
    } catch (error) {
      console.error('Error fetching surat jalan:', error)
      showToast('Gagal memuat data surat jalan', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id_branch, nama_branch, alamat, kota')
        .eq('is_active', true)
        .order('nama_branch')
      
      if (error) throw error
      setBranches(data || [])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('nama_product')
        .select('id_product, product_name, unit_kecil')
        .eq('is_active', true)
        .order('product_name')
      
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.cabang_tujuan_id) {
      showToast('Mohon pilih cabang tujuan', 'error')
      return
    }

    if (!form.driver || !form.dibuat_oleh || !form.disetujui_oleh) {
      showToast('Mohon lengkapi driver, dibuat oleh, dan disetujui oleh', 'error')
      return
    }

    const validItems = form.items.filter(item => 
      item.id_product && item.jumlah_barang && parseFloat(item.jumlah_barang) > 0 && item.satuan
    )
    
    if (validItems.length === 0) {
      showToast('Mohon tambahkan minimal 1 item', 'error')
      return
    }

    setSaving(true)
    try {
      // Update surat jalan
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const { error: suratJalanError } = await supabase
        .from('surat_jalan')
        .update({
          tanggal: form.tanggal,
          cabang_tujuan_id: parseInt(form.cabang_tujuan_id),
          driver: form.driver,
          dibuat_oleh: form.dibuat_oleh,
          disetujui_oleh: form.disetujui_oleh,
          updated_by: user.id_user
        })
        .eq('id_surat_jalan', suratJalan!.id_surat_jalan)
      
      if (suratJalanError) throw suratJalanError
      
      // Delete existing items
      const { error: deleteError } = await supabase
        .from('surat_jalan_items')
        .delete()
        .eq('id_surat_jalan', suratJalan!.id_surat_jalan)
      
      if (deleteError) throw deleteError
      
      // Insert updated items
      const itemsData = validItems.map((item, index) => ({
        id_surat_jalan: suratJalan!.id_surat_jalan,
        no_urut: index + 1,
        id_product: parseInt(item.id_product),
        jumlah_barang: parseFloat(item.jumlah_barang),
        satuan: item.satuan,
        keterangan: item.keterangan
      }))
      
      const { error: itemsError } = await supabase
        .from('surat_jalan_items')
        .insert(itemsData)
      
      if (itemsError) throw itemsError
      
      showToast('Surat jalan berhasil diupdate', 'success')
      setTimeout(() => router.push('/surat-jalan'), 1500)
    } catch (error) {
      console.error('Error updating surat jalan:', error)
      showToast('Gagal mengupdate surat jalan', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { 
        no_urut: form.items.length + 1, 
        id_product: '', 
        jumlah_barang: '', 
        satuan: '',
        keterangan: '' 
      }]
    })
  }

  const removeItem = (index: number) => {
    if (form.items.length > 1) {
      const newItems = form.items.filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, no_urut: i + 1 }))
      setForm({ ...form, items: newItems })
    }
  }

  const updateItem = (index: number, field: keyof SuratJalanItem, value: string) => {
    const newItems = [...form.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setForm({ ...form, items: newItems })
  }

  if (loading) {
    return (
      <PageAccessControl pageName="surat-jalan">
        <Layout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading...</p>
            </div>
          </div>
        </Layout>
      </PageAccessControl>
    )
  }

  if (!suratJalan) {
    return (
      <PageAccessControl pageName="surat-jalan">
        <Layout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-600 mb-4">Surat jalan tidak ditemukan</p>
              <button
                onClick={() => router.push('/surat-jalan')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Kembali
              </button>
            </div>
          </div>
        </Layout>
      </PageAccessControl>
    )
  }

  return (
    <PageAccessControl pageName="surat-jalan">
      <Layout>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.push('/surat-jalan')}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Edit Surat Jalan {suratJalan.no_surat_jalan}
            </h1>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal *
                  </label>
                  <input
                    type="date"
                    value={form.tanggal}
                    onChange={(e) => setForm({...form, tanggal: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cabang Tujuan *
                  </label>
                  <select
                    value={form.cabang_tujuan_id}
                    onChange={(e) => setForm({...form, cabang_tujuan_id: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Pilih Cabang Tujuan</option>
                    {branches.map(branch => (
                      <option key={branch.id_branch} value={branch.id_branch}>
                        {branch.nama_branch} - {branch.kota}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver *
                  </label>
                  <input
                    type="text"
                    value={form.driver}
                    onChange={(e) => setForm({...form, driver: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nama Driver"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dibuat Oleh *
                  </label>
                  <input
                    type="text"
                    value={form.dibuat_oleh}
                    onChange={(e) => setForm({...form, dibuat_oleh: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nama Pembuat"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Disetujui Oleh *
                  </label>
                  <input
                    type="text"
                    value={form.disetujui_oleh}
                    onChange={(e) => setForm({...form, disetujui_oleh: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nama Penyetuju"
                    required
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-semibold text-gray-800">Daftar Barang</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    <Plus className="h-3 w-3" />
                    Tambah
                  </button>
                </div>
                
                {form.items.map((item, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded p-2 mb-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-700">
                            Nama Barang *
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600 bg-blue-100 px-2 py-0.5 rounded">
                              No. {item.no_urut}
                            </span>
                            {form.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <ProductSelect
                          products={products}
                          value={item.id_product}
                          onChange={(value) => updateItem(index, 'id_product', value)}
                          placeholder="Pilih Barang"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Jumlah *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.jumlah_barang}
                          onChange={(e) => updateItem(index, 'jumlah_barang', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Satuan *
                        </label>
                        <input
                          type="text"
                          value={item.satuan}
                          onChange={(e) => updateItem(index, 'satuan', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          placeholder="pcs, kg, box"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Keterangan
                        </label>
                        <input
                          type="text"
                          value={item.keterangan}
                          onChange={(e) => updateItem(index, 'keterangan', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          placeholder="Keterangan"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.push('/surat-jalan')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Menyimpan...' : 'Update Surat Jalan'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {toast && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {toast.message}
          </div>
        )}
      </Layout>
    </PageAccessControl>
  )
}