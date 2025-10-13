'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { CheckCircle, XCircle, Package, Building2, Calendar, User, FileText, Download, ArrowLeft, Printer, Clock, AlertCircle, Edit, Save, X, MessageCircle } from 'lucide-react'
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
  id_payment_term?: number
  whatsapp?: string
  payment_terms?: { term_name: string; days: number }
}

function OnProgressPO() {
  const [poData, setPOData] = useState<POData | null>(null)
  const [poItems, setPOItems] = useState<POItem[]>([])
  const [branch, setBranch] = useState<Branch | null>(null)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [createdByUser, setCreatedByUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingItems, setEditingItems] = useState<{[key: number]: boolean}>({})
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [selectedUser, setSelectedUser] = useState<{id: number, name: string, phone: string} | null>(null)
  const [branchUsers, setBranchUsers] = useState<{id: number, name: string, phone: string}[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isApprovalMode, setIsApprovalMode] = useState(false)

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
          .select('*, harga, total, actual_price, unit_besar')
          .eq('po_id', poId)

        // Get product details and stock data for each item
        const itemsWithStock = await Promise.all(
          (items || []).map(async (item) => {
            // Get product details including price and unit_besar
            const { data: product } = await supabase
              .from('nama_product')
              .select('product_name, merk, harga, unit_besar')
              .eq('id_product', item.product_id)
              .single()

            // No stock data needed for PO preview

            // Use actual_price first, then harga from po_items, then fallback to product price
            const finalPrice = item.actual_price || item.harga || product?.harga || 0
            const finalTotal = item.total || (finalPrice * item.qty)

            return {
              ...item,
              product_name: product?.product_name || 'Unknown Product',
              merk: product?.merk || '',
              unit_besar: item.unit_besar || product?.unit_besar || 'pcs',
              stock_qty: 0,
              harga: finalPrice,
              total: finalTotal
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

        // Fetch supplier data with payment terms
        const { data: supplierData } = await supabase
          .from('suppliers')
          .select(`
            id_supplier, 
            nama_supplier, 
            termin_tempo, 
            id_payment_term
          `)
          .eq('id_supplier', po.supplier_id)
          .single()

        // Get payment terms if available
        if (supplierData) {
          let supplierWithTerms: Supplier = supplierData as Supplier
          
          if (supplierData.id_payment_term) {
            const { data: paymentTerm } = await supabase
              .from('payment_terms')
              .select('term_name, days')
              .eq('id_payment_term', supplierData.id_payment_term)
              .single()
            
            supplierWithTerms = {
              ...supplierData,
              payment_terms: paymentTerm || undefined
            } as Supplier
          }

          setSupplier(supplierWithTerms)
        }

        // Fetch users from the same branch
        if (branchData?.kode_branch) {
          const { data: usersData } = await supabase
            .from('user_branches')
            .select(`
              id_user,
              users!inner (
                id_user,
                nama_lengkap,
                no_telp
              )
            `)
            .eq('kode_branch', branchData.kode_branch)
            .eq('is_active', true)
            .eq('users.is_active', true)

          const formattedUsers = (usersData || []).map((item: any) => ({
            id: item.users.id_user,
            name: item.users.nama_lengkap,
            phone: item.users.no_telp || ''
          })).filter(user => user.phone) // Only users with phone numbers

          setBranchUsers(formattedUsers)
          
          // Set default to first user with phone number
          if (formattedUsers.length > 0) {
            setSelectedUser(formattedUsers[0])
            setWhatsappNumber(formattedUsers[0].phone)
          }
        }

        // Set PIC cabang sebagai user yang membuat PO
        setCreatedByUser({ nama_lengkap: picName })
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

    setIsApprovalMode(true)
    setShowWhatsAppModal(true)
  }

  const handleExportWhatsApp = () => {
    if (!poData) {
      alert('Data PO tidak tersedia')
      return
    }

    setIsApprovalMode(false)
    setShowWhatsAppModal(true)
  }

  const handleFinalApprove = async () => {
    if (!poData || !selectedUser) {
      alert('User dan nomor WhatsApp harus dipilih')
      return
    }

    setIsSaving(true)

    try {
      // Update PO status
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'Sedang diproses' })
        .eq('id', poData.id)

      if (error) {
        console.error('Supabase error:', error)
        alert(`Error: ${error.message}`)
        return
      }

      // Export to WhatsApp
      exportToWhatsApp()

      alert('PO berhasil disetujui dan dikirim ke WhatsApp!')
      window.location.href = '/purchaseorder'
    } catch (error) {
      console.error('Error approving PO:', error)
      alert('Terjadi kesalahan saat menyetujui PO')
    } finally {
      setIsSaving(false)
      setShowWhatsAppModal(false)
    }
  }

  const handleWhatsAppExport = () => {
    if (!poData || !branch || !selectedUser) {
      alert('User dan nomor WhatsApp harus dipilih')
      return
    }

    exportToWhatsApp()
    setShowWhatsAppModal(false)
  }

  const exportToWhatsApp = () => {
    if (!poData || !branch) return

    // Validate phone number
    if (!whatsappNumber || whatsappNumber.trim() === '') {
      alert('Nomor WhatsApp harus diisi')
      return
    }

    // Format WhatsApp message
    const message = `*ORDERAN SUSHIMAS*

• Nomor PO: ${poData.po_number}
• Tanggal: ${new Date(poData.po_date).toLocaleDateString('id-ID')}

*DARI*
• Cabang: ${branch.nama_branch}
• PIC: ${branch.pic || '-'}

*KEPADA* : ${supplier?.nama_supplier || 'Supplier'}

*DETAIL ITEM*
${poItems.map((item, index) => 
  `${index + 1}. ${item.product_name} (${item.merk || '-'})
   Qty: ${item.qty} ${item.unit_besar}
   Ket: ${item.keterangan || '-'}`
).join('\n\n')}

${poData.keterangan ? `\n📝 *CATATAN:*\n${poData.keterangan}` : ''}

_*Dokumen ini digenerate otomatis pada ${new Date().toLocaleDateString('id-ID')}*_`

    // Clean and format phone number
    let cleanPhone = whatsappNumber.replace(/[^0-9]/g, '')
    
    // Add country code if not present
    if (!cleanPhone.startsWith('62')) {
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.substring(1)
      } else {
        cleanPhone = '62' + cleanPhone
      }
    }

    // Validate phone number length
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      alert('Format nomor WhatsApp tidak valid')
      return
    }

    // Encode message for WhatsApp URL
    const encodedMessage = encodeURIComponent(message)
    
    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`
    
    console.log('WhatsApp URL:', whatsappUrl)
    
    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank')
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
          actual_price: item.harga,
          total: item.total 
        })
        .eq('id', itemId)

      if (error) {
        console.error('Supabase error:', error)
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

  const exportPDFToWhatsApp = async () => {
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
      
      const tempElement = element.cloneNode(true) as HTMLElement
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

      // Generate and download PDF
      await html2pdf().set(opt).from(tempElement).save()
      
      // Create WhatsApp message
      const message = `Halo, berikut adalah Purchase Order ${poData.po_number}. File PDF sudah didownload, silakan attach file PDF tersebut ke chat ini.`
      
      // Clean and format phone number
      let cleanPhone = whatsappNumber.replace(/[^0-9]/g, '')
      
      // Add country code if not present
      if (!cleanPhone.startsWith('62')) {
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '62' + cleanPhone.substring(1)
        } else {
          cleanPhone = '62' + cleanPhone
        }
      }

      // Validate phone number
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        alert('Format nomor WhatsApp tidak valid')
        return
      }
      
      const encodedMessage = encodeURIComponent(message)
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`
      
      // Open WhatsApp after a short delay to allow PDF download
      setTimeout(() => {
        window.open(whatsappUrl, '_blank')
      }, 1000)
      
      alert('PDF berhasil didownload dan WhatsApp akan terbuka. Silakan attach file PDF yang sudah didownload ke chat WhatsApp.')
    } catch (error) {
      console.error('Error generating PDF for WhatsApp:', error)
      alert('Gagal membuat PDF untuk WhatsApp')
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
      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="text-green-600" size={24} />
              <h3 className="text-lg font-semibold">
                {isApprovalMode ? 'Setujui & Kirim ke WhatsApp' : 'Kirim ke WhatsApp'}
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih User Cabang
                </label>
                <select
                  value={selectedUser?.id || ''}
                  onChange={(e) => {
                    const userId = parseInt(e.target.value)
                    const user = branchUsers.find(u => u.id === userId)
                    if (user) {
                      setSelectedUser(user)
                      setWhatsappNumber(user.phone)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Pilih user...</option>
                  {branchUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {user.phone}
                    </option>
                  ))}
                </select>
                {branchUsers.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    Tidak ada user dengan nomor telepon di cabang ini
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nomor WhatsApp
                </label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="Contoh: 6281234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: 62xxxxxxxxxxx (tanpa + dan spasi)
                </p>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  {isApprovalMode 
                    ? 'PO akan disetujui dan langsung dikirim ke WhatsApp supplier'
                    : 'PO akan dikirim ke WhatsApp tanpa mengubah status'
                  }
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isSaving}
                >
                  Batal
                </button>
                <button
                  onClick={isApprovalMode ? handleFinalApprove : handleWhatsAppExport}
                  disabled={!selectedUser || !whatsappNumber || isSaving}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <MessageCircle size={16} />
                      {isApprovalMode ? 'Setujui & Kirim' : 'Kirim WhatsApp'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          {/* WhatsApp Export Button */}
          <button 
            onClick={handleExportWhatsApp}
            className="bg-green-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm md:text-base"
          >
            <MessageCircle size={16} />
            <span className="hidden md:inline">Export WhatsApp</span>
            <span className="md:hidden">WA</span>
          </button>
          {/* PDF to WhatsApp Button */}
          <button 
            onClick={exportPDFToWhatsApp}
            className="bg-purple-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm md:text-base"
          >
            <Download size={16} />
            <MessageCircle size={14} className="-ml-1" />
            <span className="hidden md:inline">PDF ke WA</span>
            <span className="md:hidden">PDF WA</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column - PO Details */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* PO Information Card */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-2 md:mb-0">Informasi Purchase Order</h2>
              <div className="flex gap-2">
                <span className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium ${getStatusColor(poData.status)}`}>
                  {poData.status}
                </span>
                <span className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium ${getPriorityColor(poData.priority)}`}>
                  {poData.priority.toUpperCase()}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Nomor PO</label>
                <p className="text-gray-700 font-medium text-sm md:text-base">{poData.po_number}</p>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Tanggal PO</label>
                <p className="text-gray-700 text-sm md:text-base">{new Date(poData.po_date).toLocaleDateString('id-ID')}</p>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Termin Pembayaran</label>
                <p className="text-gray-700 text-sm md:text-base">
                  {supplier?.payment_terms ? 
                    `${supplier.payment_terms.term_name} (${supplier.payment_terms.days} hari)` : 
                    `${poData.termin_days} hari`
                  }
                </p>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Dibuat Oleh</label>
                <p className="text-gray-700 text-sm md:text-base">{createdByUser?.nama_lengkap || 'System'}</p>
              </div>
            </div>
            
            {poData.keterangan && (
              <div className="mt-4 md:mt-6">
                <label className="block text-xs md:text-sm font-medium text-gray-500 mb-2">Catatan</label>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg text-sm md:text-base">{poData.keterangan}</p>
              </div>
            )}
          </div>

          {/* Items List */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
              <Package size={18} />
              Daftar Item
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700">Produk</th>
                    <th className="text-center py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700">Qty</th>
                    <th className="text-center py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700">Unit</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700">Keterangan</th>
                    {poData.status === 'Pending' && (
                      <th className="text-center py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {poItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        <div>
                          <p className="font-medium text-gray-800 text-xs md:text-sm">{item.product_name}</p>
                          {item.merk && <p className="text-xs text-gray-500">Merk: {item.merk}</p>}
                        </div>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-center">
                        {editingItems[item.id] ? (
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleItemChange(item.id, 'qty', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border rounded text-center text-xs md:text-sm"
                          />
                        ) : (
                          <span className="text-xs md:text-sm">{item.qty}</span>
                        )}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-center text-xs md:text-sm">{item.unit_besar}</td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">{item.keterangan || '-'}</td>
                      {poData.status === 'Pending' && (
                        <td className="py-2 md:py-3 px-2 md:px-4 text-center">
                          {editingItems[item.id] ? (
                            <div className="flex gap-1 justify-center">
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
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditItem(item.id)}
                              className="text-blue-600 hover:text-blue-800 p-1"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Additional Info */}
        <div className="space-y-4 md:space-y-6">
          {/* Supplier Info */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
              <Building2 size={18} />
              Supplier
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Nama Supplier</label>
                <p className="text-gray-700 font-medium text-sm md:text-base">{supplier?.nama_supplier || 'Loading...'}</p>
              </div>
            </div>
          </div>

          {/* Branch Info */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
              <Building2 size={18} />
              Cabang
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-500">Nama Cabang</label>
                <p className="text-gray-700 font-medium text-sm md:text-base">{branch?.nama_branch || 'Loading...'}</p>
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
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', color: '#000', lineHeight: '1.4' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>PURCHASE ORDER</h1>
            <p style={{ fontSize: '16px', fontWeight: 'bold' }}>No. {poData.po_number}</p>
          </div>
          
          {/* Company Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '25px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #000', paddingBottom: '5px' }}>DARI:</h3>
              <p style={{ fontSize: '12px', margin: '3px 0' }}>{branch?.nama_branch || 'Nama Cabang'}</p>
              <p style={{ fontSize: '12px', margin: '3px 0' }}>{branch?.alamat || 'Alamat cabang'}</p>
              <p style={{ fontSize: '12px', margin: '3px 0' }}>PIC: {branch?.pic || 'Tidak ada'}</p>
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #000', paddingBottom: '5px' }}>KEPADA:</h3>
              <p style={{ fontSize: '12px', margin: '3px 0' }}>{supplier?.nama_supplier || 'Nama Supplier'}</p>
            </div>
          </div>
          
          {/* PO Details */}
          <div style={{ marginBottom: '25px' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '5px', border: '1px solid #000', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Tanggal PO</td>
                  <td style={{ padding: '5px', border: '1px solid #000' }}>{new Date(poData.po_date).toLocaleDateString('id-ID')}</td>
                  <td style={{ padding: '5px', border: '1px solid #000', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Prioritas</td>
                  <td style={{ padding: '5px', border: '1px solid #000' }}>{poData.priority.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style={{ padding: '5px', border: '1px solid #000', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Termin Pembayaran</td>
                  <td style={{ padding: '5px', border: '1px solid #000' }}>
                    {supplier?.payment_terms ? 
                      `${supplier.payment_terms.term_name} (${supplier.payment_terms.days} hari)` : 
                      `${poData.termin_days} hari`
                    }
                  </td>
                  <td style={{ padding: '5px', border: '1px solid #000', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Status</td>
                  <td style={{ padding: '5px', border: '1px solid #000' }}>{poData.status}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Items Table */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>DETAIL ITEM:</h3>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>No</th>
                  <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold' }}>Nama Produk</th>
                  <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold' }}>Merk</th>
                  <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>Qty</th>
                  <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>Unit</th>
                  <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold' }}>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {poItems.map((item, index) => (
                  <tr key={item.id}>
                    <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ padding: '8px', border: '1px solid #000' }}>{item.product_name}</td>
                    <td style={{ padding: '8px', border: '1px solid #000' }}>{item.merk || '-'}</td>
                    <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'center' }}>{item.unit_besar}</td>
                    <td style={{ padding: '8px', border: '1px solid #000' }}>{item.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Notes */}
          {poData?.keterangan && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>CATATAN:</h3>
              <p style={{ fontSize: '12px', border: '1px solid #000', padding: '10px' }}>{poData.keterangan}</p>
            </div>
          )}
          
          {/* Signatures */}
          <div style={{ marginTop: '50px' }}>
            <table style={{ width: '100%', fontSize: '12px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '60px' }}>Dibuat Oleh</p>
                    <div style={{ borderBottom: '1px solid #000', marginBottom: '5px', width: '200px', margin: '0 auto' }}></div>
                    <p>({createdByUser?.nama_lengkap || 'User'})</p>
                  </td>
                  <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Disetujui Oleh</p>
                    <div style={{ marginBottom: '5px', width: '200px', margin: '0 auto', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src="/signatures/andi.png" alt="Signature" style={{ width: '150px', height: '40px', objectFit: 'contain' }} />
                    </div>
                    <div style={{ borderBottom: '1px solid #000', marginBottom: '5px', width: '200px', margin: '0 auto' }}></div>
                    <p>(Andi)</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Footer */}
          <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '10px', color: '#666' }}>
            <p>Dokumen ini digenerate otomatis pada {new Date().toLocaleDateString('id-ID')}</p>
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