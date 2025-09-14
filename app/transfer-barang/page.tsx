"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Package, ArrowRightLeft, Edit, Trash2, Plus, RefreshCw, Filter, X, Share2, Search, ChevronDown, Menu, ChevronLeft, CheckCircle } from 'lucide-react'
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
  const [isMobile, setIsMobile] = useState(false)
  const [expandedTransfer, setExpandedTransfer] = useState<number | null>(null)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'form'>('list')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const itemsPerPage = 10

  const [form, setForm] = useState({
    id: undefined as number | undefined,
    cabang_peminjam_id: '',
    cabang_tujuan_id: '',
    id_product: '',
    jumlah: '',
    tgl_pinjam: new Date().toISOString().split('T')[0],
    keterangan: ''
  })
  const [stockInfo, setStockInfo] = useState<{jumlah: number, unit: string} | null>(null)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: number | null}>({show: false, id: null})

  // Check if device is mobile
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
    
    if (!form.cabang_peminjam_id || !form.cabang_tujuan_id || !form.id_product || !form.jumlah) {
      showToast('Mohon lengkapi semua field yang wajib', 'error')
      return
    }

    if (form.cabang_peminjam_id === form.cabang_tujuan_id) {
      showToast('Cabang peminjam dan tujuan tidak boleh sama', 'error')
      return
    }

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const selectedProduct = products.find(p => p.id_product === parseInt(form.id_product))
      
      const transferData = {
        cabang_peminjam_id: parseInt(form.cabang_peminjam_id),
        cabang_tujuan_id: parseInt(form.cabang_tujuan_id),
        id_product: parseInt(form.id_product),
        jumlah: parseFloat(form.jumlah),
        harga_satuan: selectedProduct?.harga || 0,
        tgl_pinjam: form.tgl_pinjam,
        tgl_barang_sampai: null,
        keterangan: form.keterangan,
        created_by: user.id_user
      }

      if (editing) {
        const { error } = await supabase
          .from('transfer_barang')
          .update(transferData)
          .eq('id', form.id)
        
        if (error) throw error
        showToast('Transfer berhasil diupdate', 'success')
      } else {
        const { error } = await supabase
          .from('transfer_barang')
          .insert([transferData])
        
        if (error) throw error
        showToast('Transfer berhasil dibuat', 'success')
      }
      
      resetForm()
      fetchTransfers()
      setActiveTab('list')
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
      id_product: transfer.id_product.toString(),
      jumlah: transfer.jumlah.toString(),
      tgl_pinjam: transfer.tgl_pinjam,
      keterangan: transfer.keterangan || ''
    })
    setEditing(true)
    setActiveTab('form')
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

  const resetForm = () => {
    setForm({
      id: undefined,
      cabang_peminjam_id: '',
      cabang_tujuan_id: '',
      id_product: '',
      jumlah: '',
      tgl_pinjam: new Date().toISOString().split('T')[0],
      keterangan: ''
    })
    setStockInfo(null)
    setEditing(false)
    setActiveTab('list')
  }

  const checkStock = async (productId: string, branchId: string, date: string) => {
    if (!productId || !branchId || !date) {
      setStockInfo(null)
      return
    }

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

      if (error) throw error

      const product = products.find(p => p.id_product === parseInt(productId))
      const stock = data?.[0]?.total_gudang || 0
      
      setStockInfo({
        jumlah: stock,
        unit: product?.unit_kecil || ''
      })
    } catch (error) {
      console.error('Error checking stock:', error)
      setStockInfo(null)
    }
  }

  useEffect(() => {
    if (form.id_product && form.cabang_peminjam_id && form.tgl_pinjam) {
      checkStock(form.id_product, form.cabang_peminjam_id, form.tgl_pinjam)
    }
  }, [form.id_product, form.cabang_peminjam_id, form.tgl_pinjam])

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

  // Mobile-specific components
  const MobileTransferCard = ({ transfer }: { transfer: TransferBarang }) => {
    const isExpanded = expandedTransfer === transfer.id
    
    return (
      <div className="bg-white rounded-lg border p-4 mb-3 shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-blue-600 text-sm">{transfer.transfer_no}</h3>
              {getStatusBadge(transfer.status)}
            </div>
            
            <div className="space-y-1 text-sm">
              <div className="flex">
                <span className="font-medium w-20">Dari:</span>
                <span className="flex-1 truncate">{transfer.cabang_peminjam}</span>
              </div>
              <div className="flex">
                <span className="font-medium w-20">Ke:</span>
                <span className="flex-1 truncate">{transfer.cabang_tujuan}</span>
              </div>
              <div className="flex">
                <span className="font-medium w-20">Produk:</span>
                <span className="flex-1 truncate">{transfer.product_name}</span>
              </div>
              <div className="flex">
                <span className="font-medium w-20">Jumlah:</span>
                <span className="flex-1">{transfer.jumlah} {transfer.unit_kecil}</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setExpandedTransfer(isExpanded ? null : transfer.id)}
            className="ml-2 text-gray-500"
          >
            {isExpanded ? <ChevronDown size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
        
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>
                <span className="font-medium">Tgl Pinjam:</span>
                <p>{new Date(transfer.tgl_pinjam).toLocaleDateString('id-ID')}</p>
              </div>
              <div>
                <span className="font-medium">Tgl Sampai:</span>
                <p>{transfer.tgl_barang_sampai ? new Date(transfer.tgl_barang_sampai).toLocaleDateString('id-ID') : '-'}</p>
              </div>
            </div>
            
            <div className="flex justify-between">
              <div className="flex space-x-2">
                <button
                  onClick={() => window.open(`/transfer-barang/print/${transfer.id}`, '_blank')}
                  className="p-2 bg-purple-100 text-purple-600 rounded-full"
                  title="View/Share"
                >
                  <Share2 size={16} />
                </button>
                
                {transfer.status === 'pending' && (
                  <button
                    onClick={() => handleComplete(transfer.id)}
                    className="p-2 bg-green-100 text-green-600 rounded-full"
                    title="Selesai"
                  >
                    <CheckCircle size={16} />
                  </button>
                )}
                
                <button
                  onClick={() => handleEdit(transfer)}
                  className="p-2 bg-blue-100 text-blue-600 rounded-full"
                >
                  <Edit size={16} />
                </button>
                
                <button
                  onClick={() => setDeleteConfirm({show: true, id: transfer.id})}
                  className="p-2 bg-red-100 text-red-600 rounded-full"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const MobileSearchBar = () => {
    return (
      <div className="bg-white p-3 mb-4 rounded-lg shadow-sm flex items-center sticky top-0 z-10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTransfer}
            onChange={(e) => setSearchTransfer(e.target.value)}
            placeholder="Cari transfer number..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchTransfer && (
            <button 
              onClick={() => setSearchTransfer('')} 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button 
          onClick={() => setShowMobileSearch(false)}
          className="ml-2 p-2 text-gray-600"
        >
          <X size={20} />
        </button>
      </div>
    )
  }

  const MobileFilterPanel = () => {
    return (
      <div className="fixed inset-0 bg-white z-50 p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Filter Transfer</h2>
          <button onClick={() => setShowFilter(false)} className="p-2">
            <X size={24} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
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
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              <option value="">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Selesai</option>
            </select>
          </div>
          
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
            <button
              onClick={() => {
                setSearchTransfer('')
                setSelectedBranch('')
                setSelectedStatus('')
              }}
              className="w-full mb-2 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium"
            >
              Reset Filter
            </button>
            <button
              onClick={() => setShowFilter(false)}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      </div>
    )
  }

  const MobileForm = () => {
    return (
      <div className="bg-white min-h-screen p-4">
        <div className="flex items-center mb-6">
          <button 
            onClick={() => setActiveTab('list')}
            className="p-2 mr-2"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">
            {editing ? 'Edit Transfer' : 'Transfer Baru'}
          </h1>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cabang Peminjam *
            </label>
            <select
              value={form.cabang_peminjam_id}
              onChange={(e) => setForm({...form, cabang_peminjam_id: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Pilih Cabang Peminjam</option>
              {branches.map(branch => (
                <option key={branch.id_branch} value={branch.id_branch}>
                  {branch.nama_branch}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  {branch.nama_branch}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produk *
            </label>
            <select
              value={form.id_product}
              onChange={(e) => setForm({...form, id_product: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Pilih Produk</option>
              {products.map(product => (
                <option key={product.id_product} value={product.id_product}>
                  {product.product_name} - {product.unit_kecil}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah *
            </label>
            <input
              type="number"
              step="0.01"
              value={form.jumlah}
              onChange={(e) => setForm({...form, jumlah: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            {stockInfo && (
              <p className={`text-xs mt-1 ${
                parseFloat(form.jumlah) > stockInfo.jumlah ? 'text-red-600' : 'text-green-600'
              }`}>
                Stok tersedia: {stockInfo.jumlah} {stockInfo.unit}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Pinjam *
            </label>
            <input
              type="date"
              value={form.tgl_pinjam}
              onChange={(e) => setForm({...form, tgl_pinjam: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keterangan
            </label>
            <textarea
              value={form.keterangan}
              onChange={(e) => setForm({...form, keterangan: e.target.value})}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Keterangan tambahan..."
            />
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium"
              >
                {editing ? 'Update' : 'Simpan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    )
  }

  const MobileList = () => {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Search Bar */}
        {showMobileSearch && <MobileSearchBar />}

        {/* Content */}
        <div className="p-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 mb-3 shadow-sm animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))
          ) : transfers.length === 0 ? (
            <div className="text-center py-10">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Tidak ada data transfer</p>
              <button
                onClick={() => {
                  resetForm()
                  setActiveTab('form')
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Buat Transfer Baru
              </button>
            </div>
          ) : (
            <>
              {transfers.map((transfer) => (
                <MobileTransferCard key={transfer.id} transfer={transfer} />
              ))}
              
              {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border border-gray-300 rounded disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded">
                      {currentPage}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-white border border-gray-300 rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <PageAccessControl pageName="transfer_barang">
      <Layout>
        {isMobile ? (
          <>
            {/* Mobile Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <ArrowRightLeft className="h-6 w-6 text-blue-600 mr-2" />
                  <h1 className="text-xl font-bold text-gray-900">Transfer Barang</h1>
                </div>
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 rounded-md bg-gray-100"
                >
                  {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>

            {/* Mobile Menu */}
            {showMobileMenu && (
              <div className="bg-white p-4 rounded-lg shadow mb-4 mx-4">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      resetForm()
                      setActiveTab('form')
                      setShowMobileMenu(false)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Transfer Baru
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowFilter(true)
                      setShowMobileMenu(false)
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm flex items-center gap-2"
                  >
                    <Filter size={16} />
                    Filter
                  </button>
                  
                  <button
                    onClick={() => {
                      fetchTransfers()
                      setShowMobileMenu(false)
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'list' && <MobileList />}
            {activeTab === 'form' && <MobileForm />}
            {showFilter && <MobileFilterPanel />}
          </>
        ) : (
          // Desktop view (existing code)
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

            {showForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-gray-900">
                        {editing ? 'Edit Transfer' : 'Transfer Baru'}
                      </h2>
                      <button
                        onClick={() => {
                          resetForm()
                          setShowForm(false)
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cabang Peminjam *
                          </label>
                          <select
                            value={form.cabang_peminjam_id}
                            onChange={(e) => setForm({...form, cabang_peminjam_id: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          >
                            <option value="">Pilih Cabang Peminjam</option>
                            {branches.map(branch => (
                              <option key={branch.id_branch} value={branch.id_branch}>
                                {branch.nama_branch}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cabang Tujuan *
                          </label>
                          <select
                            value={form.cabang_tujuan_id}
                            onChange={(e) => setForm({...form, cabang_tujuan_id: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Produk *
                        </label>
                        <select
                          value={form.id_product}
                          onChange={(e) => setForm({...form, id_product: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          <option value="">Pilih Produk</option>
                          {products.map(product => (
                            <option key={product.id_product} value={product.id_product}>
                              {product.product_name} - {product.unit_kecil}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Jumlah *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.jumlah}
                          onChange={(e) => setForm({...form, jumlah: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        {stockInfo && (
                          <p className={`text-xs mt-1 ${
                            parseFloat(form.jumlah) > stockInfo.jumlah ? 'text-red-600' : 'text-green-600'
                          }`}>
                            Stok tersedia: {stockInfo.jumlah} {stockInfo.unit}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tanggal Pinjam *
                        </label>
                        <input
                          type="date"
                          value={form.tgl_pinjam}
                          onChange={(e) => setForm({...form, tgl_pinjam: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Keterangan
                        </label>
                        <textarea
                          value={form.keterangan}
                          onChange={(e) => setForm({...form, keterangan: e.target.value})}
                          rows={3}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Keterangan tambahan..."
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            resetForm()
                            setShowForm(false)
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          {editing ? 'Update Transfer' : 'Simpan Transfer'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 p-4 rounded-lg shadow-lg z-50 max-w-xs ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            <div className="flex items-center">
              {toast.type === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-2" />
              ) : (
                <X className="h-5 w-5 mr-2" />
              )}
              {toast.message}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-sm w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Konfirmasi Hapus</h3>
              <p className="text-gray-600 mb-6">Apakah Anda yakin ingin menghapus transfer ini?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm({show: false, id: null})}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </PageAccessControl>
  )
}