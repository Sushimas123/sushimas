"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Package, ArrowLeft, Calendar, Building2, User, FileText, Image as ImageIcon, Printer, Download } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

interface ReceivedData {
  po_number: string
  po_date: string
  supplier_name: string
  branch_name: string
  status: string
  tanggal_barang_sampai: string
  invoice_number: string
  bukti_foto: string
  items: Array<{
    product_name: string
    qty_po: number
    qty_received: number
    harga_po: number
    harga_actual: number
    keterangan: string
  }>
}

export default function ReceivedPreviewPage() {
  const [receivedData, setReceivedData] = useState<ReceivedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const poId = urlParams.get('id')
    
    if (poId && !isNaN(parseInt(poId))) {
      fetchReceivedData(parseInt(poId))
    } else {
      alert('PO ID tidak ditemukan')
      window.location.href = '/purchaseorder'
    }
  }, [])

  const fetchReceivedData = async (poId: number) => {
    try {
      // Get PO data
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single()

      if (poError || !po) {
        throw new Error('PO tidak ditemukan')
      }

      // Get supplier and branch names
      const [supplierResult, branchResult] = await Promise.all([
        supabase.from('suppliers').select('nama_supplier').eq('id_supplier', po.supplier_id).single(),
        supabase.from('branches').select('nama_branch').eq('id_branch', po.cabang_id).single()
      ])

      // Get received items from barang_masuk
      const { data: receivedItems } = await supabase
        .from('barang_masuk')
        .select(`
          *,
          nama_product!inner(product_name)
        `)
        .eq('no_po', po.po_number)

      // Get invoice number from barang_masuk (first record)
      const invoiceNumber = receivedItems && receivedItems.length > 0 ? receivedItems[0].invoice_number : po.invoice_number

      // Get photo URL - try both bukti_foto field and search by PO number
      if (po.bukti_foto) {
        const { data } = supabase.storage
          .from('po-photos')
          .getPublicUrl(po.bukti_foto)
        setPhotoUrl(data.publicUrl)
      } else {
        // Search for photo by PO number if bukti_foto is empty
        try {
          const { data: files } = await supabase.storage
            .from('po-photos')
            .list('', { search: po.po_number })
          
          if (files && files.length > 0) {
            const { data } = supabase.storage
              .from('po-photos')
              .getPublicUrl(files[0].name)
            setPhotoUrl(data.publicUrl)
          }
        } catch (error) {
          console.error('Error searching for photo:', error)
        }
      }

      const transformedData: ReceivedData = {
        po_number: po.po_number,
        po_date: po.po_date,
        supplier_name: supplierResult.data?.nama_supplier || 'Unknown',
        branch_name: branchResult.data?.nama_branch || 'Unknown',
        status: po.status,
        tanggal_barang_sampai: po.tanggal_barang_sampai,
        invoice_number: invoiceNumber || '',
        bukti_foto: po.bukti_foto || '',
        items: receivedItems?.map(item => ({
          product_name: item.nama_product?.product_name || 'Unknown Product',
          qty_po: item.qty_po || 0,
          qty_received: item.jumlah || 0,
          harga_po: item.harga_po || 0,
          harga_actual: item.harga || 0,
          keterangan: item.keterangan || ''
        })) || []
      }

      setReceivedData(transformedData)
    } catch (error) {
      console.error('Error fetching received data:', error)
      alert('Gagal memuat data: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID')
  }

  const exportToPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default
      const doc = new jsPDF()
      
      // Header
      doc.setFontSize(18)
      doc.text('LAPORAN PENERIMAAN BARANG', 20, 20)
      
      // PO Info
      doc.setFontSize(12)
      doc.text(`PO Number: ${receivedData?.po_number}`, 20, 40)
      doc.text(`Tanggal PO: ${receivedData ? formatDate(receivedData.po_date) : ''}`, 20, 50)
      doc.text(`Supplier: ${receivedData?.supplier_name}`, 20, 60)
      doc.text(`Cabang: ${receivedData?.branch_name}`, 20, 70)
      doc.text(`Invoice: ${receivedData?.invoice_number}`, 20, 80)
      doc.text(`Tanggal Diterima: ${receivedData ? formatDate(receivedData.tanggal_barang_sampai) : ''}`, 20, 90)
      
      // Items table header
      let yPos = 110
      doc.setFontSize(10)
      doc.text('Produk', 20, yPos)
      doc.text('Qty PO', 80, yPos)
      doc.text('Qty Terima', 110, yPos)
      doc.text('Harga PO', 140, yPos)
      doc.text('Harga Aktual', 170, yPos)
      
      // Items
      yPos += 10
      receivedData?.items.forEach((item) => {
        doc.text(item.product_name.substring(0, 25), 20, yPos)
        doc.text(item.qty_po.toString(), 80, yPos)
        doc.text(item.qty_received.toString(), 110, yPos)
        doc.text(formatCurrency(item.harga_po), 140, yPos)
        doc.text(formatCurrency(item.harga_actual), 170, yPos)
        yPos += 8
      })
      
      // Total
      yPos += 10
      const total = receivedData?.items.reduce((sum, item) => sum + (item.qty_received * item.harga_actual), 0) || 0
      doc.setFontSize(12)
      doc.text(`Total: ${formatCurrency(total)}`, 140, yPos)
      
      doc.save(`received-preview-${receivedData?.po_number}.pdf`)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Gagal export PDF')
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  if (!receivedData) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p className="text-red-600">Data tidak ditemukan</p>
          <a href="/purchaseorder" className="text-blue-600 hover:underline mt-2 inline-block">
            Kembali ke Purchase Order
          </a>
        </div>
      </Layout>
    )
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-content, #printable-content * {
            visibility: visible;
          }
          #printable-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <Layout>
        <PageAccessControl pageName="purchaseorder">
        <div className="p-6 space-y-6" id="printable-content">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="text-green-600" size={28} />
                LAPORAN PENERIMAAN BARANG
              </h1>
              <p className="text-gray-600 mt-1">
                PO #{receivedData.po_number} - {receivedData.supplier_name}
              </p>
            </div>
            <div className="flex gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Printer size={16} />
                Print
              </button>
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download size={16} />
                Export PDF
              </button>
              <a 
                href="/purchaseorder" 
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ArrowLeft size={16} />
                Kembali
              </a>
            </div>
          </div>

          {/* PO Information */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-medium text-green-900 mb-3">Informasi Penerimaan Barang</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-gray-600 text-xs">Nomor PO:</span>
                <p className="font-medium">{receivedData.po_number}</p>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Tanggal PO:</span>
                <p className="font-medium">{formatDate(receivedData.po_date)}</p>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Tanggal Diterima:</span>
                <p className="font-medium text-green-600">{formatDate(receivedData.tanggal_barang_sampai)}</p>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Status:</span>
                <p className="font-medium text-green-600">{receivedData.status}</p>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Supplier:</span>
                <p className="font-medium">{receivedData.supplier_name}</p>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Cabang:</span>
                <p className="font-medium">{receivedData.branch_name}</p>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Invoice Number:</span>
                <p className="font-medium">{receivedData.invoice_number}</p>
              </div>
              {photoUrl && (
                <div>
                  <span className="text-gray-600 text-xs">Foto Barang:</span>
                  <button
                    onClick={() => setShowPhotoModal(true)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm"
                  >
                    <ImageIcon size={14} />
                    Lihat Foto
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Received Items */}
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Items yang Diterima</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty PO</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty Diterima</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harga PO</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harga Aktual</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {receivedData.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                        {item.qty_po}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        <span className={`font-medium ${item.qty_received === item.qty_po ? 'text-green-600' : 'text-yellow-600'}`}>
                          {item.qty_received}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                        {formatCurrency(item.harga_po)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <span className={`font-medium ${item.harga_actual !== item.harga_po ? 'text-orange-600' : 'text-gray-900'}`}>
                          {formatCurrency(item.harga_actual)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {formatCurrency(item.qty_received * item.harga_actual)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.keterangan}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-right font-medium text-gray-900">
                      Total Keseluruhan:
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      {formatCurrency(receivedData.items.reduce((sum, item) => sum + (item.qty_received * item.harga_actual), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Photo Modal */}
          {showPhotoModal && photoUrl && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-4xl max-h-full overflow-auto">
                <div className="p-4 border-b flex justify-between items-center">
                  <h3 className="font-medium">Foto Barang Sampai</h3>
                  <button
                    onClick={() => setShowPhotoModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4">
                  <img 
                    src={photoUrl} 
                    alt="Foto Barang Sampai" 
                    className="max-w-full h-auto rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        </PageAccessControl>
      </Layout>
    </>
  )
}