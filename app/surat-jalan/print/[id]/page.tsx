"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { useParams } from 'next/navigation'
import { Printer } from 'lucide-react'

interface SuratJalanDetail {
  id_surat_jalan: number
  no_surat_jalan: string
  tanggal: string
  driver: string
  dibuat_oleh: string
  disetujui_oleh: string
  diterima_oleh?: string
  cabang: {
    nama_branch: string
    alamat: string
    kota: string
  }
  items: {
    no_urut: number
    product_name: string
    unit_kecil: string
    jumlah_barang: number
    keterangan?: string
  }[]
}

export default function PrintSuratJalanPage() {
  const params = useParams()
  const [suratJalan, setSuratJalan] = useState<SuratJalanDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params?.id) {
      fetchSuratJalan(parseInt(params.id as string))
    }
  }, [params?.id])

  const fetchSuratJalan = async (id: number) => {
    try {
      const { data: sjData, error: sjError } = await supabase
        .from('surat_jalan')
        .select(`
          *,
          branches(nama_branch, alamat, kota)
        `)
        .eq('id_surat_jalan', id)
        .single()

      if (sjError) throw sjError

      const { data: itemsData, error: itemsError } = await supabase
        .from('surat_jalan_items')
        .select(`
          *,
          nama_product(product_name)
        `)
        .eq('id_surat_jalan', id)
        .order('no_urut')

      if (itemsError) throw itemsError

      setSuratJalan({
        ...sjData,
        cabang: sjData.branches,
        items: itemsData.map(item => ({
          no_urut: item.no_urut,
          product_name: (item.nama_product as any).product_name,
          unit_kecil: item.satuan,
          jumlah_barang: item.jumlah_barang,
          keterangan: item.keterangan
        }))
      })
    } catch (error) {
      console.error('Error fetching surat jalan:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!suratJalan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Surat jalan tidak ditemukan</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Print Button - Hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-10">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      {/* Surat Jalan Content */}
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">SURAT JALAN</h1>
          <p className="text-lg">No: {suratJalan.no_surat_jalan}</p>
        </div>

        {/* Info Section */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-semibold mb-2">Kepada:</h3>
            <p className="font-medium">{suratJalan.cabang.nama_branch}</p>
            <p>{suratJalan.cabang.alamat}</p>
            <p>{suratJalan.cabang.kota}</p>
          </div>
          <div>
            <div className="mb-4">
              <p><span className="font-medium">Tanggal:</span> {new Date(suratJalan.tanggal).toLocaleDateString('id-ID')}</p>
              <p><span className="font-medium">Driver:</span> {suratJalan.driver}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-4 py-2 text-left">No</th>
                <th className="border border-gray-400 px-4 py-2 text-left">Nama Barang</th>
                <th className="border border-gray-400 px-4 py-2 text-left">Jumlah</th>
                <th className="border border-gray-400 px-4 py-2 text-left">Satuan</th>
                <th className="border border-gray-400 px-4 py-2 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {suratJalan.items.map((item) => (
                <tr key={item.no_urut}>
                  <td className="border border-gray-400 px-4 py-2">{item.no_urut}</td>
                  <td className="border border-gray-400 px-4 py-2">{item.product_name}</td>
                  <td className="border border-gray-400 px-4 py-2">{item.jumlah_barang}</td>
                  <td className="border border-gray-400 px-4 py-2">{item.unit_kecil}</td>
                  <td className="border border-gray-400 px-4 py-2">{item.keterangan || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm font-medium text-center">
            JANGAN LUPA, SEMUA INVOICE DAN FAKTUR PAJAK DARI SUPPLIER, DIKIRIM KE DEPOK
          </p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 text-center">
          <div>
            <p className="font-medium mb-16">Diterima oleh:</p>
            <div className="border-t border-gray-400 pt-2">
              <p>{suratJalan.diterima_oleh || '________________'}</p>
            </div>
          </div>
          <div>
            <p className="font-medium mb-16">Dibuat oleh:</p>
            <div className="border-t border-gray-400 pt-2">
              <p>{suratJalan.dibuat_oleh}</p>
            </div>
          </div>
          <div>
            <p className="font-medium mb-4">Disetujui oleh:</p>
            {suratJalan.disetujui_oleh?.toLowerCase() === 'andi' && (
              <div className="mb-2">
                <img 
                  src="/signatures/andi.png" 
                  alt="Signature" 
                  className="mx-auto" 
                  style={{width: '250px', height: '40px', objectFit: 'contain'}}
                />
              </div>
            )}
            <div className="border-t border-gray-400 pt-2">
              <p>{suratJalan.disetujui_oleh}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}