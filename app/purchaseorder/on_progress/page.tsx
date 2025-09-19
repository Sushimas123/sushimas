"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { CheckCircle, XCircle, Package, Building2, Calendar, User, FileText, Download, ArrowLeft, Printer, Clock, AlertCircle, Edit, Save, X } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

interface POData {
  id: number
  po_number: string
  po_date: string
  cabang_id: number
  supplier_id: number
  status: string
  priority: string
  termin_days: number
  notes: string
  keterangan: string
  created_at: string
}

interface POItem {
  id: number
  po_id: number
  product_id: number
  product_name: string
  qty: number
  unit_besar: string
  keterangan: string
  merk: string
  stock_qty: number
  harga?: number
  total?: number
}

interface Branch {
  id_branch: number
  nama_branch: string
  alamat?: string
  pic?: string
  pic_id?: number
  kota?: string
  provinsi?: string
  telp?: string
  email?: string
  created_by?: number
  updated_by?: number
  created_by_name?: string
  updated_by_name?: string
  users?: { name: string }
}

interface Supplier {
  id_supplier: number
  nama_supplier: string
  alamat?: string
  telp?: string
  email?: string
  termin_tempo?: number
}

function OnProgressPO() {
  const [poData, setPOData] = useState<POData | null>(null)
  const [poItems, setPOItems] = useState<POItem[]>([])
  const [branch, setBranch] = useState<Branch | null>(null)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingItems, setEditingItems] = useState<{[key: number]: boolean}>({})

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const poId = urlParams.get('id')
    if (poId) {
      fetchPOData(parseInt(poId))
    }
  }, [])

  const fetchPOData = async (poId: number) => {
    try {
      // Fetch PO data
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single()

      if (po) {
        setPOData(po)

        // Fetch PO items
        const { data: items } = await supabase
          .from('po_items')
          .select('*, harga, total')
          .eq('po_id', poId)

        // Get product details and stock data for each item
        const itemsWithStock = await Promise.all(
          (items || []).map(async (item) => {
            // Get product details
            const { data: product } = await supabase
              .from('nama_product')
              .select('product_name, merk')
              .eq('id_product', item.product_id)
              .single()

            // Get stock data
            const { data: stockData } = await supabase
              .from('gudang')
              .select('stock_qty')
              .eq('id_product', item.product_id)
              .eq('id_branch', po.cabang_id)
              .single()

            return {
              ...item,
              product_name: product?.product_name || 'Unknown Product',
              merk: product?.merk || '',
              stock_qty: stockData?.stock_qty || 0,
              harga: item.harga || 0,
              total: item.total || 0
            }
          })
        )

        setPOItems(itemsWithStock)

        // Fetch branch data
        const { data: branchData } = await supabase
          .from('branches')
          .select('*')
          .eq('id_branch', po.cabang_id)
          .single()

        // Fetch PIC name from users table
        let picName = 'PIC Tidak Ditemukan'
        if (branchData?.pic_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('nama_lengkap')
            .eq('id_user', branchData.pic_id)
            .single()
          
          picName = userData?.nama_lengkap || 'PIC Tidak Ditemukan'
        }

        // Setelah mengambil data branch, tambahkan query untuk mendapatkan informasi created_by dan updated_by
        if (branchData) {
          let createdByName = 'System'
          let updatedByName = 'System'
          
          // Get created_by name
          if (branchData.created_by) {
            const { data: createdByUser } = await supabase
              .from('users')
              .select('nama_lengkap')
              .eq('id_user', branchData.created_by)
              .single()
            createdByName = createdByUser?.nama_lengkap || 'System'
          }
          
          // Get updated_by name
          if (branchData.updated_by) {
            const { data: updatedByUser } = await supabase
              .from('users')
              .select('nama_lengkap')
              .eq('id_user', branchData.updated_by)
              .single()
            updatedByName = updatedByUser?.nama_lengkap || 'System'
          }
          
          // Set branch data dengan semua informasi
          setBranch({ 
            ...branchData, 
            pic: picName,
            created_by_name: createdByName,
            updated_by_name: updatedByName
          })
        }

        // Fetch supplier data
        console.log('Fetching supplier with ID:', po.supplier_id)
        const { data: supplierData, error: supplierError } = await supabase
          .from('suppliers')
          .select('id_supplier, nama_supplier, nomor_rekening, bank_penerima, nama_penerima, termin_tempo, estimasi_pengiriman, divisi')
          .eq('id_supplier', po.supplier_id)
          .single()

        if (supplierError) {
          console.error('Supplier fetch error:', supplierError)
        }
        console.log('Supplier data:', supplierData)
        setSupplier(supplierData)
      }
    } catch (error) {
      console.error('Error fetching PO data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!poData) {
      alert('Data PO tidak tersedia')
      return
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'Sedang diproses' })
        .eq('id', poData.id)

      if (error) {
        console.error('Supabase error:', error)
        alert(`Error: ${error.message}`)
        return
      }

      alert('PO berhasil disetujui!')
      window.location.href = '/purchaseorder'
    } catch (error) {
      console.error('Error approving PO:', error)
      alert('Terjadi kesalahan saat menyetujui PO')
    }
  }

  const handleReject = async () => {
    if (!poData) return

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'Dibatalkan' })
        .eq('id', poData.id)

      if (!error) {
        alert('PO dibatalkan!')
        window.location.href = '/purchaseorder'
      }
    } catch (error) {
      console.error('Error rejecting PO:', error)
    }
  }

  const handleEditItem = (itemId: number) => {
    setEditingItems(prev => ({ ...prev, [itemId]: true }))
  }

  const handleSaveItem = async (itemId: number) => {
    const item = poItems.find(i => i.id === itemId)
    if (!item) return

    try {
      const { error } = await supabase
        .from('po_items')
        .update({ 
          qty: item.qty, 
          harga: item.harga, 
          total: item.total 
        })
        .eq('id', itemId)

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      setEditingItems(prev => ({ ...prev, [itemId]: false }))
      alert('Item berhasil diupdate!')
    } catch (error) {
      console.error('Error updating item:', error)
      alert('Terjadi kesalahan saat mengupdate item')
    }
  }

  const handleCancelEdit = (itemId: number) => {
    setEditingItems(prev => ({ ...prev, [itemId]: false }))
    // Refresh data to revert changes
    if (poData) {
      fetchPOData(poData.id)
    }
  }

  const handleItemChange = (itemId: number, field: string, value: number) => {
    setPOItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value }
        // Auto calculate total when qty or harga changes
        if (field === 'qty' || field === 'harga') {
          updatedItem.total = (updatedItem.qty || 0) * (updatedItem.harga || 0)
        }
        return updatedItem
      }
      return item
    }))
  }

  const exportToPDF = async () => {
    if (!poData) {
      alert('Data PO tidak tersedia')
      return
    }
    
    const element = document.getElementById('po-content')
    if (!element) {
      alert('Konten PDF tidak ditemukan')
      return
    }

    try {
      // Dynamic import html2pdf
      const html2pdf = (await import('html2pdf.js')).default
      
      // Buat elemen sementara untuk konten PDF
      const tempElement = element.cloneNode(true) as HTMLElement
      
      // Optimasi untuk PDF
      tempElement.style.width = '210mm'
      tempElement.style.padding = '15mm'
      tempElement.style.fontSize = '12pt'
      tempElement.style.position = 'static'
      tempElement.style.visibility = 'visible'
      
      const opt = {
        margin: 10,
        filename: `PO-${poData.po_number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        }
      }

      html2pdf().set(opt).from(tempElement).save()
    } catch (error) {
      console.error('Error loading html2pdf:', error)
      alert('Gagal memuat library PDF')
    }
  }

  const handlePrint = () => {
    const printContent = document.getElementById('po-content')
    if (printContent && poData) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>PO ${poData.po_number}</title>
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  margin: 0; 
                  padding: 20px; 
                  font-size: 12pt;
                }
                @media print { 
                  body { margin: 0; } 
                }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800'
      case 'Sedang diproses': return 'bg-blue-100 text-blue-800'
      case 'Dibatalkan': return 'bg-red-100 text-red-800'
      case 'Barang Sampai': return 'bg-green-100 text-green-800'
      case 'Sampai Sebagian': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'tinggi': return 'bg-red-100 text-red-800'
      case 'sedang': return 'bg-orange-100 text-orange-800'
      case 'biasa': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Memuat data PO...</p>
        </div>
      </div>
    )
  }

  if (!poData) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-gray-600">PO tidak ditemukan</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <a href={`/purchaseorder/edit?id=${poData.id}`} className="text-gray-600 hover:text-gray-800">
            <ArrowLeft size={20} className="md:hidden" />
            <ArrowLeft size={24} className="hidden md:block" />
          </a>
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-blue-600" size={20} />
              <span className="hidden md:inline">Detail Purchase Order</span>
              <span className="md:hidden">Detail PO</span>
            </h1>
            <p className="text-gray-600 mt-1 text-sm md:text-base">PO #{poData.po_number}</p>
          </div>
        </div>
        <div className="flex gap-2 md:gap-3">
          <button 
            onClick={handlePrint}
            className="bg-white text-gray-700 px-3 md:px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2 text-sm md:text-base"
          >
            <Printer size={16} />
            <span className="hidden md:inline">Cetak</span>
          </button>
          <button 
            onClick={exportToPDF}
            className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm md:text-base"
          >
            <Download size={16} />
            <span className="hidden md:inline">Export PDF</span>
            <span className="md:hidden">PDF</span>
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`p-3 md:p-4 rounded-lg ${getStatusColor(poData.status)} flex items-center gap-2 md:gap-3`}>
        {poData.status === 'Pending' && <Clock className="text-yellow-600" size={18} />}
        {poData.status === 'Dibatalkan' && <XCircle className="text-red-600" size={18} />}
        {poData.status === 'Sedang diproses' && <Package className="text-blue-600" size={18} />}
        <div>
          <h3 className="font-semibold text-sm md:text-base">Status: {poData.status}</h3>
          <p className="text-xs md:text-sm">
            {poData.status === 'Pending' && 'Menunggu persetujuan'}
            {poData.status === 'Sedang diproses' && 'PO sedang diproses oleh supplier'}
            {poData.status === 'Dibatalkan' && 'PO telah dibatalkan'}
          </p>
        </div>
      </div>

      {/* PO Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* PO Details Card */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
              <FileText size={18} />
              Informasi PO
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Nomor PO</label>
                <p className="font-semibold text-sm md:text-base">{poData.po_number}</p>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Tanggal PO</label>
                <p className="font-semibold text-sm md:text-base">{new Date(poData.po_date).toLocaleDateString('id-ID')}</p>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Termin Pembayaran</label>
                <p className="font-semibold text-sm md:text-base">{poData.termin_days} hari</p>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Prioritas</label>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(poData.priority)}`}>
                  {poData.priority.toUpperCase()}
                </span>
              </div>
            </div>

            {poData.keterangan && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-xs md:text-sm font-medium text-gray-500 mb-2">Catatan</label>
                <p className="text-gray-700 bg-gray-50 p-3 rounded text-sm md:text-base">{poData.keterangan}</p>
              </div>
            )}
          </div>

          {/* Items Card */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
              <Package size={18} />
              Daftar Item
            </h2>
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {poItems.map((item, index) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-gray-900">{item.product_name}</div>
                    <div className="flex gap-1">
                      {editingItems[item.id] ? (
                        <>
                          <button
                            onClick={() => handleSaveItem(item.id)}
                            className="text-green-600 hover:text-green-800 p-1"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => handleCancelEdit(item.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEditItem(item.id)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <Edit size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Merk:</span>
                      <span className="ml-1 text-gray-700">{item.merk || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Qty:</span>
                      {editingItems[item.id] ? (
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleItemChange(item.id, 'qty', parseInt(e.target.value) || 0)}
                          className="ml-1 w-16 px-1 py-0.5 border border-gray-300 rounded text-xs"
                        />
                      ) : (
                        <span className="ml-1 font-semibold">{item.qty}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">Unit:</span>
                      <span className="ml-1 text-gray-700">{item.unit_besar}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Harga:</span>
                      {editingItems[item.id] ? (
                        <input
                          type="number"
                          value={item.harga || 0}
                          onChange={(e) => handleItemChange(item.id, 'harga', parseFloat(e.target.value) || 0)}
                          className="ml-1 w-20 px-1 py-0.5 border border-gray-300 rounded text-xs"
                        />
                      ) : (
                        <span className="ml-1 text-gray-700">Rp {(item.harga || 0).toLocaleString('id-ID')}</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Total:</span>
                      {editingItems[item.id] ? (
                        <span className="ml-1 font-semibold text-green-600">Rp {(item.total || 0).toLocaleString('id-ID')}</span>
                      ) : (
                        <span className="ml-1 font-semibold text-green-600">Rp {(item.total || 0).toLocaleString('id-ID')}</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Ket:</span>
                      <span className="ml-1 text-gray-700">{item.keterangan || '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3 font-semibold text-gray-700">Produk</th>
                    <th className="p-3 font-semibold text-gray-700">Merk</th>
                    <th className="p-3 font-semibold text-gray-700 text-center">Qty</th>
                    <th className="p-3 font-semibold text-gray-700 text-center">Unit</th>
                    <th className="p-3 font-semibold text-gray-700 text-right">Harga</th>
                    <th className="p-3 font-semibold text-gray-700 text-right">Total</th>
                    <th className="p-3 font-semibold text-gray-700">Keterangan</th>
                    <th className="p-3 font-semibold text-gray-700 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {poItems.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 border-b border-gray-200">
                        <div className="font-medium">{item.product_name}</div>
                      </td>
                      <td className="p-3 border-b border-gray-200">
                        <div className="text-gray-600">{item.merk || '-'}</div>
                      </td>
                      <td className="p-3 border-b border-gray-200 text-center">
                        {editingItems[item.id] ? (
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleItemChange(item.id, 'qty', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                          />
                        ) : (
                          <span className="font-semibold">{item.qty}</span>
                        )}
                      </td>
                      <td className="p-3 border-b border-gray-200 text-center">
                        {item.unit_besar}
                      </td>
                      <td className="p-3 border-b border-gray-200 text-right">
                        {editingItems[item.id] ? (
                          <input
                            type="number"
                            value={item.harga || 0}
                            onChange={(e) => handleItemChange(item.id, 'harga', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                          />
                        ) : (
                          <span className="text-gray-700">Rp {(item.harga || 0).toLocaleString('id-ID')}</span>
                        )}
                      </td>
                      <td className="p-3 border-b border-gray-200 text-right">
                        <span className="font-semibold text-green-600">Rp {(item.total || 0).toLocaleString('id-ID')}</span>
                      </td>
                      <td className="p-3 border-b border-gray-200">
                        {item.keterangan || '-'}
                      </td>
                      <td className="p-3 border-b border-gray-200 text-center">
                        {editingItems[item.id] ? (
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => handleSaveItem(item.id)}
                              className="text-green-600 hover:text-green-800 p-1"
                              title="Simpan"
                            >
                              <Save size={16} />
                            </button>
                            <button
                              onClick={() => handleCancelEdit(item.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Batal"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditItem(item.id)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Total Summary */}
              <div className="mt-4 flex justify-end">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-right">
                    <div className="text-sm text-gray-600 mb-1">Total Keseluruhan:</div>
                    <div className="text-xl font-bold text-green-600">
                      Rp {poItems.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 md:space-y-6">
          {/* Supplier Card */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
              <Building2 size={18} />
              Supplier
            </h2>
            
            <div className="space-y-2 md:space-y-3">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Nama Supplier</label>
                <p className="font-semibold text-sm md:text-base">{supplier?.nama_supplier}</p>
              </div>
              
              {supplier?.termin_tempo && (
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-500">Tempo Pembayaran</label>
                  <p className="text-gray-700 text-sm md:text-base">{supplier.termin_tempo} hari</p>
                </div>
              )}
            </div>
          </div>

          {/* Branch Card */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
              <Building2 size={18} />
              Cabang
            </h2>
            
            <div className="space-y-2 md:space-y-3">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Nama Cabang</label>
                <p className="font-semibold text-sm md:text-base">{branch?.nama_branch}</p>
              </div>
              
              {branch?.alamat && (
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-500">Alamat</label>
                  <p className="text-gray-700 text-sm md:text-base">{branch.alamat}</p>
                </div>
              )}
              
              {branch?.pic && (
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-500">PIC</label>
                  <p className="text-gray-700 text-sm md:text-base">{branch.pic}</p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
              <Clock size={18} />
              Timeline
            </h2>
            
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-3 h-3 rounded-full bg-blue-500"></div>
                <div>
                  <p className="font-medium text-sm md:text-base">Dibuat</p>
                  <p className="text-xs md:text-sm text-gray-500">{new Date(poData.created_at).toLocaleDateString('id-ID')}</p>
                </div>
              </div>
              
              {poData.status === 'Sedang diproses' || poData.status === 'Barang Sampai' || poData.status === 'Sampai Sebagian' ? (
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-3 h-3 rounded-full bg-green-500"></div>
                  <div>
                    <p className="font-medium text-sm md:text-base">Disetujui</p>
                    <p className="text-xs md:text-sm text-gray-500">{new Date(poData.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
              ) : poData.status === 'Dibatalkan' && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-3 h-3 rounded-full bg-red-500"></div>
                  <div>
                    <p className="font-medium text-sm md:text-base">Dibatalkan</p>
                    <p className="text-xs md:text-sm text-gray-500">{new Date(poData.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Only show if status is Pending */}
      {poData.status === 'Pending' && (
        <div className="flex flex-col md:flex-row md:justify-between gap-3 pt-4 border-t border-gray-200">
          <a href={`/purchaseorder/`} className="px-4 md:px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm md:text-base">
            <ArrowLeft size={16} />
            <span className="hidden md:inline">Back To List Purchase Order</span>
            <span className="md:hidden">Kembali ke Daftar PO</span>
          </a>
          <div className="flex gap-2 md:gap-3">
            <button 
              onClick={handleReject}
              className="bg-red-100 text-red-700 px-4 md:px-6 py-2 rounded-lg hover:bg-red-200 flex items-center justify-center gap-2 border border-red-200 flex-1 md:flex-none text-sm md:text-base"
            >
              <XCircle size={16} />
              <span className="hidden md:inline">Batalkan PO</span>
              <span className="md:hidden">Batalkan</span>
            </button>
            <button 
              onClick={handleApprove}
              className="bg-green-600 text-white px-4 md:px-6 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 flex-1 md:flex-none text-sm md:text-base"
            >
              <CheckCircle size={16} />
              <span className="hidden md:inline">Setujui PO</span>
              <span className="md:hidden">Setujui</span>
            </button>
          </div>
        </div>
      )}
      
      {poData.status !== 'Pending' && (
        <div className="flex justify-center pt-4 border-t border-gray-200">
          <a href="/purchaseorder" className="px-4 md:px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm md:text-base">
            <ArrowLeft size={16} />
            Kembali ke Daftar PO
          </a>
        </div>
      )}

      {/* Hidden content for PDF export */}
      <div id="po-content" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '210mm' }}>
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', color: '#333' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '3px solid #2563eb', paddingBottom: '20px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e40af', marginBottom: '5px', letterSpacing: '1px' }}>PURCHASE ORDER</h1>
            <div style={{ fontSize: '16px', color: '#6b7280', fontWeight: '500' }}>No: {poData.po_number}</div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '30px' }}>
            <div style={{ border: '1px solid #e5e7eb', padding: '20px', borderRadius: '8px', background: '#f9fafb' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #2563eb', paddingBottom: '5px' }}>Dari</h3>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1f2937', marginBottom: '8px' }}>{branch?.nama_branch || 'Nama Cabang'}</div>
              <p style={{ marginBottom: '5px', fontSize: '13px' }}>{branch?.alamat || 'Alamat cabang'}</p>
              {(branch as any)?.telp && <p style={{ marginBottom: '5px', fontSize: '13px' }}>Telp: {(branch as any).telp}</p>}
              {(branch as any)?.email && <p style={{ marginBottom: '5px', fontSize: '13px' }}>Email: {(branch as any).email}</p>}
              <p style={{ marginTop: '10px', fontWeight: '600', fontSize: '13px' }}>PIC: {branch?.pic || 'Tidak ada'}</p>
            </div>
            
            <div style={{ border: '1px solid #e5e7eb', padding: '20px', borderRadius: '8px', background: '#f9fafb' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #2563eb', paddingBottom: '5px' }}>Kepada</h3>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1f2937', marginBottom: '8px' }}>{supplier?.nama_supplier || 'Nama Supplier'}</div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px', padding: '20px', background: '#f3f4f6', borderRadius: '8px', border: '1px solid #d1d5db' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', marginBottom: '5px', textTransform: 'uppercase' }}>Tanggal PO</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937' }}>{new Date(poData.po_date).toLocaleDateString('id-ID')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', marginBottom: '5px', textTransform: 'uppercase' }}>Termin Pembayaran</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937' }}>{poData.termin_days} Hari</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', marginBottom: '5px', textTransform: 'uppercase' }}>Prioritas</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937' }}>{poData.priority.toUpperCase()}</div>
            </div>
          </div>
          
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #2563eb' }}>Detail Pesanan</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr>
                  <th style={{ background: '#2563eb', color: 'white', padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '5%' }}>No</th>
                  <th style={{ background: '#2563eb', color: 'white', padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '25%' }}>Nama Produk</th>
                  <th style={{ background: '#2563eb', color: 'white', padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '15%' }}>Merk</th>
                  <th style={{ background: '#2563eb', color: 'white', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '8%' }}>Qty</th>
                  <th style={{ background: '#2563eb', color: 'white', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '8%' }}>Unit</th>
                  <th style={{ background: '#2563eb', color: 'white', padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '12%' }}>Harga</th>
                  <th style={{ background: '#2563eb', color: 'white', padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '15%' }}>Total</th>
                  <th style={{ background: '#2563eb', color: 'white', padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '12%' }}>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {poItems.map((item, index) => (
                  <tr key={item.id} style={{ background: index % 2 === 0 ? '#f9fafb' : 'white' }}>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>{item.product_name}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '13px' }}>{item.merk || '-'}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', textAlign: 'center', fontWeight: '600' }}>{item.qty}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', textAlign: 'center' }}>{item.unit_besar}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', textAlign: 'right' }}>Rp {(item.harga || 0).toLocaleString('id-ID')}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', textAlign: 'right', fontWeight: '600', color: '#059669' }}>Rp {(item.total || 0).toLocaleString('id-ID')}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '13px' }}>{item.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {poData?.keterangan && (
            <div style={{ margin: '30px 0', padding: '20px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#92400e', marginBottom: '10px' }}>Catatan Khusus:</h4>
              <p style={{ color: '#78350f', fontSize: '13px', lineHeight: '1.5' }}>{poData.keterangan}</p>
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', marginTop: '50px', paddingTop: '30px', borderTop: '1px solid #d1d5db' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '60px', fontSize: '14px', color: '#374151' }}>Dibuat Oleh</div>
              <div style={{ borderBottom: '1px solid #374151', marginBottom: '8px', height: '1px' }}></div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#1f2937' }}>({branch?.pic || 'PIC Cabang'})</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '5px' }}>Tanggal: {new Date(poData?.created_at || '').toLocaleDateString('id-ID')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '60px', fontSize: '14px', color: '#374151' }}>Disetujui Oleh</div>
              <div style={{ borderBottom: '1px solid #374151', marginBottom: '8px', height: '1px' }}></div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#1f2937' }}>(Andi)</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '5px' }}>Tanggal: {new Date().toLocaleDateString('id-ID')}</div>
            </div>
          </div>
          
          <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '11px', color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: '15px' }}>
            <p>Dokumen ini digenerate secara otomatis pada {new Date().toLocaleDateString('id-ID')}</p>
            <p>Purchase Order - {poData?.po_number}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OnProgressPOPage() {
  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <OnProgressPO />
      </PageAccessControl>
    </Layout>
  )
}