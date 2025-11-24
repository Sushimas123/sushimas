"use client"

import React, { useState } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { AlertTriangle, CheckCircle, RefreshCw, Wrench } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

interface ProblematicPO {
  id: number
  po_number: string
  status: string
  cabang_id: number
  branch_name: string
  issue: string
  has_barang_masuk: boolean
  has_gudang: boolean
  barang_masuk_count: number
  gudang_count: number
}

export default function FixDataPage() {
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [problematicPOs, setProblematicPOs] = useState<ProblematicPO[]>([])
  const [fixedCount, setFixedCount] = useState(0)

  const scanForIssues = async () => {
    setScanning(true)
    setProblematicPOs([])
    
    try {
      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('id, po_number, status, cabang_id')
        .in('status', ['Barang sampai', 'Sampai Sebagian', 'Di Gudang'])
        .order('created_at', { ascending: false })

      if (!pos) {
        alert('Tidak ada PO yang perlu dicek')
        return
      }

      const issues: ProblematicPO[] = []

      for (const po of pos) {
        const { data: barangMasuk, count: bmCount } = await supabase
          .from('barang_masuk')
          .select('*', { count: 'exact' })
          .eq('no_po', po.po_number)

        const { data: branch } = await supabase
          .from('branches')
          .select('nama_branch')
          .eq('id_branch', po.cabang_id)
          .single()

        const { data: gudang, count: gudangCount } = await supabase
          .from('gudang')
          .select('*', { count: 'exact' })
          .eq('source_type', 'PO')
          .eq('source_reference', po.po_number)

        const hasBarangMasuk = (bmCount || 0) > 0
        const hasGudang = (gudangCount || 0) > 0

        let issue = ''
        
        if (po.status === 'Di Gudang' && !hasBarangMasuk && !hasGudang) {
          issue = 'Status "Di Gudang" tapi tidak ada data di barang_masuk dan gudang'
        } else if (po.status === 'Di Gudang' && !hasBarangMasuk) {
          issue = 'Status "Di Gudang" tapi tidak ada data di barang_masuk'
        } else if (po.status === 'Di Gudang' && !hasGudang) {
          issue = 'Status "Di Gudang" tapi tidak ada data di gudang'
        } else if ((po.status === 'Barang sampai' || po.status === 'Sampai Sebagian') && !hasBarangMasuk) {
          issue = 'Status "Barang sampai" tapi tidak ada data di barang_masuk'
        }

        if (issue) {
          issues.push({
            id: po.id,
            po_number: po.po_number,
            status: po.status,
            cabang_id: po.cabang_id,
            branch_name: branch?.nama_branch || 'Unknown',
            issue,
            has_barang_masuk: hasBarangMasuk,
            has_gudang: hasGudang,
            barang_masuk_count: bmCount || 0,
            gudang_count: gudangCount || 0
          })
        }
      }

      setProblematicPOs(issues)
      
      if (issues.length === 0) {
        alert('✅ Tidak ada masalah ditemukan! Semua PO konsisten.')
      } else {
        alert(`⚠️ Ditemukan ${issues.length} PO yang bermasalah`)
      }
    } catch (error) {
      console.error('Error scanning:', error)
      alert('Gagal melakukan scan')
    } finally {
      setScanning(false)
    }
  }

  const fixPO = async (po: ProblematicPO) => {
    const hasGudangData = po.has_gudang && po.gudang_count > 0
    
    let confirmMessage = `Reset status PO ${po.po_number} ke "Sedang diproses"?\n\n`
    
    if (hasGudangData) {
      confirmMessage += `⚠️ PERHATIAN:\nAda ${po.gudang_count} data di gudang yang akan dikembalikan ke barang_masuk.\n\nData gudang akan dihapus dan stock akan dikurangi.\n\n`
    }
    
    confirmMessage += `PO ini perlu diproses ulang melalui halaman Barang Sampai.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      // If has gudang data, restore to barang_masuk and delete from gudang
      if (hasGudangData) {
        // Get gudang data
        const { data: gudangData } = await supabase
          .from('gudang')
          .select('*')
          .eq('source_type', 'PO')
          .eq('source_reference', po.po_number)
        
        if (gudangData && gudangData.length > 0) {
          // Get branch code
          const { data: branchData } = await supabase
            .from('branches')
            .select('kode_branch')
            .eq('id_branch', po.cabang_id)
            .single()
          
          // Restore each item to barang_masuk
          for (const gudangItem of gudangData) {
            // Check if already exists in barang_masuk
            const { data: existingBM } = await supabase
              .from('barang_masuk')
              .select('id')
              .eq('no_po', po.po_number)
              .eq('id_barang', gudangItem.id_product)
              .eq('tanggal', gudangItem.tanggal)
              .maybeSingle()
            
            if (!existingBM) {
              // Insert to barang_masuk
              await supabase
                .from('barang_masuk')
                .insert({
                  tanggal: gudangItem.tanggal,
                  id_barang: gudangItem.id_product,
                  jumlah: gudangItem.jumlah_masuk,
                  id_supplier: null,
                  id_branch: po.cabang_id,
                  no_po: po.po_number,
                  invoice_number: '-',
                  keterangan: 'Restored from gudang by Fix Data',
                  created_by: gudangItem.created_by
                })
            }
          }
          
          // Delete from gudang
          await supabase
            .from('gudang')
            .delete()
            .eq('source_type', 'PO')
            .eq('source_reference', po.po_number)
        }
      }
      
      // Reset PO status
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'Sedang diproses' })
        .eq('id', po.id)

      if (error) throw error

      let successMessage = `✅ PO ${po.po_number} berhasil direset!\n\n`
      
      if (hasGudangData) {
        successMessage += `Data gudang telah dikembalikan ke barang_masuk.\n\n`
      }
      
      successMessage += `Silakan proses ulang melalui:\n1. Klik icon Package di daftar PO\n2. Isi form Barang Sampai\n3. Submit`
      
      alert(successMessage)
      
      setFixedCount(prev => prev + 1)
      setProblematicPOs(prev => prev.filter(p => p.id !== po.id))
    } catch (error) {
      console.error('Error fixing PO:', error)
      alert('Gagal memperbaiki PO: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const fixAllPOs = async () => {
    if (!confirm(`Reset semua ${problematicPOs.length} PO yang bermasalah?\n\nSemua PO akan direset ke status "Sedang diproses" dan perlu diproses ulang.`)) {
      return
    }

    setLoading(true)
    let successCount = 0

    try {
      for (const po of problematicPOs) {
        const { error } = await supabase
          .from('purchase_orders')
          .update({ status: 'Sedang diproses' })
          .eq('id', po.id)

        if (!error) successCount++
      }

      alert(`✅ Berhasil memperbaiki ${successCount} dari ${problematicPOs.length} PO!`)
      setFixedCount(prev => prev + successCount)
      setProblematicPOs([])
    } catch (error) {
      alert(`Berhasil memperbaiki ${successCount} PO`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Wrench className="text-orange-600" size={28} />
                Fix Data PO
              </h1>
              <p className="text-gray-600 mt-1">Detect dan perbaiki PO yang bermasalah</p>
            </div>
            <button
              onClick={scanForIssues}
              disabled={scanning}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
              {scanning ? 'Scanning...' : 'Scan PO'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-orange-500" size={24} />
                <div>
                  <p className="text-sm text-gray-600">PO Bermasalah</p>
                  <p className="text-2xl font-bold text-gray-800">{problematicPOs.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-green-500" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Sudah Diperbaiki</p>
                  <p className="text-2xl font-bold text-gray-800">{fixedCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <Wrench className="text-blue-500" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-lg font-bold text-gray-800">
                    {scanning ? 'Scanning...' : problematicPOs.length > 0 ? 'Ada Masalah' : 'Semua OK'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {problematicPOs.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">PO Bermasalah ({problematicPOs.length})</h2>
                <button
                  onClick={fixAllPOs}
                  disabled={loading}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50 text-sm"
                >
                  <Wrench size={16} />
                  {loading ? 'Memperbaiki...' : 'Fix Semua'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">PO Number</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Cabang</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Masalah</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">Barang Masuk</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">Gudang</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {problematicPOs.map((po) => (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{po.po_number}</div>
                          <div className="text-xs text-gray-500">ID: {po.id}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{po.branch_name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                            {po.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="text-orange-500 flex-shrink-0 mt-0.5" size={16} />
                            <span className="text-gray-700">{po.issue}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {po.has_barang_masuk ? (
                            <span className="text-green-600 font-medium">✓ {po.barang_masuk_count}</span>
                          ) : (
                            <span className="text-red-600 font-medium">✗ 0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {po.has_gudang ? (
                            <span className="text-green-600 font-medium">✓ {po.gudang_count}</span>
                          ) : (
                            <span className="text-red-600 font-medium">✗ 0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => fixPO(po)}
                            className="bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 flex items-center gap-1 mx-auto text-xs"
                          >
                            <Wrench size={14} />
                            Fix
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!scanning && problematicPOs.length === 0 && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Belum Ada Scan</h3>
              <p className="text-gray-600">Klik "Scan PO" untuk mencari PO yang bermasalah</p>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">💡 Penyebab Data Bermasalah:</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Status PO diubah manual tanpa melalui workflow</li>
              <li>• Data barang_masuk/gudang dihapus manual</li>
              <li>• Error saat proses penyimpanan data</li>
              <li>• Bug aplikasi atau database constraint issues</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-yellow-200">
              <p className="text-sm font-medium text-yellow-800">🔧 Pencegahan:</p>
              <p className="text-xs text-yellow-700">Selalu gunakan workflow resmi untuk mengubah status PO. Hindari edit manual di database.</p>
            </div>
          </div>
        </div>
      </PageAccessControl>
    </Layout>
  )
}
