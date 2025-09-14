"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Package, ArrowRightLeft, Edit, Trash2, Plus, RefreshCw, Filter, X, Share2, Search, ChevronDown } from 'lucide-react'
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'

interface TransferBarang {
  id: number
  transfer_no: string
  cabang_peminjam_id: number
  cabang_peminjam: string
  cabang_tujuan_id: number
  cabang_tujuan: string
  id_product: number
  product_name: string
  unit_kecil: string
  jumlah: number
  harga_satuan: number
  total_harga: number
  tgl_pinjam: string
  tgl_barang_sampai?: string
  status: string
  keterangan?: string
  created_at: string
  created_by_name?: string
}

interface Branch {
  id_branch: number
  nama_branch: string
  kode_branch: string
}

interface Product {
  id_product: number
  product_name: string
  unit_kecil: string
  harga: number
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
  const [selectedValue, setSelectedValue] = useState(value)
  
  // Update internal state when external value changes
  useEffect(() => {
    setSelectedValue(value)
  }, [value])
  
  const filteredProducts = products.filter(product => 
    product.product_name.toLowerCase().includes(search.toLowerCase())
  )
  
  const selectedProduct = products.find(p => p.id_product.toString() === selectedValue.toString())
  
  const handleSelect = (productId: string) => {
    setSelectedValue(productId)
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
          {selectedProduct ? `${selectedProduct.product_name} - ${selectedProduct.unit_kecil}` : placeholder}
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
                  className={`w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0 ${
                    selectedValue === product.id_product.toString() ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="font-medium text-gray-900">{product.product_name}</div>
                  <div className="text-sm text-gray-500">{product.unit_kecil}</div>
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

export default function TransferBarangPage() {
  const [transfers, setTransfers] = useState<TransferBarang[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showFilter, setShowFilter] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [searchTransfer, setSearchTransfer] = useState('')
  const itemsPerPage = 20

  const [form, setForm] = useState({
    id: undefined as number | undefined,
    cabang_peminjam_id: '',
    cabang_tujuan_id: '',
    tgl_pinjam: new Date().toISOString().split('T')[0],
    keterangan: '',
    items: [{ id_product: '', jumlah: '', stockInfo: null as {jumlah: number, unit: string} | null }]
  })

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: number | null}>({show: false, id: null})

  useEffect(() => {
    fetchBranches()
    fetchProducts()
    fetchTransfers()
    
    const urlParams = new URLSearchParams(window.location.search)
    const searchParam = urlParams.get('search')
    if (searchParam) {
      setSearchTransfer(searchParam)
      showToast(`Searching for: ${searchParam}`, 'success')
    }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
    fetchTransfers()
  }, [selectedBranch, selectedStatus, searchTransfer])

  useEffect(() => {
    fetchTransfers()
  }, [currentPage])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id_branch, nama_branch, kode_branch')
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
        .select('id_product, product_name, unit_kecil, harga')
        .order('product_name')
      
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchTransfers = async () => {
    try {
      setLoading(true)
      
      let countQuery = supabase
        .from('v_transfer_barang')
        .select('*', { count: 'exact', head: true })
      
      if (selectedBranch) {
        countQuery = countQuery.or(`cabang_peminjam_id.eq.${selectedBranch},cabang_tujuan_id.eq.${selectedBranch}`)
      }
      if (selectedStatus) {
        countQuery = countQuery.eq('status', selectedStatus)
      }
      if (searchTransfer) {
        countQuery = countQuery.ilike('transfer_no', `%${searchTransfer}%`)
      }
      
      const { count } = await countQuery
      setTotalCount(count || 0)
      
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      let query = supabase
        .from('v_transfer_barang')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)
      
      if (selectedBranch) {
        query = query.or(`cabang_peminjam_id.eq.${selectedBranch},cabang_tujuan_id.eq.${selectedBranch}`)
      }
      if (selectedStatus) {
        query = query.eq('status', selectedStatus)
      }
      if (searchTransfer) {
        query = query.ilike('transfer_no', `%${searchTransfer}%`)
      }
      
      const { data, error } = await query
      if (error) throw error
      
      setTransfers(data || [])
    } catch (error) {
      console.error('Error fetching transfers:', error)
      showToast('Gagal memuat data transfer', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.cabang_peminjam_id || !form.cabang_tujuan_id) {
      showToast('Mohon pilih cabang asal dan tujuan', 'error')
      return
    }

    if (form.cabang_peminjam_id === form.cabang_tujuan_id) {
      showToast('Cabang asal dan tujuan tidak boleh sama', 'error')
      return
    }

    const validItems = form.items.filter(item => {
      const jumlah = parseFloat(item.jumlah || '0')
      return item.id_product && item.jumlah && !isNaN(jumlah) && jumlah > 0
    })
    
    if (validItems.length === 0) {
      showToast('Mohon tambahkan minimal 1 item', 'error')
      return
    }



    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      
      const transfersData = validItems.map(item => {
        const selectedProduct = products.find(p => p.id_product === parseInt(item.id_product))
        return {
          cabang_peminjam_id: parseInt(form.cabang_peminjam_id),
          cabang_tujuan_id: parseInt(form.cabang_tujuan_id),
          id_product: parseInt(item.id_product),
          jumlah: parseFloat(item.jumlah),
          harga_satuan: selectedProduct?.harga || 0,
          tgl_pinjam: form.tgl_pinjam,
          tgl_barang_sampai: null,
          keterangan: form.keterangan,
          created_by: user.id_user
        }
      })

      const { error } = await supabase
        .from('transfer_barang')
        .insert(transfersData)
      
      if (error) throw error
      showToast(`${validItems.length} transfer berhasil dibuat`, 'success')
      
      resetForm()
      fetchTransfers()
    } catch (error) {
      console.error('Error saving transfer:', error)
      showToast('Gagal menyimpan transfer', 'error')
    }
  }

  const handleEdit = (transfer: TransferBarang) => {
    setForm({
      id: transfer.id,
      cabang_peminjam_id: transfer.cabang_peminjam_id.toString(),
      cabang_tujuan_id: transfer.cabang_tujuan_id.toString(),
      tgl_pinjam: transfer.tgl_pinjam,
      keterangan: transfer.keterangan || '',
      items: [{ 
        id_product: transfer.id_product.toString(), 
        jumlah: transfer.jumlah.toString(), 
        stockInfo: null 
      }]
    })
    setEditing(true)
    setShowForm(true)
  }

  const recalculateGudangTotals = async (productId: number, branchCode: string, fromDate: string) => {
    try {
      const { data: records, error } = await supabase
        .from('gudang')
        .select('*')
        .eq('id_product', productId)
        .eq('cabang', branchCode)
        .gte('tanggal', fromDate)
        .order('tanggal', { ascending: true })
        .order('order_no', { ascending: true })

      if (error) throw error
      if (!records || records.length === 0) return

      const { data: lastRecord } = await supabase
        .from('gudang')
        .select('total_gudang')
        .eq('id_product', productId)
        .eq('cabang', branchCode)
        .lt('tanggal', fromDate)
        .order('tanggal', { ascending: false })
        .order('order_no', { ascending: false })
        .limit(1)

      let runningTotal = lastRecord?.[0]?.total_gudang || 0

      for (const record of records) {
        runningTotal = runningTotal + record.jumlah_masuk - record.jumlah_keluar
        
        if (runningTotal !== record.total_gudang) {
          await supabase
            .from('gudang')
            .update({ total_gudang: runningTotal })
            .eq('order_no', record.order_no)
        }
      }
    } catch (error) {
      console.error('Error recalculating gudang totals:', error)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const transfer = transfers.find(t => t.id === id)
      if (!transfer) {
        throw new Error('Transfer not found')
      }

      if (transfer.status === 'completed') {
        const peminjamBranch = branches.find(b => b.id_branch === transfer.cabang_peminjam_id)
        const tujuanBranch = branches.find(b => b.id_branch === transfer.cabang_tujuan_id)
        
        const { error: gudangError } = await supabase
          .from('gudang')
          .delete()
          .eq('source_reference', transfer.transfer_no)
        
        if (gudangError) {
          console.error('Error deleting gudang entries:', gudangError)
          throw new Error('Gagal menghapus entry gudang terkait')
        }

        if (peminjamBranch && tujuanBranch) {
          await recalculateGudangTotals(transfer.id_product, peminjamBranch.kode_branch, transfer.tgl_barang_sampai || transfer.tgl_pinjam)
          await recalculateGudangTotals(transfer.id_product, tujuanBranch.kode_branch, transfer.tgl_barang_sampai || transfer.tgl_pinjam)
        }
      }

      const { error } = await supabase
        .from('transfer_barang')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      showToast('Transfer dan entry gudang terkait berhasil dihapus', 'success')
      fetchTransfers()
    } catch (error: any) {
      console.error('Error deleting transfer:', error)
      showToast(error?.message || 'Gagal menghapus transfer', 'error')
    } finally {
      setDeleteConfirm({show: false, id: null})
    }
  }

  const handleComplete = async (transferId: number) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const transfer = transfers.find(t => t.id === transferId)
      if (!transfer) throw new Error('Transfer not found')
      
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const timestamp = today.toISOString()
      
      const peminjamBranch = branches.find(b => b.id_branch === transfer.cabang_peminjam_id)
      const tujuanBranch = branches.find(b => b.id_branch === transfer.cabang_tujuan_id)
      
      if (!peminjamBranch || !tujuanBranch) throw new Error('Branch not found')

      const { error: transferError } = await supabase
        .from('transfer_barang')
        .update({
          tgl_barang_sampai: todayStr,
          status: 'completed'
        })
        .eq('id', transferId)
      
      if (transferError) throw new Error(`Failed to update transfer: ${transferError.message}`)

      const { data: currentStock } = await supabase
        .from('gudang')
        .select('total_gudang')
        .eq('id_product', transfer.id_product)
        .eq('cabang', peminjamBranch.kode_branch)
        .lt('tanggal', timestamp)
        .order('tanggal', { ascending: false })
        .order('order_no', { ascending: false })
        .limit(1)

      const currentPeminjamStock = currentStock?.[0]?.total_gudang || 0
      const newPeminjamTotal = currentPeminjamStock - transfer.jumlah

      const { error: keluarError } = await supabase
        .from('gudang')
        .insert({
          id_product: transfer.id_product,
          cabang: peminjamBranch.kode_branch,
          tanggal: timestamp,
          jumlah_keluar: transfer.jumlah,
          jumlah_masuk: 0,
          total_gudang: newPeminjamTotal,
          nama_pengambil_barang: user.nama_lengkap || 'Transfer System',
          source_type: 'manual',
          source_reference: transfer.transfer_no,
          created_by: user.id_user || null,
          updated_by: user.id_user || null
        })
      
      if (keluarError) throw new Error(`Failed to create keluar entry: ${keluarError.message}`)

      const { data: currentTujuanStock } = await supabase
        .from('gudang')
        .select('total_gudang')
        .eq('id_product', transfer.id_product)
        .eq('cabang', tujuanBranch.kode_branch)
        .lt('tanggal', timestamp)
        .order('tanggal', { ascending: false })
        .order('order_no', { ascending: false })
        .limit(1)

      const currentTujuanStockValue = currentTujuanStock?.[0]?.total_gudang || 0
      const newTujuanTotal = currentTujuanStockValue + transfer.jumlah

      const { error: masukError } = await supabase
        .from('gudang')
        .insert({
          id_product: transfer.id_product,
          cabang: tujuanBranch.kode_branch,
          tanggal: timestamp,
          jumlah_masuk: transfer.jumlah,
          jumlah_keluar: 0,
          total_gudang: newTujuanTotal,
          nama_pengambil_barang: user.nama_lengkap || 'Transfer System',
          source_type: 'manual',
          source_reference: transfer.transfer_no,
          created_by: user.id_user || null,
          updated_by: user.id_user || null
        })
      
      if (masukError) throw new Error(`Failed to create masuk entry: ${masukError.message}`)

      await recalculateGudangTotals(transfer.id_product, peminjamBranch.kode_branch, timestamp)
      await recalculateGudangTotals(transfer.id_product, tujuanBranch.kode_branch, timestamp)

      showToast('Transfer berhasil diselesaikan dan stok telah diupdate', 'success')
      fetchTransfers()
    } catch (error: any) {
      console.error('Error completing transfer:', error)
      showToast(`Gagal menyelesaikan transfer: ${error?.message}`, 'error')
    }
  }

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { id_product: '', jumlah: '', stockInfo: null }]
    })
  }

  const removeItem = (index: number) => {
    if (form.items.length > 1) {
      const newItems = form.items.filter((_, i) => i !== index)
      setForm({ ...form, items: newItems })
    }
  }

  const updateItem = (index: number, field: string, value: string) => {
    setForm(prevForm => {
      const newItems = [...prevForm.items]
      newItems[index] = { 
        ...newItems[index], 
        [field]: value // Tidak perlu toString() karena sudah string
      }
      return { ...prevForm, items: newItems }
    })
    
    if (field === 'id_product' && value && form.cabang_peminjam_id && form.tgl_pinjam) {
      checkStock(value, form.cabang_peminjam_id, form.tgl_pinjam, index)
    }
  }

  const resetForm = () => {
    setForm({
      id: undefined,
      cabang_peminjam_id: '',
      cabang_tujuan_id: '',
      tgl_pinjam: new Date().toISOString().split('T')[0],
      keterangan: '',
      items: [{ id_product: '', jumlah: '', stockInfo: null }]
    })
    setEditing(false)
    setShowForm(false)
  }

  const checkStock = async (productId: string, branchId: string, date: string, itemIndex?: number) => {
    if (!productId || !branchId || !date) return

    try {
      const branch = branches.find(b => b.id_branch === parseInt(branchId))
      if (!branch) return

      const { data, error } = await supabase
        .from('gudang')
        .select('total_gudang')
        .eq('id_product', parseInt(productId))
        .eq('cabang', branch.kode_branch)
        .lte('tanggal', date)
        .order('tanggal', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error fetching stock:', error)
        return
      }

      const product = products.find(p => p.id_product === parseInt(productId))
      const stock = data?.[0]?.total_gudang || 0
      
      const stockInfo = {
        jumlah: stock,
        unit: product?.unit_kecil || ''
      }

      if (itemIndex !== undefined) {
        setForm(prevForm => {
          const newItems = [...prevForm.items]
          newItems[itemIndex].stockInfo = stockInfo
          return { ...prevForm, items: newItems }
        })
      }
    } catch (error) {
      console.error('Error checking stock:', error)
    }
  }

  useEffect(() => {
    if (form.cabang_peminjam_id && form.tgl_pinjam) {
      form.items.forEach((item, index) => {
        if (item.id_product) {
          checkStock(item.id_product, form.cabang_peminjam_id, form.tgl_pinjam, index)
        }
      })
    }
  }, [form.cabang_peminjam_id, form.tgl_pinjam])

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Selesai' }
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  return (
    <PageAccessControl pageName="transfer_barang">
      <Layout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Transfer Barang</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Filter className="h-4 w-4" />
                Filter
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Transfer Baru
              </button>
            </div>
          </div>

          {showFilter && (
            <div className="bg-white p-4 rounded-lg border mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transfer No</label>
                  <input
                    type="text"
                    value={searchTransfer}
                    onChange={(e) => setSearchTransfer(e.target.value)}
                    placeholder="Cari transfer number..."
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Semua Status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Selesai</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearchTransfer('')
                      setSelectedBranch('')
                      setSelectedStatus('')
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  >
                    Reset Filter
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transfer No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cabang asal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cabang Tujuan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produk</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Pinjam</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Sampai</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={9} className="px-6 py-4">
                          <div className="animate-pulse flex space-x-4">
                            <div className="flex-1 space-y-2 py-1">
                              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : transfers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                        Tidak ada data transfer
                      </td>
                    </tr>
                  ) : (
                    transfers.map((transfer) => (
                      <tr key={transfer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {transfer.transfer_no}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transfer.cabang_peminjam}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transfer.cabang_tujuan}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transfer.product_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transfer.jumlah} {transfer.unit_kecil}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(transfer.tgl_pinjam).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transfer.tgl_barang_sampai ? new Date(transfer.tgl_barang_sampai).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(transfer.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => window.open(`/transfer-barang/print/${transfer.id}`, '_blank')}
                              className="text-purple-600 hover:text-purple-900"
                              title="View/Share"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                            {transfer.status === 'pending' && (
                              <button
                                onClick={() => handleComplete(transfer.id)}
                                className="text-green-600 hover:text-green-900"
                                title="Selesai"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(transfer)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({show: true, id: transfer.id})}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
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
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editing ? 'Edit Transfer Barang' : 'Buat Transfer Barang Baru'}
                  </h2>
                  <button
                    onClick={resetForm}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Informasi Dasar Transfer */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4">Informasi Transfer</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cabang Asal *
                        </label>
                        <select
                          value={form.cabang_peminjam_id}
                          onChange={(e) => setForm({...form, cabang_peminjam_id: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          required
                        >
                          <option value="">Pilih Cabang Asal</option>
                          {branches.map(branch => (
                            <option key={branch.id_branch} value={branch.id_branch}>
                              {branch.nama_branch}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cabang Tujuan *
                        </label>
                        <select
                          value={form.cabang_tujuan_id}
                          onChange={(e) => setForm({...form, cabang_tujuan_id: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          required
                        >
                          <option value="">Pilih Cabang Tujuan</option>
                          {branches.map(branch => (
                            <option key={branch.id_branch} value={branch.id_branch}>
                              {branch.nama_branch}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tanggal Pinjam *
                        </label>
                        <input
                          type="date"
                          value={form.tgl_pinjam}
                          onChange={(e) => setForm({...form, tgl_pinjam: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Items Section */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Daftar Barang</h3>
                      <button
                        type="button"
                        onClick={addItem}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Tambah Barang
                      </button>
                    </div>
                    
                    {form.items.map((item, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-sm font-medium text-gray-700 bg-blue-100 px-3 py-1 rounded-full">
                            Barang {index + 1}
                          </span>
                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800 transition-colors p-1"
                              title="Hapus barang"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Produk *
                            </label>
                            <ProductSelect
                              key={`product-${index}-${item.id_product}`}
                              products={products}
                              value={item.id_product || ''}
                              onChange={(value) => updateItem(index, 'id_product', value)}
                              placeholder="Pilih Produk"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Jumlah *
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={item.jumlah}
                                onChange={(e) => updateItem(index, 'jumlah', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-16"
                                placeholder="0.00"
                                required
                              />
                              {item.stockInfo && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  <span className="text-sm text-gray-500">{item.stockInfo.unit}</span>
                                </div>
                              )}
                            </div>
                            {item.stockInfo && (
                              <p className={`text-xs mt-2 ${
                                (item.jumlah && parseFloat(item.jumlah) > item.stockInfo.jumlah) ? 'text-red-600' : 'text-green-600'
                              }`}>
                                Stok tersedia: {item.stockInfo.jumlah} {item.stockInfo.unit}
                                {item.jumlah && parseFloat(item.jumlah) > item.stockInfo.jumlah && ' - Stok tidak mencukupi!'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Keterangan */}
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-4">Keterangan</h3>
                    <textarea
                      value={form.keterangan}
                      onChange={(e) => setForm({...form, keterangan: e.target.value})}
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Tambahkan keterangan atau catatan mengenai transfer ini..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      {editing ? 'Update Transfer' : 'Simpan Transfer'}
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
                <p className="text-gray-600 mb-6">Apakah Anda yakin ingin menghapus transfer ini?</p>
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