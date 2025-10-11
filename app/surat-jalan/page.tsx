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
      // Error fetching items
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

const exportToPDF = async (suratJalan: SuratJalan) => {
  try {
    const { data: items, error } = await supabase
      .from('surat_jalan_items')
      .select(`
        *,
        nama_product(product_name)
      `)
      .eq('id_surat_jalan', suratJalan.id_surat_jalan)
      .order('no_urut')

    if (error) throw error

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      throw new Error('Popup blocked. Please allow popups for this site.')
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Surat Jalan - ${suratJalan.no_surat_jalan}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px;
              max-width: 210mm;
              margin: 0 auto;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px;
              border-bottom: 3px solid #2c5aa0;
              padding-bottom: 15px;
            }
            .header h1 { 
              font-size: 28px; 
              color: #2c5aa0;
              margin-bottom: 10px;
            }
            .header h2 { 
              font-size: 18px; 
              color: #333;
              font-weight: normal;
            }
            .info-table { 
              width: 100%; 
              margin-bottom: 25px;
              border-collapse: collapse;
            }
            .info-table td { 
              padding: 10px;
              border: 1px solid #dee2e6;
            }
            .info-table td:first-child { 
              background-color: #2c5aa0;
              color: white;
              font-weight: bold;
              width: 25%;
            }
            .items-title {
              background: #2c5aa0;
              color: white;
              padding: 12px;
              margin: 20px 0 10px 0;
              font-size: 16px;
              font-weight: bold;
            }
            .items-table { 
              width: 100%; 
              border-collapse: collapse;
              border: 2px solid #2c5aa0;
            }
            .items-table th { 
              background-color: #e9ecef;
              padding: 12px;
              border: 1px solid #2c5aa0;
              text-align: center;
              font-weight: bold;
            }
            .items-table td { 
              padding: 10px;
              border: 1px solid #dee2e6;
              vertical-align: top;
            }
            .items-table tbody tr:nth-child(even) { 
              background-color: #f8f9fa;
            }
            .items-table td:nth-child(1) { text-align: center; width: 8%; }
            .items-table td:nth-child(2) { width: 42%; }
            .items-table td:nth-child(3) { text-align: center; width: 15%; }
            .items-table td:nth-child(4) { text-align: center; width: 15%; }
            .items-table td:nth-child(5) { width: 20%; }
            .signatures { 
              display: flex;
              justify-content: space-between;
              margin-top: 60px;
            }
            .signature { 
              text-align: center;
              flex: 1;
            }
            .signature-label {
              font-weight: bold;
              margin-bottom: 16px;
            }
            .signature-space {
              height: 40px;
              margin-bottom: 8px;
            }
            .signature-name {
              border-top: 2px solid #2c5aa0;
              padding-top: 8px;
              font-weight: bold;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 11px;
              color: #6c757d;
              border-top: 1px solid #dee2e6;
              padding-top: 10px;
            }
            @media print { 
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>SURAT JALAN</h1>
            <h2>No: ${suratJalan.no_surat_jalan}</h2>
          </div>
          
          <table class="info-table">
            <tr>
              <td>Tanggal</td>
              <td>${new Date(suratJalan.tanggal).toLocaleDateString('id-ID')}</td>
            </tr>
            <tr>
              <td>Cabang Tujuan</td>
              <td>${suratJalan.cabang_tujuan}</td>
            </tr>
            <tr>
              <td>Driver</td>
              <td>${suratJalan.driver}</td>
            </tr>
          </table>

          <div class="items-title">DAFTAR BARANG</div>
          <table class="items-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Barang</th>
                <th>Jumlah</th>
                <th>Satuan</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${items?.map((item: any, index: number) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.nama_product?.product_name || '-'}</td>
                  <td>${item.jumlah_barang}</td>
                  <td>${item.satuan}</td>
                  <td>${item.keterangan || '-'}</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>

          <div style="margin: 25px 0; padding: 15px; background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 6px; text-align: center;">
            <p style="font-weight: bold; font-size: 14px; color: #856404; margin: 0;">
              JANGAN LUPA! SEMUA INVOICE, BON, DAN FAKTUR PAJAK DARI SUPPLIER, DIKIRIM KE DEPOK
            </p>
          </div>

          <div class="signatures">
            <div class="signature">
              <div class="signature-label">Diterima Oleh</div>
              <div class="signature-space"></div>
              <div class="signature-name">${suratJalan.diterima_oleh || '(_________________)'}</div>
            </div>
            <div class="signature">
              <div class="signature-label">Dibuat Oleh</div>
              <div class="signature-space">
                ${suratJalan.dibuat_oleh?.toLowerCase() === 'andi' ? '<img src="/signatures/andi.png" alt="Signature" style="width: 250px; height: 40px; object-fit: contain; margin: 0 auto; display: block;" />' : ''}
              </div>
              <div class="signature-name">${suratJalan.dibuat_oleh}</div>
            </div>
            <div class="signature">
              <div class="signature-label">Disetujui Oleh</div>
              <div class="signature-space">
                ${suratJalan.disetujui_oleh?.toLowerCase() === 'andi' ? '<img src="/signatures/andi.png" alt="Signature" style="width: 250px; height: 40px; object-fit: contain; margin: 0 auto; display: block;" />' : ''}
              </div>
              <div class="signature-name">${suratJalan.disetujui_oleh}</div>
            </div>
          </div>

          <div class="footer">
            Dokumen ini dicetak secara elektronik pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}
          </div>

          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()" style="padding: 12px 24px; background: #2c5aa0; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-right: 10px;">Print PDF</button>
            <button onclick="window.close()" style="padding: 12px 24px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Close</button>
          </div>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.focus()

  } catch (error) {
    throw error
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
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterBranch, setFilterBranch] = useState<string>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const itemsPerPage = 10


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
  }, [currentPage, sortBy, sortOrder, filterBranch, filterDateFrom, filterDateTo])

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
      // Error fetching branches
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
      // Error fetching products
    }
  }

  const fetchSuratJalans = async () => {
    try {
      setLoading(true)
      
      // Check if table exists first
      const { error: countError } = await supabase
        .from('surat_jalan')
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        setTotalCount(0)
        setSuratJalans([])
        return
      }
      
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      let query = supabase
        .from('surat_jalan')
        .select(`
          *,
          branches(nama_branch),
          users!created_by(nama_lengkap)
        `, { count: 'exact' })
      
      if (filterBranch) {
        query = query.eq('cabang_tujuan_id', filterBranch)
      }
      
      if (filterDateFrom) {
        query = query.gte('tanggal', filterDateFrom)
      }
      
      if (filterDateTo) {
        query = query.lte('tanggal', filterDateTo)
      }
      
      const { data, error, count } = await query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to)
      
      if (count !== null) {
        setTotalCount(count)
      }
      
      if (error) throw error
      
      const formattedData = data?.map(item => ({
        ...item,
        cabang_tujuan: (item.branches as any)?.nama_branch || 'Unknown',
        created_by_name: (item.users as any)?.nama_lengkap || 'Unknown'
      })) || []
      
      setSuratJalans(formattedData)
    } catch (error) {
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

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
    setCurrentPage(1)
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

          <div className="bg-white rounded-lg shadow mb-4 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter Cabang
                </label>
                <select
                  value={filterBranch}
                  onChange={(e) => {
                    setFilterBranch(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Semua Cabang</option>
                  {branches.map(branch => (
                    <option key={branch.id_branch} value={branch.id_branch}>
                      {branch.nama_branch}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Dari
                </label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => {
                    setFilterDateFrom(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Sampai
                </label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => {
                    setFilterDateTo(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            {(filterBranch || filterDateFrom || filterDateTo) && (
              <div className="mt-3">
                <button
                  onClick={() => {
                    setFilterBranch('')
                    setFilterDateFrom('')
                    setFilterDateTo('')
                    setCurrentPage(1)
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Reset Filter
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('no_surat_jalan')}>
                      <div className="flex items-center gap-1">
                        No Surat Jalan
                        {sortBy === 'no_surat_jalan' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tanggal')}>
                      <div className="flex items-center gap-1">
                        Tanggal
                        {sortBy === 'tanggal' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('cabang_tujuan_id')}>
                      <div className="flex items-center gap-1">
                        Cabang Tujuan
                        {sortBy === 'cabang_tujuan_id' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('driver')}>
                      <div className="flex items-center gap-1">
                        Driver
                        {sortBy === 'driver' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('created_by')}>
                      <div className="flex items-center gap-1">
                        Created By
                        {sortBy === 'created_by' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('updated_at')}>
                      <div className="flex items-center gap-1">
                        Updated At
                        {sortBy === 'updated_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">Aksi</th>
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