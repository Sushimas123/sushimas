"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Plus, Trash2, FileText, Printer, Search, ChevronDown, X, Download, Edit } from 'lucide-react'
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'

interface SuratJalan {
  id_surat_jalan: number
  no_surat_jalan: string
  tanggal: string
  cabang_tujuan_id: number
  cabang_tujuan: string
  driver: string
  dibuat_oleh: string
  disetujui_oleh: string
  diterima_oleh?: string
  created_at: string
  created_by?: number
  updated_by?: number
  updated_at?: string
  created_by_name?: string
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

interface SuratJalanItemDetail {
  no_urut: number
  id_product: number
  product_name: string
  unit_kecil: string
  jumlah_barang: number
  keterangan: string
}

interface ProductSelectProps {
  products: Product[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function SuratJalanRow({ suratJalan, onExportPDF, onDelete, exportLoading }: {
  suratJalan: SuratJalan
  onExportPDF: (sj: SuratJalan) => void
  onDelete: (id: number) => void
  exportLoading: number | null
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchItems = async () => {
    if (items.length > 0) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('surat_jalan_items')
        .select(`
          *,
          nama_product(product_name)
        `)
        .eq('id_surat_jalan', suratJalan.id_surat_jalan)
        .order('no_urut')
      
      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded) {
      fetchItems()
    }
  }

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 text-sm font-medium text-blue-600">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className="text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
            {suratJalan.no_surat_jalan}
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-900">
          {new Date(suratJalan.tanggal).toLocaleDateString('id-ID')}
        </td>
        <td className="px-6 py-4 text-sm text-gray-900">
          {suratJalan.cabang_tujuan}
        </td>
        <td className="px-6 py-4 text-sm text-gray-900">
          {suratJalan.driver}
        </td>
        <td className="px-6 py-4 text-sm text-gray-900">
          {suratJalan.created_by_name || '-'}
        </td>
        <td className="px-6 py-4 text-sm text-gray-900">
          {suratJalan.updated_at ? new Date(suratJalan.updated_at).toLocaleDateString('id-ID') : '-'}
        </td>
        <td className="px-6 py-4 text-sm font-medium">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExportPDF(suratJalan)}
              disabled={exportLoading === suratJalan.id_surat_jalan}
              className="text-green-600 hover:text-green-900 disabled:opacity-50"
              title="Export PDF"
            >
              {exportLoading === suratJalan.id_surat_jalan ? (
                <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => window.open(`/surat-jalan/print/${suratJalan.id_surat_jalan}`, '_blank')}
              className="text-purple-600 hover:text-purple-900"
              title="Print"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={() => window.open(`/surat-jalan/edit/${suratJalan.id_surat_jalan}`, '_blank')}
              className="text-orange-600 hover:text-orange-900"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(suratJalan.id_surat_jalan)}
              className="text-red-600 hover:text-red-900"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-6 py-0">
            <div className="bg-gray-50 p-4 border-l-4 border-blue-500">
              <div className="mb-3">
                <h4 className="font-medium text-gray-900 mb-2">Items Detail ({items.length}):</h4>
              </div>
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-1">
                  {items.map((item, index) => (
                    <div key={index} className="text-sm text-gray-700">
                      {String(item.no_urut).padStart(2, '0')}. {(item.nama_product as any)?.product_name} | {item.jumlah_barang} {item.satuan} {item.keterangan && `| ${item.keterangan}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
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

// Fungsi untuk export PDF dengan html2pdf
const exportToPDF = async (suratJalan: SuratJalan) => {
  try {
    // Fetch detail items surat jalan
    const { data: items, error } = await supabase
      .from('surat_jalan_items')
      .select(`
        *,
        nama_product(product_name)
      `)
      .eq('id_surat_jalan', suratJalan.id_surat_jalan)
      .order('no_urut')

    if (error) throw error

    const itemsDetail: SuratJalanItemDetail[] = items?.map(item => ({
      no_urut: item.no_urut,
      id_product: item.id_product,
      product_name: (item.nama_product as any)?.product_name || 'Unknown',
      unit_kecil: item.satuan || '',
      jumlah_barang: item.jumlah_barang,
      keterangan: item.keterangan || ''
    })) || []

    // Create HTML content for PDF
    const content = `
      <div style="font-family: 'Arial', sans-serif; padding: 25px; max-width: 800px; margin: 0 auto;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2c5aa0; padding-bottom: 15px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #2c5aa0;">SURAT JALAN</h1>
          <h2 style="margin: 8px 0 0 0; font-size: 20px; font-weight: normal; color: #333;">No: ${suratJalan.no_surat_jalan}</h2>
        </div>

        <!-- Information Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f8f9fa; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #2c5aa0; color: white; width: 25%;">Tanggal</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; background: white;">${new Date(suratJalan.tanggal).toLocaleDateString('id-ID')}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #2c5aa0; color: white;">Cabang Tujuan</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; background: white;">${suratJalan.cabang_tujuan}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #2c5aa0; color: white;">Driver</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; background: white;">${suratJalan.driver}</td>
          </tr>
        </table>

        <!-- Items Table -->
        <div style="margin-bottom: 30px;">
          <h3 style="background: #2c5aa0; color: white; padding: 12px; margin: 0 0 15px 0; border-radius: 6px; font-size: 16px;">
            DAFTAR BARANG
          </h3>
          <table style="width: 100%; border-collapse: collapse; border: 2px solid #2c5aa0;">
            <thead>
              <tr style="background: #e9ecef;">
                <th style="padding: 12px; border: 1px solid #2c5aa0; text-align: center; font-weight: bold; width: 8%;">No</th>
                <th style="padding: 12px; border: 1px solid #2c5aa0; text-align: left; font-weight: bold; width: 42%;">Nama Barang</th>
                <th style="padding: 12px; border: 1px solid #2c5aa0; text-align: center; font-weight: bold; width: 15%;">Jumlah</th>
                <th style="padding: 12px; border: 1px solid #2c5aa0; text-align: center; font-weight: bold; width: 15%;">Satuan</th>
                <th style="padding: 12px; border: 1px solid #2c5aa0; text-align: left; font-weight: bold; width: 20%;">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${itemsDetail.map((item, index) => `
                <tr style="${index % 2 === 0 ? 'background: #f8f9fa;' : 'background: white;'}">
                  <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; vertical-align: top;">${item.no_urut}</td>
                  <td style="padding: 10px; border: 1px solid #dee2e6; vertical-align: top;">${item.product_name}</td>
                  <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; vertical-align: top;">${item.jumlah_barang}</td>
                  <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; vertical-align: top;">${item.unit_kecil}</td>
                  <td style="padding: 10px; border: 1px solid #dee2e6; vertical-align: top;">${item.keterangan}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Signatures -->
        <div style="display: flex; justify-content: space-between; margin-top: 60px;">
          <div style="text-align: center; flex: 1;">
            <div style="margin-bottom: 80px; font-weight: bold;">Dibuat Oleh,</div>
            <div style="border-top: 2px solid #2c5aa0; padding-top: 8px; font-weight: bold;">${suratJalan.dibuat_oleh}</div>
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="margin-bottom: 20px; font-weight: bold;">Disetujui Oleh,</div>
            ${suratJalan.disetujui_oleh?.toLowerCase() === 'andi' ? 
              '<div style="margin-bottom: 10px;"><img src="/signatures/andi.png" alt="Signature" style="width: 200px; height: 50px; object-fit: contain;"/></div>' : 
              '<div style="margin-bottom: 60px;"></div>'
            }
            <div style="border-top: 2px solid #2c5aa0; padding-top: 8px; font-weight: bold;">${suratJalan.disetujui_oleh}</div>
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="margin-bottom: 80px; font-weight: bold;">Diterima Oleh,</div>
            <div style="border-top: 2px solid #2c5aa0; padding-top: 8px; font-weight: bold;">${suratJalan.diterima_oleh || '(_________________)'}</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 10px;">
          Dokumen ini dicetak secara elektronik pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}
        </div>
      </div>
    `

    const element = document.createElement('div')
    element.innerHTML = content

    const options = {
      margin: [15, 15, 15, 15] as [number, number, number, number],
      filename: `surat-jalan-${suratJalan.no_surat_jalan}.pdf`,
      image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 800
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' as 'portrait'
      }
    }

    const html2pdf = (await import('html2pdf.js')).default
    html2pdf().set(options).from(element).save()

  } catch (error) {
    console.error('Error exporting to PDF:', error)
    alert('Gagal mengekspor PDF')
  }
}

export default function SuratJalanPage() {
  const [suratJalans, setSuratJalans] = useState<SuratJalan[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [exportLoading, setExportLoading] = useState<number | null>(null)
  const itemsPerPage = 20

  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    cabang_tujuan_id: '',
    driver: '',
    dibuat_oleh: '',
    disetujui_oleh: '',
    items: [{ no_urut: 1, id_product: '', jumlah_barang: '', satuan: '', keterangan: '' }] as SuratJalanItem[]
  })

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: number | null}>({show: false, id: null})

  useEffect(() => {
    fetchBranches()
    fetchProducts()
    fetchSuratJalans()
  }, [])

  useEffect(() => {
    fetchSuratJalans()
  }, [currentPage])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
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

  const fetchSuratJalans = async () => {
    try {
      setLoading(true)
      
      // Check if table exists first
      const { count, error: countError } = await supabase
        .from('surat_jalan')
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        console.log('Table surat_jalan not found, showing empty state')
        setTotalCount(0)
        setSuratJalans([])
        return
      }
      
      setTotalCount(count || 0)
      
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      const { data, error } = await supabase
        .from('surat_jalan')
        .select(`
          *,
          branches(nama_branch),
          users!created_by(nama_lengkap)
        `)
        .order('created_at', { ascending: false })
        .range(from, to)
      
      if (error) throw error
      
      const formattedData = data?.map(item => ({
        ...item,
        cabang_tujuan: (item.branches as any)?.nama_branch || 'Unknown',
        created_by_name: (item.users as any)?.nama_lengkap || 'Unknown'
      })) || []
      
      setSuratJalans(formattedData)
    } catch (error) {
      console.error('Error fetching surat jalans:', error)
      // Don't show error toast if table doesn't exist
      if (!(error as any)?.message?.includes('does not exist')) {
        showToast('Gagal memuat data surat jalan', 'error')
      }
      setSuratJalans([])
      setTotalCount(0)
    } finally {
      setLoading(false)
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

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      
      // Generate surat jalan number
      const { data: noSuratJalan, error: noError } = await supabase
        .rpc('generate_surat_jalan_number')
      
      if (noError) throw noError
      
      // Insert surat jalan
      const { data: suratJalanData, error: suratJalanError } = await supabase
        .from('surat_jalan')
        .insert({
          no_surat_jalan: noSuratJalan,
          tanggal: form.tanggal,
          cabang_tujuan_id: parseInt(form.cabang_tujuan_id),
          driver: form.driver,
          dibuat_oleh: form.dibuat_oleh,
          disetujui_oleh: form.disetujui_oleh,
          created_by: user.id_user,
          updated_by: user.id_user
        })
        .select()
        .single()
      
      if (suratJalanError) throw suratJalanError
      
      // Insert items
      const itemsData = validItems.map((item, index) => ({
        id_surat_jalan: suratJalanData.id_surat_jalan,
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
      
      showToast('Surat jalan berhasil dibuat', 'success')
      resetForm()
      fetchSuratJalans()
    } catch (error) {
      console.error('Error saving surat jalan:', error)
      showToast('Gagal menyimpan surat jalan', 'error')
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

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('surat_jalan')
        .delete()
        .eq('id_surat_jalan', id)
      
      if (error) throw error
      showToast('Surat jalan berhasil dihapus', 'success')
      fetchSuratJalans()
    } catch (error) {
      console.error('Error deleting surat jalan:', error)
      showToast('Gagal menghapus surat jalan', 'error')
    } finally {
      setDeleteConfirm({show: false, id: null})
    }
  }

  const handleExportPDF = async (suratJalan: SuratJalan) => {
    setExportLoading(suratJalan.id_surat_jalan)
    try {
      await exportToPDF(suratJalan)
      showToast('PDF berhasil diunduh', 'success')
    } catch (error) {
      showToast('Gagal mengunduh PDF', 'error')
    } finally {
      setExportLoading(null)
    }
  }

  const resetForm = () => {
    setForm({
      tanggal: new Date().toISOString().split('T')[0],
      cabang_tujuan_id: '',
      driver: '',
      dibuat_oleh: '',
      disetujui_oleh: '',
      items: [{ no_urut: 1, id_product: '', jumlah_barang: '', satuan: '', keterangan: '' }]
    })
    setShowForm(false)
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  return (
    <PageAccessControl pageName="surat-jalan">
      <Layout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Surat Jalan</h1>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Buat Surat Jalan
            </button>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No Surat Jalan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cabang Tujuan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-6 py-4">
                          <div className="animate-pulse h-4 bg-gray-200 rounded w-3/4"></div>
                        </td>
                      </tr>
                    ))
                  ) : suratJalans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        <div className="py-8">
                          <p className="mb-2">Tidak ada data surat jalan</p>
                          <p className="text-sm text-gray-400">
                            Pastikan tabel database sudah dibuat dengan menjalankan SQL dari file create-surat-jalan-simple.sql
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    suratJalans.map((sj) => (
                      <SuratJalanRow 
                        key={sj.id_surat_jalan}
                        suratJalan={sj}
                        onExportPDF={handleExportPDF}
                        onDelete={(id) => setDeleteConfirm({show: true, id})}
                        exportLoading={exportLoading}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of{' '}
                      <span className="font-medium">{totalCount}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === currentPage
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Buat Surat Jalan Baru</h2>
                  <button
                    onClick={resetForm}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

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
                      onClick={resetForm}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Simpan Surat Jalan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {deleteConfirm.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Konfirmasi Hapus</h3>
                <p className="text-gray-600 mb-6">Apakah Anda yakin ingin menghapus surat jalan ini?</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteConfirm({show: false, id: null})}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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