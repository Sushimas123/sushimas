"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Package, ArrowLeft, Save, Camera, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import { lockPO, unlockPO, checkPOLock } from '@/src/utils/poLock'

interface POData {
  id: number
  po_number: string
  po_date: string
  cabang_id: number
  supplier_id: number
  status: string
  supplier_name?: string
  branch_name?: string
  total_harga?: number
  items?: POItem[]
}

interface POItem {
  id: number
  product_id: number
  product_name: string
  qty: number
  harga: number
}

export default function FinishPO() {
  const [poData, setPOData] = useState<POData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    tanggal_barang_sampai: new Date().toISOString().split('T')[0],
    invoice_number: '',
    foto_barang: null as File | null,
    keterangan: ''
  })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [receivedItems, setReceivedItems] = useState<Record<number, {qty: number, harga: number, status: 'received' | 'partial' | 'not_received'}>>({})

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const poId = urlParams.get('id')
    
    if (poId && !isNaN(parseInt(poId))) {
      initializePage(parseInt(poId))
    } else {
      alert('PO ID tidak ditemukan')
      window.location.href = '/purchaseorder'
    }
    
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      // Unlock PO when leaving page
      if (poId) {
        const poIdNum = parseInt(poId)
        if (!isNaN(poIdNum)) unlockPO(poIdNum)
      }
    }
  }, [])

  const initializePage = async (poId: number) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    
    // Check if PO is locked
    const lockStatus = await checkPOLock(poId)
    if (lockStatus.isLocked) {
      const shouldForceUnlock = confirm(
        `PO sedang diproses oleh ${lockStatus.lockedBy}.\n\nKlik OK untuk force unlock (hanya admin), atau Cancel untuk kembali.`
      )
      
      if (shouldForceUnlock) {
        const { forceUnlockPO } = await import('@/src/utils/poLock')
        const result = await forceUnlockPO(poId, user.id_user)
        if (!result.success) {
          alert(result.message)
          window.location.href = '/purchaseorder'
          return
        }
      } else {
        window.location.href = '/purchaseorder'
        return
      }
    }
    
    // Lock the PO
    const lockResult = await lockPO(poId, user.id_user, user.nama_lengkap || user.username)
    if (!lockResult.success) {
      alert(lockResult.message)
      window.location.href = '/purchaseorder'
      return
    }
    
    fetchPOData(poId)
  }

  const fetchPOData = async (poId: number) => {
    try {
      console.log('Fetching PO data for ID:', poId)
      
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single()

      if (poError) {
        console.error('Error fetching PO:', poError)
        throw poError
      }

      if (!po) {
        throw new Error('PO tidak ditemukan')
      }

      console.log('PO data:', po)
      
      // Load existing invoice number if PO already has arrival date
      if (po.tanggal_barang_sampai) {
        const { data: barangMasuk } = await supabase
          .from('barang_masuk')
          .select('invoice_number')
          .eq('no_po', po.po_number)
          .limit(1)
          .single()
        
        if (barangMasuk?.invoice_number) {
          setFormData(prev => ({
            ...prev,
            invoice_number: barangMasuk.invoice_number,
            tanggal_barang_sampai: po.tanggal_barang_sampai
          }))
        }
        
        // Load existing photo if exists
        const { data: files } = await supabase.storage
          .from('po-photos')
          .list('', { search: po.po_number })
        
        if (files && files.length > 0) {
          const { data } = supabase.storage
            .from('po-photos')
            .getPublicUrl(files[0].name)
          setPreviewUrl(data.publicUrl)
        }
      }

      // Get supplier name
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('nama_supplier')
        .eq('id_supplier', po.supplier_id)
        .single()

      // Get branch name
      const { data: branch } = await supabase
        .from('branches')
        .select('nama_branch')
        .eq('id_branch', po.cabang_id)
        .single()

      // Get PO items
      const { data: items } = await supabase
        .from('po_items')
        .select('*')
        .eq('po_id', poId)

      console.log('PO items:', items)

      // Get product names and prices for each item
      const poItems = await Promise.all(
        (items || []).map(async (item) => {
          const { data: product } = await supabase
            .from('nama_product')
            .select('product_name, harga')
            .eq('id_product', item.product_id)
            .single()

          return {
            ...item,
            product_name: product?.product_name || 'Unknown Product',
            harga: product?.harga || 0
          }
        })
      )

      console.log('Final PO items with products:', poItems)

      setPOData({
        ...po,
        supplier_name: supplier?.nama_supplier || 'Unknown',
        branch_name: branch?.nama_branch || 'Unknown',
        items: poItems
      })

      // Initialize received items with original PO quantities and prices
      const initialReceived: Record<number, {qty: number, harga: number, status: 'received' | 'partial' | 'not_received'}> = {}
      poItems.forEach(item => {
        initialReceived[item.id] = {
          qty: item.qty,
          harga: item.harga || 0,
          status: 'received'
        }
      })
      setReceivedItems(initialReceived)
      
    } catch (error) {
      console.error('Error fetching PO data:', error)
      alert('Gagal memuat data PO: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('File harus berupa gambar')
        return
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file maksimal 5MB')
        return
      }
      
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setFormData(prev => ({ ...prev, foto_barang: file }))
    }
  }

  const handleReceivedItemChange = (itemId: number, field: 'qty' | 'harga' | 'status', value: number | string) => {
    setReceivedItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: field === 'status' ? value as 'received' | 'partial' | 'not_received' : Number(value)
      }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (!poData) {
        throw new Error('Data PO tidak tersedia')
      }

      if (!formData.invoice_number.trim()) {
        throw new Error('Invoice number harus diisi')
      }

      if (!formData.foto_barang && !previewUrl) {
        throw new Error('Foto barang sampai harus diupload')
      }

      let fileName = null
      
      // Upload photo if provided
      if (formData.foto_barang) {
        try {
          const fileExt = formData.foto_barang.name.split('.').pop()
          fileName = `${poData.po_number}_${Date.now()}.${fileExt}`
          
          const { error: uploadError } = await supabase.storage
            .from('po-photos')
            .upload(fileName, formData.foto_barang, {
              cacheControl: '3600',
              upsert: true
            })

          if (uploadError) {
            console.error('Upload error details:', uploadError)
            throw new Error(`Gagal upload foto: ${uploadError.message}`)
          }
        } catch (err) {
          console.error('Upload exception:', err)
          throw new Error(`Gagal upload foto: ${err instanceof Error ? err.message : 'Network error'}`)
        }
      }

      // Update PO status and arrival date
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'Barang sampai',
          tanggal_barang_sampai: formData.tanggal_barang_sampai
        })
        .eq('id', poData.id)

      if (updateError) {
        throw new Error(`Gagal update PO: ${updateError.message}`)
      }

      // Save received items to barang_masuk table and update prices
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      
      for (const [itemId, receivedData] of Object.entries(receivedItems)) {
        // Only save items that were actually received
        if (receivedData.status !== 'not_received' && receivedData.qty > 0) {
          const poItem = poData.items?.find(item => item.id === parseInt(itemId))
          if (poItem) {
            // Get current product details
            const { data: productDetails } = await supabase
              .from('nama_product')
              .select('unit_kecil, unit_besar, satuan_kecil, satuan_besar, harga')
              .eq('id_product', poItem.product_id)
              .single()

            // Update po_items with actual received price (don't update master price)
            const { error: poItemUpdateError } = await supabase
              .from('po_items')
              .update({ 
                actual_price: receivedData.harga,
                received_qty: receivedData.qty
              })
              .eq('id', parseInt(itemId))
            
            console.log(`Updated PO item ${itemId} with actual_price: ${receivedData.harga}, received_qty: ${receivedData.qty}`)
            
            if (poItemUpdateError) {
              console.error(`Error updating PO item ${itemId}:`, poItemUpdateError)
            }
            
            // Record price difference in po_price_history if there's a difference
            const originalPrice = poItem.harga || 0
            if (Math.abs(receivedData.harga - originalPrice) > 0.01) {
              const { error: historyError } = await supabase
                .from('po_price_history')
                .insert({
                  po_id: poData.id,
                  po_number: poData.po_number,
                  product_id: poItem.product_id,
                  po_price: originalPrice,
                  actual_price: receivedData.harga,
                  price_difference: receivedData.harga - originalPrice,
                  percentage_difference: originalPrice > 0 ? ((receivedData.harga - originalPrice) / originalPrice) * 100 : 0,
                  master_price_at_time: productDetails?.harga || 0,
                  received_date: formData.tanggal_barang_sampai,
                  invoice_number: formData.invoice_number,
                  notes: `Price difference recorded for ${poItem.product_name}`,
                  created_by: user.id_user || null
                })
              
              if (historyError) {
                console.error(`Error saving PO price history for ${poItem.product_name}:`, historyError)
              }
            }
            
            // Only update master price if this is significantly different and user confirms
            const currentPrice = productDetails?.harga || 0
            const actualPrice = receivedData.harga
            
            const threshold = currentPrice > 0 ? currentPrice * 0.1 : 1000 // 10% or Rp 1000 if price is 0
            if (Math.abs(actualPrice - currentPrice) > threshold) {
              const shouldUpdateMaster = confirm(
                `Harga aktual ${poItem.product_name} (${new Intl.NumberFormat('id-ID', {style: 'currency', currency: 'IDR'}).format(actualPrice)}) berbeda signifikan dari harga master (${new Intl.NumberFormat('id-ID', {style: 'currency', currency: 'IDR'}).format(currentPrice)}).\n\nApakah ingin mengupdate harga master? Ini akan mempengaruhi PO lain yang belum selesai.`
              )
              
              if (shouldUpdateMaster) {
                const { error: priceUpdateError } = await supabase
                  .from('nama_product')
                  .update({ harga: actualPrice })
                  .eq('id_product', poItem.product_id)
                
                if (!priceUpdateError) {
                  // Add to price history
                  const { error: priceHistoryError } = await supabase
                    .from('price_history')
                    .insert({
                      product_id: poItem.product_id,
                      old_price: currentPrice,
                      new_price: actualPrice,
                      price_change: actualPrice - currentPrice,
                      change_percentage: currentPrice > 0 ? ((actualPrice - currentPrice) / currentPrice) * 100 : 0,
                      change_reason: 'po_completion',
                      po_number: poData.po_number,
                      notes: `Price updated from PO completion. Invoice: ${formData.invoice_number}`,
                      created_by: user.id_user || null
                    })
                  
                  if (priceHistoryError) {
                    console.error(`Error saving price history for ${poItem.product_name}:`, priceHistoryError)
                  }
                }
              }
            }

            const { error: barangMasukError } = await supabase
              .from('barang_masuk')
              .insert({
                tanggal: formData.tanggal_barang_sampai,
                id_barang: poItem.product_id,
                jumlah: parseFloat(receivedData.qty.toString()),
                qty_po: poItem.qty, // Original PO quantity
                unit_kecil: productDetails?.satuan_kecil || null,
                unit_besar: productDetails?.satuan_besar || null,
                satuan_kecil: productDetails?.unit_kecil || null,
                satuan_besar: productDetails?.unit_besar || null,
                harga: receivedData.harga,
                harga_po: poItem.harga, // Store original PO price
                id_supplier: poData.supplier_id,
                id_branch: poData.cabang_id,
                no_po: poData.po_number,
                invoice_number: formData.invoice_number,
                keterangan: `${formData.keterangan || ''} - Status: ${receivedData.status}`.trim(),
                created_by: user.id_user || null
              })

            if (barangMasukError) {
              console.error(`Error saving barang masuk for item ${itemId}:`, barangMasukError)
            }
          }
        }
      }

      // Unlock PO after successful submission
      await unlockPO(poData.id)
      
      alert('Data barang sampai berhasil disimpan ke barang masuk!')
      window.location.href = '/purchaseorder/barang_masuk'
    } catch (error) {
      console.error('Error saving:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Gagal menyimpan data: ${errorMessage}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Memuat data...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!poData) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center">
            <p className="text-red-600">Data PO tidak ditemukan</p>
            <a href="/purchaseorder" className="text-blue-600 hover:underline mt-2 inline-block">
              Kembali ke Purchase Order
            </a>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="text-blue-600" size={28} />
                Konfirmasi Barang Sampai
              </h1>
              <p className="text-gray-600 mt-1">
                PO #{poData.po_number} - {poData.supplier_name}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-1">
            <div className="grid grid-cols-2 md:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Nomor PO:</span>
                <p className="font-medium">{poData.po_number}</p>
              </div>
              <div>
                <span className="text-gray-600">Cabang:</span>
                <p className="font-medium">{poData.branch_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Tanggal PO:</span>
                <p className="font-medium">{new Date(poData.po_date).toLocaleDateString('id-ID')}</p>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-medium text-blue-600">{poData.status}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Barang Sampai *
                </label>
                <input
                  type="date"
                  value={formData.tanggal_barang_sampai}
                  onChange={(e) => setFormData(prev => ({ ...prev, tanggal_barang_sampai: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nomor Invoice *
                </label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Masukkan nomor invoice"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foto NOTA !!!!! *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="foto-upload"
                  />
                  {previewUrl ? (
                    <div className="space-y-2">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded-lg mx-auto"
                      />
                      <p className="text-sm text-center text-gray-600">{formData.foto_barang?.name}</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (previewUrl) URL.revokeObjectURL(previewUrl)
                          setPreviewUrl(null)
                          setFormData(prev => ({ ...prev, foto_barang: null }))
                        }}
                        className="text-red-600 text-sm hover:underline block mx-auto"
                      >
                        Hapus foto
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="foto-upload"
                      className="cursor-pointer flex flex-col items-center space-y-2"
                    >
                      <Camera className="text-gray-400" size={32} />
                      <span className="text-sm text-gray-600">Klik untuk upload foto</span>
                      <span className="text-xs text-gray-500">
                        Format: JPG, PNG (Max 5MB)
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-700 mb-2 text-sm">Items Purchase Order</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Barang</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty PO</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty Terima</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Harga PO</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Harga Aktual</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {poData.items?.map(item => (
                      <tr key={item.id}>
                        <td className="px-2 py-2">
                          <div className="font-medium text-gray-900 text-xs leading-tight">{item.product_name}</div>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600">
                          {item.qty}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={receivedItems[item.id]?.qty || 0}
                            onChange={(e) => handleReceivedItemChange(item.id, 'qty', e.target.value)}
                            className="w-16 border border-gray-300 rounded px-1 py-1 text-xs"
                            disabled={receivedItems[item.id]?.status === 'not_received'}
                          />
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600">
                          {new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(item.harga || 0)}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={receivedItems[item.id]?.harga || 0}
                            onChange={(e) => handleReceivedItemChange(item.id, 'harga', e.target.value)}
                            className="w-20 border border-gray-300 rounded px-1 py-1 text-xs"
                            disabled={receivedItems[item.id]?.status === 'not_received'}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={receivedItems[item.id]?.status || 'received'}
                            onChange={(e) => handleReceivedItemChange(item.id, 'status', e.target.value)}
                            className="border border-gray-300 rounded px-1 py-1 text-xs w-full"
                          >
                            <option value="received">Penuh</option>
                            <option value="partial">Sebagian</option>
                            <option value="not_received">Tidak</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keterangan
              </label>
              <textarea
                value={formData.keterangan}
                onChange={(e) => setFormData(prev => ({ ...prev, keterangan: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                rows={3}
                placeholder="Keterangan tambahan (opsional)"
              />
            </div>

            <div className="flex justify-between pt-4">
              <a 
                href="/purchaseorder" 
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <ArrowLeft size={16} />
                Kembali
              </a>
              <button 
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={16} />
                {submitting ? 'Menyimpan...' : 'Konfirmasi Barang Sampai'}
              </button>
            </div>
          </form>
        </div>
      </PageAccessControl>
    </Layout>
  )
}