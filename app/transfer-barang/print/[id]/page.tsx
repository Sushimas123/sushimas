"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { useParams } from 'next/navigation'
import { ArrowRightLeft, Calendar, Package, Building2, User, FileText, Printer, Share2 } from 'lucide-react'

interface TransferDetail {
  id: number
  transfer_no: string
  cabang_peminjam: string
  cabang_tujuan: string
  product_name: string
  unit_kecil: string
  jumlah: number
  harga_satuan: number
  total_harga: number
  tgl_pinjam: string
  tgl_barang_sampai?: string
  status: string
  keterangan?: string
  created_by_name?: string
  created_at: string
}

export default function TransferPrintPage() {
  const params = useParams()
  const [transfer, setTransfer] = useState<TransferDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchTransferDetail(parseInt(params.id as string))
    }
  }, [params.id])

  const fetchTransferDetail = async (id: number) => {
    try {
      const { data, error } = await supabase
        .from('v_transfer_barang')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setTransfer(data)
    } catch (error) {
      console.error('Error fetching transfer detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Transfer Barang ${transfer?.transfer_no}`,
          text: `Transfer barang dari ${transfer?.cabang_peminjam} ke ${transfer?.cabang_tujuan}`,
          url: window.location.href
        })
      } catch (error) {
        console.log('Error sharing:', error)
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!transfer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Transfer Tidak Ditemukan</h2>
          <p className="text-gray-600">Data transfer yang Anda cari tidak tersedia.</p>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Menunggu'
      case 'completed': return 'Selesai'
      case 'cancelled': return 'Dibatalkan'
      default: return status
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print/Share Actions - Hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-10 flex gap-2">
        <button
          onClick={handleShare}
          className="bg-white border p-3 rounded-lg shadow hover:bg-gray-50"
          title="Share"
        >
          <Share2 className="h-5 w-5 text-gray-600" />
        </button>
        <button
          onClick={handlePrint}
          className="bg-white border p-3 rounded-lg shadow hover:bg-gray-50"
          title="Print"
        >
          <Printer className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6 print:p-0">
        <div className="bg-white rounded-lg border print:border-0 print:rounded-none">
          {/* Header */}
          <div className="border-b p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ArrowRightLeft className="h-8 w-8 text-gray-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Transfer Barang</h1>
                  <p className="text-gray-600">Antar Cabang</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{transfer.transfer_no}</div>
                <div className={`inline-block px-3 py-1 rounded text-sm font-medium border mt-2 ${getStatusColor(transfer.status)}`}>
                  {getStatusLabel(transfer.status)}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Transfer Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* From */}
              <div className="border rounded p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-5 w-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-700">Cabang Peminjam</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{transfer.cabang_peminjam}</p>
              </div>

              {/* To */}
              <div className="border rounded p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-5 w-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-700">Cabang Tujuan</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{transfer.cabang_tujuan}</p>
              </div>
            </div>

            {/* Product Details */}
            <div className="border rounded p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-6 w-6 text-gray-600" />
                <h3 className="text-xl font-semibold text-gray-900">Detail Barang</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Nama Barang</label>
                  <p className="text-lg font-semibold text-gray-900">{transfer.product_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Jumlah</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {transfer.jumlah.toLocaleString('id-ID')} {transfer.unit_kecil}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Total Nilai</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR'
                    }).format(transfer.total_harga)}
                  </p>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="border rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-gray-600" />
                  <h4 className="font-semibold text-gray-700">Tanggal Pinjam</h4>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(transfer.tgl_pinjam).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              <div className="border rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-gray-600" />
                  <h4 className="font-semibold text-gray-700">Tanggal Sampai</h4>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {transfer.tgl_barang_sampai 
                    ? new Date(transfer.tgl_barang_sampai).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : 'Belum sampai'
                  }
                </p>
              </div>
            </div>

            {/* Notes */}
            {transfer.keterangan && (
              <div className="border rounded p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  <h4 className="font-semibold text-gray-700">Keterangan</h4>
                </div>
                <p className="text-gray-900">{transfer.keterangan}</p>
              </div>
            )}

            {/* Footer Info */}
            <div className="border-t pt-6 mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Dibuat oleh: {transfer.created_by_name || 'System'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span>Dibuat pada: {new Date(transfer.created_at).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code or Additional Info for Print */}
        <div className="hidden print:block mt-4 text-center text-xs text-gray-500">
          <p>Transfer ID: {transfer.id} | Generated: {new Date().toLocaleString('id-ID')}</p>
        </div>
      </div>
    </div>
  )
}