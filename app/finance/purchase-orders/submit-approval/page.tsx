"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { ArrowLeft, Upload, FileText, CheckCircle } from 'lucide-react'
import Layout from '../../../../components/Layout'
import PageAccessControl from '../../../../components/PageAccessControl'

export default function SubmitApprovalPage() {
  const [po, setPO] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    total_tagih: 0,
    keterangan: '',
    photo: null as File | null
  })

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const poId = urlParams.get('id')
    
    if (poId && !isNaN(parseInt(poId))) {
      fetchPOData(parseInt(poId))
    } else {
      alert('PO ID tidak ditemukan')
      window.location.href = '/finance/purchase-orders'
    }
  }, [])

  const fetchPOData = async (poId: number) => {
    try {
      const { data: poData, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single()

      if (error) throw error

      // Get supplier name
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('nama_supplier')
        .eq('id_supplier', poData.supplier_id)
        .single()

      // Get branch name
      const { data: branch } = await supabase
        .from('branches')
        .select('nama_branch')
        .eq('id_branch', poData.cabang_id)
        .single()

      // Calculate total_po
      const { data: items } = await supabase
        .from('po_items')
        .select('qty, harga, actual_price, received_qty, product_id')
        .eq('po_id', poId)

      let totalPO = 0
      for (const item of items || []) {
        if (item.actual_price && item.received_qty) {
          totalPO += item.received_qty * item.actual_price
        } else if (item.harga) {
          totalPO += item.qty * item.harga
        } else {
          const { data: product } = await supabase
            .from('nama_product')
            .select('harga')
            .eq('id_product', item.product_id)
            .single()
          totalPO += item.qty * (product?.harga || 0)
        }
      }

      const enrichedData = {
        ...poData,
        supplier_name: supplier?.nama_supplier || 'Unknown Supplier',
        branch_name: branch?.nama_branch || 'Unknown Branch',
        total_po: totalPO
      }

      setPO(enrichedData)
      setFormData({
        total_tagih: totalPO,
        keterangan: enrichedData.keterangan || '',
        photo: null
      })
    } catch (error) {
      console.error('Error fetching PO data:', error)
      alert('Gagal memuat data PO')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    console.log('Submitting data:', formData)
    console.log('PO ID:', po.id)

    setSubmitting(true)
    try {
      let photoPath = null
      if (formData.photo) {
        const fileName = `${po.po_number}-${Date.now()}.${formData.photo.name.split('.').pop()}`
        const { error: uploadError } = await supabase.storage
          .from('po-photos')
          .upload(fileName, formData.photo)
        if (uploadError) throw uploadError
        photoPath = fileName
      }

      const updateData = {
        total_tagih: formData.total_tagih,
        keterangan: formData.keterangan,
        approval_photo: photoPath,
        approval_status: 'pending',
        submitted_at: new Date().toISOString()
      }
      
      console.log('Update data:', updateData)

      const { data, error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', po.id)
        .select()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Updated record:', data)
      alert('Berhasil submit untuk approval!')
      window.location.href = '/finance/purchase-orders'
    } catch (error) {
      console.error('Error submitting for approval:', error)
      alert('Gagal submit untuk approval')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
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

  return (
    <Layout>
      <PageAccessControl pageName="finance">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <FileText className="text-orange-600" size={28} />
                Submit for Approval
              </h1>
              <p className="text-gray-600 mt-1">
                PO #{po?.po_number} - {po?.supplier_name}
              </p>
            </div>
            <a 
              href="/finance/purchase-orders" 
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <ArrowLeft size={16} />
              Kembali
            </a>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow border p-6 space-y-6">
            <div className="bg-blue-50 p-4 rounded-md mb-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Informasi PO</h3>
              <p className="text-sm text-blue-700">Total PO: <span className="font-semibold">{formatCurrency((po as any)?.total_po || 0)}</span></p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Tagih <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.total_tagih}
                onChange={(e) => setFormData({...formData, total_tagih: parseFloat(e.target.value) || 0})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keterangan <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.keterangan}
                onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                rows={4}
                placeholder="Tambahkan keterangan..."                
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Foto</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFormData({...formData, photo: e.target.files?.[0] || null})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-md hover:bg-orange-700 disabled:bg-gray-400"
              >
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
              <a
                href="/finance/purchase-orders"
                className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50 text-center"
              >
                Batal
              </a>
            </div>
          </form>
        </div>
      </PageAccessControl>
    </Layout>
  )
}