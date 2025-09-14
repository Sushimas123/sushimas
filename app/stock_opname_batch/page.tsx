'use client'

import React, { useEffect, useState, useCallback } from "react"
import { supabase } from "@/src/lib/supabaseClient"
import { Edit2, Trash2, Plus, ChevronDown, ChevronRight, Loader2, FileText, Menu, X, Search } from "lucide-react"
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'
import jsPDF from 'jspdf'

export default function StockOpnameBatchPage() {
  const [batches, setBatches] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])
  const [branchProducts, setBranchProducts] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [selectedSubCategory, setSelectedSubCategory] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingBranchData, setLoadingBranchData] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null)
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null)
  const [batchDetails, setBatchDetails] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    opname_date: new Date().toISOString().split('T')[0],
    opname_time: '12:00'
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [processingBatch, setProcessingBatch] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Check screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  useEffect(() => {
    fetchBatches()
    fetchBranches()
    fetchSubCategories()
  }, [])

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = searchTerm === '' || 
      batch.batch_id.toString().includes(searchTerm) ||
      batch.pic_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.sub_category.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesBranch = filterBranch === '' || batch.branch_code === filterBranch
    const matchesStatus = filterStatus === '' || batch.status === filterStatus
    
    return matchesSearch && matchesBranch && matchesStatus
  })

  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedBatches = filteredBatches.slice(startIndex, startIndex + itemsPerPage)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterBranch, filterStatus])

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("stock_opname_batch_summary")
      .select("*")
      .order("batch_date", { ascending: false })
      .order("batch_id", { ascending: false })
    if (!error) setBatches(data || [])
    setLoading(false)
  }, [])

  const fetchBranches = useCallback(async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("kode_branch, nama_branch")
      .eq("is_active", true)
      .order("nama_branch")
    if (!error) setBranches(data || [])
  }, [])

  const fetchSubCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("nama_product")
      .select("sub_category")
      .not("sub_category", "is", null)
      .order("sub_category")
    
    if (!error) {
      const uniqueSubCategories = [...new Set(data?.map(item => item.sub_category).filter(Boolean))]
      setSubCategories(uniqueSubCategories.map(sub => ({ sub_category: sub })))
    }
  }, [])

  const fetchBranchProducts = useCallback(async (branchCode: string, subCategory: string, soDate?: string, soTime?: string) => {
    if (!branchCode || !subCategory) {
      setBranchProducts([])
      return
    }
    
    setLoadingBranchData(true)
    
    try {
      // Query produk dengan filter cabang dari product_branches
      const { data: productsData, error: productError } = await supabase
        .from("nama_product")
        .select(`
          id_product, 
          product_name, 
          unit_kecil, 
          sub_category,
          product_branches(branch_code)
        `)
        .eq("sub_category", subCategory)
        .order("product_name")
      
      if (productError || !productsData) {
        setBranchProducts([])
        return
      }
      
      // Filter produk berdasarkan cabang yang dipilih
      const filteredProducts = productsData.filter(product => 
        product.product_branches?.some((pb: any) => pb.branch_code === branchCode)
      )
      
      if (filteredProducts.length === 0) {
        setBranchProducts([])
        showToast(`ℹ️ Tidak ada produk ${subCategory} yang terdaftar untuk cabang ini`, 'error')
        return
      }
      
      // Gunakan tanggal dan waktu dari parameter atau dari form
      const cutoffDate = soDate || form.opname_date
      const cutoffTime = soTime || form.opname_time || '12:00:00'
      const cutoffDateTime = `${cutoffDate} ${cutoffTime}`
      
      const stockPromises = filteredProducts.map(async (product) => {
        try {
          // Stok sistem saat SO (historical)
          const { data: stockData, error } = await supabase
            .from("gudang")
            .select("total_gudang")
            .eq("cabang", branchCode)
            .eq("id_product", product.id_product)
            .lte("tanggal", cutoffDateTime)
            .order("tanggal", { ascending: false })
            .order("order_no", { ascending: false })
            .limit(1)
            .maybeSingle()
          
          // Stok sistem terkini (real-time)
          const { data: currentStockData, error: currentError } = await supabase
            .from("gudang")
            .select("total_gudang")
            .eq("cabang", branchCode)
            .eq("id_product", product.id_product)
            .order("tanggal", { ascending: false })
            .order("order_no", { ascending: false })
            .limit(1)
            .maybeSingle()
          
          return {
            ...product,
            system_stock: (!error && stockData) ? stockData.total_gudang : 0,
            current_system_stock: (!currentError && currentStockData) ? currentStockData.total_gudang : 0,
            physical_stock: 0,
            notes: ''
          }
        } catch {
          return {
            ...product,
            system_stock: 0,
            current_system_stock: 0,
            physical_stock: 0,
            notes: ''
          }
        }
      })
      
      const processedData = await Promise.all(stockPromises)
      setBranchProducts(prev => {
        const newData = processedData.map(p => {
          // Preserve existing physical_stock and notes if product already exists
          const existing = prev.find(existing => existing.id_product === p.id_product)
          return {
            id_product: p.id_product,
            product_name: p.product_name,
            system_stock: p.system_stock,
            current_system_stock: p.current_system_stock,
            unit: p.unit_kecil || 'pcs',
            sub_category: p.sub_category,
            physical_stock: existing?.physical_stock || 0,
            notes: existing?.notes || ''
          }
        })
        return newData
      })
    } catch (error) {
      setBranchProducts([])
      showToast('❌ Gagal memuat produk', 'error')
    } finally {
      setLoadingBranchData(false)
    }
  }, [form.opname_date, form.opname_time])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!selectedBranch) newErrors.branch_code = "Cabang harus dipilih"
    if (!selectedSubCategory) newErrors.sub_category = "Sub kategori harus dipilih"
    if (!form.opname_date) newErrors.opname_date = "Tanggal harus diisi"
    if (!form.pic_name?.trim()) newErrors.pic_name = "Nama PIC harus diisi"
    
    const productsWithPhysicalStock = branchProducts.filter(p => p.physical_stock > 0 || p.physical_stock === 0)
    
    if (productsWithPhysicalStock.length === 0) {
      newErrors.physical_stock = "Minimal satu produk harus memiliki stok fisik"
    }
    
    // Validasi stok fisik tidak boleh negatif
    const hasNegativeStock = branchProducts.some(p => p.physical_stock < 0)
    if (hasNegativeStock) {
      newErrors.physical_stock = "Stok fisik tidak boleh negatif"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    
    setLoading(true)
    try {
      const productsWithPhysicalStock = branchProducts.filter(p => p.physical_stock > 0 || p.physical_stock === 0)
      
      if (editingBatchId) {
        const { error: updateError } = await supabase
          .from('stock_opname_batch')
          .update({
            batch_date: form.opname_date,
            batch_time: form.opname_time || '12:00:00',
            branch_code: selectedBranch,
            sub_category: selectedSubCategory,
            pic_name: form.pic_name.trim()
          })
          .eq('batch_id', editingBatchId)
        
        if (updateError) throw updateError
        
        const { error: deleteError } = await supabase.from('stock_opname_detail').delete().eq('batch_id', editingBatchId)
        if (deleteError) throw deleteError
        
        const details = productsWithPhysicalStock.map(product => ({
          batch_id: editingBatchId,
          product_name: product.product_name,
          system_stock: product.system_stock_snapshot || product.system_stock,
          physical_stock: product.physical_stock,
          unit: product.unit,
          notes: product.notes || null
        }))
        
        const { error: insertError } = await supabase.from('stock_opname_detail').insert(details)
        if (insertError) throw insertError
        
        showToast('✅ Batch berhasil diperbarui', 'success')
      } else {
        const { data: batchData, error: batchError } = await supabase
          .from('stock_opname_batch')
          .insert({
            batch_date: form.opname_date,
            batch_time: form.opname_time || '12:00:00',
            branch_code: selectedBranch,
            sub_category: selectedSubCategory,
            pic_name: form.pic_name.trim(),
            status: 'pending'
          })
          .select('batch_id')
          .single()
        
        if (batchError || !batchData?.batch_id) throw batchError || new Error('Gagal membuat batch')
        
        const details = productsWithPhysicalStock.map(product => ({
          batch_id: batchData.batch_id,
          product_name: product.product_name,
          system_stock: product.system_stock,
          physical_stock: product.physical_stock,
          unit: product.unit,
          notes: product.notes || null
        }))
        
        const { error: insertError } = await supabase.from('stock_opname_detail').insert(details)
        if (insertError) throw insertError
        
        showToast('✅ Batch berhasil dibuat', 'success')
      }
      
      resetForm()
      fetchBatches()
      
    } catch (error: any) {
      showToast(`❌ Gagal menyimpan batch: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({
      opname_date: new Date().toISOString().split('T')[0],
      opname_time: '12:00'
    })
    setSelectedBranch('')
    setSelectedSubCategory('')
    setBranchProducts([])
    setShowAddForm(false)
    setEditing(false)
    setEditingBatchId(null)
    setErrors({})
  }

  const handleEditBatch = async (batchId: number) => {
    setLoading(true)
    try {
      const { data: batchData, error: batchError } = await supabase
        .from('stock_opname_batch')
        .select('*')
        .eq('batch_id', batchId)
        .single()
      
      if (batchError || !batchData) throw new Error('Batch tidak ditemukan')
      
      // If approved, revert to pending and delete gudang entries
      if (batchData.status === 'approved') {
        if (!confirm('⚠️ Batch yang sudah disetujui akan dikembalikan ke status pending dan penyesuaian stok akan dihapus. Lanjutkan?')) {
          setLoading(false)
          return
        }
        await revertApprovedBatch(batchId)
      }
      
      const { data: detailData, error: detailError } = await supabase
        .from('stock_opname_detail')
        .select('*')
        .eq('batch_id', batchId)
      
      if (detailError) throw detailError
      
      // Format time correctly for input[type="time"]
      const batchTime = batchData.batch_time ? batchData.batch_time.substring(0, 5) : '12:00'
      
      setForm({
        opname_date: batchData.batch_date,
        opname_time: batchTime,
        pic_name: batchData.pic_name
      })
      
      setSelectedBranch(batchData.branch_code)
      setSelectedSubCategory(batchData.sub_category)
      setEditingBatchId(batchId)
      setEditing(true)
      setShowAddForm(true)
      
      await fetchBranchProducts(batchData.branch_code, batchData.sub_category, batchData.batch_date, batchData.batch_time)
      
      // Give time for products to load before setting details
      setTimeout(() => {
        setBranchProducts(prev => prev.map(product => {
          const detail = detailData?.find(d => d.product_name === product.product_name)
          return detail ? {
            ...product,
            system_stock_snapshot: detail.system_stock,
            physical_stock: detail.physical_stock,
            notes: detail.notes || ''
          } : product
        }))
      }, 300)
      
    } catch (error: any) {
      showToast(`❌ Gagal memuat batch: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBatch = async (batchId: number) => {
    if (!confirm('Hapus batch ini?')) return
    
    try {
      setProcessingBatch(batchId)
      await supabase.from('stock_opname_batch').delete().eq('batch_id', batchId)
      showToast('✅ Batch berhasil dihapus', 'success')
      fetchBatches()
    } catch (error) {
      showToast('❌ Gagal menghapus batch', 'error')
    } finally {
      setProcessingBatch(null)
    }
  }

  const handleApproveBatch = async (batchId: number) => {
    if (!confirm('⚠️ Setujui batch ini? Tindakan ini akan memperbarui catatan stok dan mengunci data sebelumnya.')) return
    
    setLoading(true)
    setProcessingBatch(batchId)
    try {
      const { data: batchData, error: batchError } = await supabase
        .from('stock_opname_batch')
        .select('*')
        .eq('batch_id', batchId)
        .single()
      
      if (batchError || !batchData) throw new Error('Batch tidak ditemukan')
      
      const { data: detailData, error: detailError } = await supabase
        .from('stock_opname_detail')
        .select('*')
        .eq('batch_id', batchId)
        .gt('physical_stock', 0)
      
      if (detailError) throw detailError
      if (!detailData || detailData.length === 0) throw new Error('Tidak ada data detail yang ditemukan')
      
      // Lock all records before SO date for affected products
      const soDateTime = `${batchData.batch_date}T${batchData.batch_time}`
      const lockReference = `BATCH-${batchId}`
      
      for (const detail of detailData) {
        try {
          const { data: productData, error: productError } = await supabase
            .from('nama_product')
            .select('id_product')
            .eq('product_name', detail.product_name)
            .single()
          
          if (productError || !productData) {
            console.warn(`Produk tidak ditemukan: ${detail.product_name}`)
            continue
          }
          
          // Lock records before SO date that are not already locked
          const { error: lockError } = await supabase
            .from('gudang')
            .update({
              is_locked: true,
              locked_by_so: lockReference,
              locked_date: new Date().toISOString()
            })
            .eq('id_product', productData.id_product)
            .eq('cabang', batchData.branch_code)
            .lt('tanggal', soDateTime)
            .eq('is_locked', false)
          
          if (lockError) console.warn(`Error kunci untuk ${detail.product_name}:`, lockError)
          
          const difference = detail.physical_stock - (detail.system_stock || 0)
          if (difference === 0) continue
          
          const gudangEntry = {
            id_product: productData.id_product,
            tanggal: soDateTime,
            jumlah_masuk: difference > 0 ? Math.abs(difference) : 0,
            jumlah_keluar: difference < 0 ? Math.abs(difference) : 0,
            total_gudang: detail.physical_stock,
            nama_pengambil_barang: `SO Batch oleh ${batchData.pic_name}`,
            cabang: batchData.branch_code,
            source_type: 'stock_opname_batch',
            source_reference: lockReference,
            is_locked: false
          }
          
          const { error: insertError } = await supabase.from('gudang').insert(gudangEntry)
          if (insertError) throw insertError
          
          await recalculateFromDate(productData.id_product, batchData.branch_code, soDateTime)
        } catch (error: any) {
          console.error(`Error memproses ${detail.product_name}:`, error)
        }
      }
      
      const { error: statusError } = await supabase
        .from('stock_opname_batch')
        .update({ status: 'approved' })
        .eq('batch_id', batchId)
      
      if (statusError) throw statusError
      
      showToast('✅ Batch disetujui dan data berhasil dikunci', 'success')
      fetchBatches()
      
    } catch (error: any) {
      showToast(`❌ Gagal menyetujui batch: ${error.message}`, 'error')
    } finally {
      setLoading(false)
      setProcessingBatch(null)
    }
  }

  const toggleBatchExpansion = async (batchId: number) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null)
      setBatchDetails([])
    } else {
      setExpandedBatch(batchId)
      
      const { data } = await supabase
        .from('stock_opname_detail')
        .select('*')
        .eq('batch_id', batchId)
        .order('product_name')
      
      setBatchDetails(data || [])
    }
  }

  const handlePhysicalStockChange = (productName: string, value: string) => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue < 0) return
    
    setBranchProducts(prev => prev.map(p => 
      p.product_name === productName 
        ? { ...p, physical_stock: numValue }
        : p
    ))
  }

  const handleNotesChange = (productName: string, value: string) => {
    setBranchProducts(prev => prev.map(p => 
      p.product_name === productName 
        ? { ...p, notes: value }
        : p
    ))
  }

  const handleRevertBatch = async (batchId: number) => {
    if (!confirm('⚠️ Kembalikan batch ini ke status pending? Tindakan ini akan menghapus semua penyesuaian stok.')) return
    
    setLoading(true)
    setProcessingBatch(batchId)
    try {
      await revertApprovedBatch(batchId)
      showToast('✅ Batch berhasil dikembalikan ke pending', 'success')
      fetchBatches()
    } catch (error: any) {
      showToast(`❌ Gagal mengembalikan batch: ${error.message}`, 'error')
    } finally {
      setLoading(false)
      setProcessingBatch(null)
    }
  }

  const revertApprovedBatch = async (batchId: number) => {
    const lockReference = `BATCH-${batchId}`
    
    // Unlock records that were locked by this batch
    const { error: unlockError } = await supabase
      .from('gudang')
      .update({
        is_locked: false,
        locked_by_so: null,
        locked_date: null
      })
      .eq('locked_by_so', lockReference)
    
    if (unlockError) throw unlockError
    
    // Delete gudang entries for this batch
    const { error: deleteError } = await supabase
      .from('gudang')
      .delete()
      .eq('source_reference', lockReference)
    
    if (deleteError) throw deleteError
    
    // Update batch status to pending
    const { error: statusError } = await supabase
      .from('stock_opname_batch')
      .update({ status: 'pending' })
      .eq('batch_id', batchId)
    
    if (statusError) throw statusError
    
    // Recalculate all affected products
    const { data: detailData } = await supabase
      .from('stock_opname_detail')
      .select('product_name')
      .eq('batch_id', batchId)
    
    const { data: batchData } = await supabase
      .from('stock_opname_batch')
      .select('branch_code, batch_date, batch_time')
      .eq('batch_id', batchId)
      .single()
    
    if (detailData && batchData) {
      for (const detail of detailData) {
        const { data: productData } = await supabase
          .from('nama_product')
          .select('id_product')
          .eq('product_name', detail.product_name)
          .single()
        
        if (productData) {
          await recalculateFromDate(productData.id_product, batchData.branch_code, `${batchData.batch_date}T${batchData.batch_time}`)
        }
      }
    }
  }

  const exportToPDF = async (batchId: number) => {
    try {
      setProcessingBatch(batchId)
      
      // Get batch data
      const { data: batchData, error: batchError } = await supabase
        .from('stock_opname_batch_summary')
        .select('*')
        .eq('batch_id', batchId)
        .single()
      
      if (batchError || !batchData) throw new Error('Batch tidak ditemukan')
      
      // Get batch details
      const { data: detailData, error: detailError } = await supabase
        .from('stock_opname_detail')
        .select('*')
        .eq('batch_id', batchId)
        .order('product_name')
      
      if (detailError) throw detailError

      const pdf = new jsPDF()
      
      // Add title
      pdf.setFontSize(16)
      pdf.text('LAPORAN STOCK OPNAME', 105, 15, { align: 'center' })
      pdf.setFontSize(14)
      pdf.text(`BATCH-${batchId}`, 105, 25, { align: 'center' })
      
      // Add batch info
      pdf.setFontSize(10)
      let yPosition = 40
      
      pdf.text(`Tanggal SO: ${batchData.batch_date}`, 14, yPosition)
      pdf.text(`Waktu SO: ${batchData.batch_time?.substring(0, 5) || '12:00'}`, 14, yPosition + 6)
      pdf.text(`Cabang: ${batchData.nama_branch}`, 14, yPosition + 12)
      pdf.text(`Sub Kategori: ${batchData.sub_category}`, 14, yPosition + 18)
      pdf.text(`PIC: ${batchData.pic_name}`, 14, yPosition + 24)
      pdf.text(`Status: ${batchData.status}`, 14, yPosition + 30)
      
      // Add table headers
      yPosition += 45
      pdf.setFillColor(240, 240, 240)
      pdf.rect(14, yPosition - 5, 182, 8, 'F')
      
      pdf.text('No', 16, yPosition)
      pdf.text('Nama Produk', 25, yPosition)
      pdf.text('Stok Sistem', 100, yPosition)
      pdf.text('Stok Fisik', 125, yPosition)
      pdf.text('Selisih', 150, yPosition)
      pdf.text('Satuan', 170, yPosition)
      pdf.text('Catatan', 185, yPosition)
      
      // Add table rows
      yPosition += 8
      detailData?.forEach((detail, index) => {
        if (yPosition > 270) { // New page if needed
          pdf.addPage()
          yPosition = 20
        }
        
        const difference = detail.physical_stock - (detail.system_stock || 0)
        
        pdf.text((index + 1).toString(), 16, yPosition)
        // Limit product name length to fit
        const productName = detail.product_name.length > 25 ? 
          detail.product_name.substring(0, 25) + '...' : detail.product_name
        pdf.text(productName, 25, yPosition)
        pdf.text(detail.system_stock.toString(), 100, yPosition)
        pdf.text(detail.physical_stock.toString(), 125, yPosition)
        pdf.text(difference.toFixed(2), 150, yPosition)
        pdf.text(detail.unit, 170, yPosition)
        pdf.text(detail.notes || '-', 185, yPosition)
        
        yPosition += 6
      })
      
      // Add footer info
      yPosition += 10
      pdf.text(`Total Produk: ${detailData?.length || 0}`, 14, yPosition)
      pdf.text(`Produk dengan Selisih: ${detailData?.filter(d => d.physical_stock !== d.system_stock).length || 0}`, 14, yPosition + 6)
      
      // Add signature section
      yPosition += 20
      pdf.text('Dibuat Oleh:', 30, yPosition)
      pdf.text('PIC Cabang:', 130, yPosition)
      
      yPosition += 25
      pdf.text('_________________', 30, yPosition)
      pdf.text('_________________', 130, yPosition)
      
      yPosition += 8
      pdf.text(batchData.pic_name, 30, yPosition)
      
      
      // Save the PDF
      pdf.save(`Laporan-Stock-Opname-BATCH-${batchId}.pdf`)
      
      showToast('✅ PDF berhasil diunduh', 'success')
      
    } catch (error: any) {
      showToast(`❌ Gagal export PDF: ${error.message}`, 'error')
    } finally {
      setProcessingBatch(null)
    }
  }

  const recalculateFromDate = async (idProduct: number, branchCode: string, fromDate: string) => {
    try {
      const { data: affectedRecords, error: recordsError } = await supabase
        .from('gudang')
        .select('*')
        .eq('id_product', idProduct)
        .eq('cabang', branchCode)
        .gt('tanggal', fromDate)
        .order('tanggal', { ascending: true })
        .order('order_no', { ascending: true })

      if (recordsError) throw recordsError
      if (!affectedRecords || affectedRecords.length === 0) return

      // Get previous total before the deleted SO record
      const { data: prevRecord, error: prevError } = await supabase
        .from('gudang')
        .select('total_gudang')
        .eq('id_product', idProduct)
        .eq('cabang', branchCode)
        .lt('tanggal', fromDate)
        .order('tanggal', { ascending: false })
        .order('order_no', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (prevError) throw prevError
      
      let runningTotal = prevRecord?.total_gudang || 0

      for (const record of affectedRecords) {
        try {
          runningTotal = runningTotal + record.jumlah_masuk - record.jumlah_keluar
          
          const { error: updateError } = await supabase
            .from('gudang')
            .update({ total_gudang: runningTotal })
            .eq('order_no', record.order_no)
          
          if (updateError) throw updateError
        } catch (error: any) {
          console.error(`Error memperbarui record ${record.order_no}:`, error)
        }
      }
    } catch (error: any) {
      console.error('Error recalculating from date:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-4">
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            <span className="ml-2">Memuat data...</span>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <PageAccessControl pageName="stock_opname_batch">
      <Layout>
        <div className="p-4">
          {toast && (
            <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}>
              {toast.message}
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-2xl font-bold">📊 Stock Opname Batch</h1>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus size={16} />
              {!isMobile && 'Tambah Batch'}
            </button>
          </div>

          {/* Mobile Search Bar */}
          {isMobile && (
            <div className="bg-white p-3 rounded-lg shadow mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari batch..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-md text-sm"
                  />
                </div>
                <button
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className="bg-gray-200 p-2 rounded-md"
                >
                  {showMobileFilters ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
              
              {showMobileFilters && (
                <div className="space-y-3 pt-2 border-t">
                  <div>
                    <select
                      value={filterBranch}
                      onChange={(e) => setFilterBranch(e.target.value)}
                      className="w-full border px-3 py-2 rounded-md text-sm"
                    >
                      <option value="">Semua Cabang</option>
                      {branches.map(branch => (
                        <option key={branch.kode_branch} value={branch.kode_branch}>
                          {branch.nama_branch}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full border px-3 py-2 rounded-md text-sm"
                    >
                      <option value="">Semua Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setFilterBranch('')
                      setFilterStatus('')
                    }}
                    className="w-full bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 text-sm"
                  >
                    Reset Filter
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Desktop Filter Section */}
          {!isMobile && (
            <div className="bg-white p-4 rounded-lg shadow mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Cari batch ID, PIC, atau sub kategori..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border px-3 py-2 rounded-md text-sm"
                  />
                </div>
                <div>
                  <select
                    value={filterBranch}
                    onChange={(e) => setFilterBranch(e.target.value)}
                    className="w-full border px-3 py-2 rounded-md text-sm"
                  >
                    <option value="">Semua Cabang</option>
                    {branches.map(branch => (
                      <option key={branch.kode_branch} value={branch.kode_branch}>
                        {branch.nama_branch}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full border px-3 py-2 rounded-md text-sm"
                  >
                    <option value="">Semua Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setFilterBranch('')
                      setFilterStatus('')
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 text-sm"
                  >
                    Reset Filter
                  </button>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Menampilkan {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredBatches.length)} dari {filteredBatches.length} batch (Total: {batches.length})
              </div>
            </div>
          )}

          {showAddForm && (
            <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold mb-4">
                {editing ? 'Edit Batch' : 'Tambah Batch Baru'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tanggal *</label>
                  <input
                    type="date"
                    value={form.opname_date}
                    onChange={(e) => {
                      setForm({...form, opname_date: e.target.value})
                      // Refresh produk jika branch dan subcategory sudah dipilih
                      if (selectedBranch && selectedSubCategory) {
                        fetchBranchProducts(selectedBranch, selectedSubCategory, e.target.value, form.opname_time)
                      }
                    }}
                    className="w-full border px-3 py-2 rounded-md text-sm"
                  />
                  {errors.opname_date && <p className="text-red-500 text-xs mt-1">{errors.opname_date}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Waktu</label>
                  <input
                    type="time"
                    value={form.opname_time}
                    onChange={(e) => {
                      const newTime = e.target.value;
                      setForm({...form, opname_time: newTime});
                      
                      // Refresh data produk jika branch dan subcategory sudah dipilih
                      if (selectedBranch && selectedSubCategory) {
                        fetchBranchProducts(selectedBranch, selectedSubCategory, form.opname_date, newTime);
                      }
                    }}
                    className="w-full border px-3 py-2 rounded-md text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Cabang *</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => {
                      const newBranch = e.target.value
                      setSelectedBranch(newBranch)
                      setBranchProducts([])
                      
                      if (newBranch) {
                        const branchName = branches.find(b => b.kode_branch === newBranch)?.nama_branch
                        showToast(`✅ Cabang ${branchName} dipilih - produk akan difilter otomatis`, "success")
                        
                        if (selectedSubCategory) {
                          fetchBranchProducts(newBranch, selectedSubCategory, form.opname_date, form.opname_time)
                        }
                      }
                    }}
                    className="w-full border px-3 py-2 rounded-md text-sm"
                  >
                    <option value="">Pilih Cabang</option>
                    {branches.map(branch => (
                      <option key={branch.kode_branch} value={branch.kode_branch}>
                        {branch.nama_branch}
                      </option>
                    ))}
                  </select>
                  {errors.branch_code && <p className="text-red-500 text-xs mt-1">{errors.branch_code}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Sub Kategori *</label>
                  <select
                    value={selectedSubCategory}
                    onChange={(e) => {
                      setSelectedSubCategory(e.target.value)
                      setBranchProducts([])
                      if (selectedBranch && e.target.value) {
                        fetchBranchProducts(selectedBranch, e.target.value, form.opname_date, form.opname_time)
                      }
                    }}
                    className="w-full border px-3 py-2 rounded-md text-sm"
                  >
                    <option value="">Pilih Sub Kategori</option>
                    {subCategories.map(sub => (
                      <option key={sub.sub_category} value={sub.sub_category}>
                        {sub.sub_category}
                      </option>
                    ))}
                  </select>
                  {errors.sub_category && <p className="text-red-500 text-xs mt-1">{errors.sub_category}</p>}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Nama PIC *</label>
                <input
                  type="text"
                  value={form.pic_name || ''}
                  onChange={(e) => setForm({...form, pic_name: e.target.value})}
                  className="w-full border px-3 py-2 rounded-md text-sm"
                  placeholder="Nama penanggung jawab"
                />
                {errors.pic_name && <p className="text-red-500 text-xs mt-1">{errors.pic_name}</p>}
              </div>

              {loadingBranchData ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Memuat produk...
                </div>
              ) : branchProducts.length > 0 ? (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-sm md:text-base">Produk Stock Opname</h4>
                    <div className="text-sm text-gray-600">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                        📍 {branches.find(b => b.kode_branch === selectedBranch)?.nama_branch} - {branchProducts.length} produk {selectedSubCategory}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto border rounded-md">
                    {isMobile ? (
                      // Mobile view for products
                      <div className="divide-y">
                        {branchProducts.map((product, index) => {
                          const systemStock = editing && product.system_stock_snapshot !== undefined 
                            ? product.system_stock_snapshot 
                            : product.system_stock
                          const difference = product.physical_stock - systemStock
                          
                          return (
                            <div key={index} className="p-3">
                              <div className="font-medium text-sm mb-2">{product.product_name}</div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>Sistem (SO):</div>
                                <div className="font-medium">{systemStock}</div>
                                
                                <div>Sistem (Now):</div>
                                <div className="font-medium text-blue-600">{product.current_system_stock || product.system_stock}</div>
                                
                                <div>Fisik:</div>
                                <div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={product.physical_stock || ''}
                                    onChange={(e) => handlePhysicalStockChange(product.product_name, e.target.value)}
                                    className="w-full border px-2 py-1 rounded text-center text-sm"
                                  />
                                </div>
                                
                                <div>Selisih:</div>
                                <div className={`font-medium ${
                                  difference > 0 ? 'text-green-600' : 
                                  difference < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {difference.toFixed(2)}
                                </div>
                                
                                <div>Satuan:</div>
                                <div>{product.unit}</div>
                              </div>
                              <div className="mt-2">
                                <div className="text-xs text-gray-500 mb-1">Catatan:</div>
                                <input
                                  type="text"
                                  value={product.notes || ''}
                                  onChange={(e) => handleNotesChange(product.product_name, e.target.value)}
                                  className="w-full border px-2 py-1 rounded text-xs"
                                  placeholder="Catatan"
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      // Desktop view for products
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Produk</th>
                            <th className="px-3 py-2 text-left">Stok Sistem{editing ? ' (saat SO)' : ''}</th>
                            <th className="px-3 py-2 text-left">Stok Sistem (terkini)</th>
                            <th className="px-3 py-2 text-left">Stok Fisik</th>
                            <th className="px-3 py-2 text-left">Selisih</th>
                            <th className="px-3 py-2 text-left">Satuan</th>
                            <th className="px-3 py-2 text-left">Catatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branchProducts.map((product, index) => {
                            const systemStock = editing && product.system_stock_snapshot !== undefined 
                              ? product.system_stock_snapshot 
                              : product.system_stock
                            const difference = product.physical_stock - systemStock
                            
                            return (
                              <tr key={index} className="border-t">
                                <td className="px-3 py-2 font-medium">{product.product_name}</td>
                                <td className="px-3 py-2">{systemStock}</td>
                                <td className="px-3 py-2 text-blue-600">{product.current_system_stock || product.system_stock}</td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={product.physical_stock || ''}
                                    onChange={(e) => handlePhysicalStockChange(product.product_name, e.target.value)}
                                    className="w-20 border px-2 py-1 rounded text-center"
                                  />
                                </td>
                                <td className={`px-3 py-2 font-medium ${
                                  difference > 0 ? 'text-green-600' : 
                                  difference < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {difference.toFixed(2)}
                                </td>
                                <td className="px-3 py-2">{product.unit}</td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={product.notes || ''}
                                    onChange={(e) => handleNotesChange(product.product_name, e.target.value)}
                                    className="w-32 border px-2 py-1 rounded text-xs"
                                    placeholder="Catatan"
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {errors.physical_stock && <p className="text-red-500 text-xs mt-1">{errors.physical_stock}</p>}
                </div>
              ) : selectedBranch && selectedSubCategory ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <p>Tidak ada produk {selectedSubCategory} yang terdaftar untuk cabang {branches.find(b => b.kode_branch === selectedBranch)?.nama_branch}</p>
                  <p className="text-xs mt-1">Pastikan produk sudah dikonfigurasi di halaman Product Management untuk cabang ini</p>
                </div>
              ) : null}

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center text-sm"
                >
                  {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                  {editing ? 'Perbarui Batch' : 'Simpan Batch'}
                </button>
                <button
                  onClick={resetForm}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {isMobile ? (
              // Mobile view for batches
              <div className="divide-y">
                {paginatedBatches.length === 0 ? (
                  <div className="px-4 py-4 text-center text-gray-500">
                    {batches.length === 0 ? 'Tidak ada data batch' : 'Tidak ada batch yang sesuai dengan filter'}
                  </div>
                ) : (
                  paginatedBatches.map((batch) => (
                    <div key={batch.batch_id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <button
                          onClick={() => toggleBatchExpansion(batch.batch_id)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {expandedBatch === batch.batch_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          BATCH-{batch.batch_id}
                        </button>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          batch.status === 'approved' ? 'bg-green-100 text-green-800' :
                          batch.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {batch.status_icon} {batch.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div className="text-gray-600">Tanggal:</div>
                        <div>{batch.batch_date}</div>
                        
                        <div className="text-gray-600">Waktu:</div>
                        <div>{batch.batch_time?.substring(0, 5) || '12:00'}</div>
                        
                        <div className="text-gray-600">Cabang:</div>
                        <div>{batch.nama_branch}</div>
                        
                        <div className="text-gray-600">Sub Kategori:</div>
                        <div>{batch.sub_category}</div>
                        
                        <div className="text-gray-600">PIC:</div>
                        <div>{batch.pic_name}</div>
                        
                        <div className="text-gray-600">Produk:</div>
                        <div>{batch.products_counted}/{batch.total_products}</div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {batch.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleEditBatch(batch.batch_id)}
                              className="text-blue-600 hover:text-blue-800 p-1 text-xs flex items-center"
                              title="Edit"
                            >
                              <Edit2 size={14} className="mr-1" /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteBatch(batch.batch_id)}
                              disabled={processingBatch === batch.batch_id}
                              className="text-red-600 hover:text-red-800 p-1 text-xs flex items-center disabled:opacity-50"
                              title="Hapus"
                            >
                              {processingBatch === batch.batch_id ? 
                                <Loader2 size={14} className="animate-spin mr-1" /> : 
                                <Trash2 size={14} className="mr-1" />
                              } Hapus
                            </button>
                            <button
                              onClick={() => exportToPDF(batch.batch_id)}
                              disabled={processingBatch === batch.batch_id}
                              className="text-purple-600 hover:text-purple-800 p-1 text-xs flex items-center disabled:opacity-50"
                              title="Export PDF"
                            >
                              {processingBatch === batch.batch_id ? 
                                <Loader2 size={14} className="animate-spin mr-1" /> : 
                                <FileText size={14} className="mr-1" />
                              } PDF
                            </button>
                            <button
                              onClick={() => handleApproveBatch(batch.batch_id)}
                              disabled={processingBatch === batch.batch_id}
                              className="text-green-600 hover:text-green-800 p-1 text-xs px-2 py-1 border border-green-600 rounded disabled:opacity-50 flex items-center"
                              title="Setujui"
                            >
                              {processingBatch === batch.batch_id ? 
                                <Loader2 size={12} className="animate-spin mr-1" /> : 
                                'Setujui'
                              }
                            </button>
                          </>
                        )}
                        {batch.status === 'approved' && (
                          <>
                            <button
                              onClick={() => handleEditBatch(batch.batch_id)}
                              className="text-orange-600 hover:text-orange-800 p-1 text-xs flex items-center"
                              title="Edit (akan mengembalikan ke pending)"
                            >
                              <Edit2 size={14} className="mr-1" /> Edit
                            </button>
                            <button
                              onClick={() => exportToPDF(batch.batch_id)}
                              disabled={processingBatch === batch.batch_id}
                              className="text-purple-600 hover:text-purple-800 p-1 text-xs flex items-center disabled:opacity-50"
                              title="Export PDF"
                            >
                              {processingBatch === batch.batch_id ? 
                                <Loader2 size={14} className="animate-spin mr-1" /> : 
                                <FileText size={14} className="mr-1" />
                              } PDF
                            </button>
                            <button
                              onClick={() => handleRevertBatch(batch.batch_id)}
                              disabled={processingBatch === batch.batch_id}
                              className="text-red-600 hover:text-red-800 p-1 text-xs px-2 py-1 border border-red-600 rounded disabled:opacity-50 flex items-center"
                              title="Kembalikan ke Pending"
                            >
                              {processingBatch === batch.batch_id ? 
                                <Loader2 size={12} className="animate-spin mr-1" /> : 
                                'Kembalikan'
                              }
                            </button>
                          </>
                        )}
                      </div>
                      
                      {expandedBatch === batch.batch_id && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2 text-sm">Detail Produk:</h4>
                          <div className="space-y-3">
                            {batchDetails.map((detail) => {
                              const difference = detail.physical_stock - (detail.system_stock || 0)
                              return (
                                <div key={detail.detail_id} className="p-2 bg-gray-50 rounded text-sm">
                                  <div className="font-medium">{detail.product_name}</div>
                                  <div className="grid grid-cols-2 gap-1 mt-1">
                                    <div className="text-gray-600">Sistem:</div>
                                    <div>{detail.system_stock}</div>
                                    
                                    <div className="text-gray-600">Fisik:</div>
                                    <div>{detail.physical_stock}</div>
                                    
                                    <div className="text-gray-600">Selisih:</div>
                                    <div className={`font-medium ${
                                      difference > 0 ? 'text-green-600' : 
                                      difference < 0 ? 'text-red-600' : 'text-gray-600'
                                    }`}>
                                      {difference.toFixed(2)}
                                    </div>
                                    
                                    <div className="text-gray-600">Catatan:</div>
                                    <div>{detail.notes || '-'}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              // Desktop view for batches
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">ID Batch</th>
                      <th className="px-4 py-3 text-left">Tanggal</th>
                      <th className="px-4 py-3 text-left">Waktu</th>
                      <th className="px-4 py-3 text-left">Cabang</th>
                      <th className="px-4 py-3 text-left">Sub Kategori</th>
                      <th className="px-4 py-3 text-left">PIC</th>
                      <th className="px-4 py-3 text-left">Produk</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBatches.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-4 text-center text-gray-500">
                          {batches.length === 0 ? 'Tidak ada data batch' : 'Tidak ada batch yang sesuai dengan filter'}
                        </td>
                      </tr>
                    ) : (
                      paginatedBatches.map((batch) => (
                        <React.Fragment key={batch.batch_id}>
                          <tr className="border-t hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => toggleBatchExpansion(batch.batch_id)}
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                              >
                                {expandedBatch === batch.batch_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                BATCH-{batch.batch_id}
                              </button>
                            </td>
                            <td className="px-4 py-3">{batch.batch_date}</td>
                            <td className="px-4 py-3">{batch.batch_time?.substring(0, 5) || '12:00'}</td>        
                            <td className="px-4 py-3">{batch.nama_branch}</td>
                            <td className="px-4 py-3">{batch.sub_category}</td>
                            <td className="px-4 py-3">{batch.pic_name}</td>
                            <td className="px-4 py-3">{batch.products_counted}/{batch.total_products}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                batch.status === 'approved' ? 'bg-green-100 text-green-800' :
                                batch.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {batch.status_icon} {batch.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {batch.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleEditBatch(batch.batch_id)}
                                      className="text-blue-600 hover:text-blue-800 p-1"
                                      title="Edit"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteBatch(batch.batch_id)}
                                      disabled={processingBatch === batch.batch_id}
                                      className="text-red-600 hover:text-red-800 p-1 disabled:opacity-50"
                                      title="Hapus"
                                    >
                                      {processingBatch === batch.batch_id ? 
                                        <Loader2 size={14} className="animate-spin" /> : 
                                        <Trash2 size={14} />
                                      }
                                    </button>
                                    <button
                                      onClick={() => exportToPDF(batch.batch_id)}
                                      disabled={processingBatch === batch.batch_id}
                                      className="text-purple-600 hover:text-purple-800 p-1 disabled:opacity-50"
                                      title="Export PDF"
                                    >
                                      {processingBatch === batch.batch_id ? 
                                        <Loader2 size={14} className="animate-spin" /> : 
                                        <FileText size={14} />
                                      }
                                    </button>
                                    <button
                                      onClick={() => handleApproveBatch(batch.batch_id)}
                                      disabled={processingBatch === batch.batch_id}
                                      className="text-green-600 hover:text-green-800 p-1 text-xs px-2 py-1 border border-green-600 rounded disabled:opacity-50"
                                      title="Setujui"
                                    >
                                      {processingBatch === batch.batch_id ? 
                                        <Loader2 size={12} className="animate-spin inline mr-1" /> : 
                                        'Setujui'
                                      }
                                    </button>
                                  </>
                                )}
                                {batch.status === 'approved' && (
                                  <>
                                    <button
                                      onClick={() => handleEditBatch(batch.batch_id)}
                                      className="text-orange-600 hover:text-orange-800 p-1"
                                      title="Edit (akan mengembalikan ke pending)"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => exportToPDF(batch.batch_id)}
                                      disabled={processingBatch === batch.batch_id}
                                      className="text-purple-600 hover:text-purple-800 p-1 disabled:opacity-50"
                                      title="Export PDF"
                                    >
                                      {processingBatch === batch.batch_id ? 
                                        <Loader2 size={14} className="animate-spin" /> : 
                                        <FileText size={14} />
                                      }
                                    </button>
                                    <button
                                      onClick={() => handleRevertBatch(batch.batch_id)}
                                      disabled={processingBatch === batch.batch_id}
                                      className="text-red-600 hover:text-red-800 p-1 text-xs px-2 py-1 border border-red-600 rounded disabled:opacity-50"
                                      title="Kembalikan ke Pending"
                                    >
                                      {processingBatch === batch.batch_id ? 
                                        <Loader2 size={12} className="animate-spin inline mr-1" /> : 
                                        'Kembalikan'
                                      }
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expandedBatch === batch.batch_id && (
                            <tr>
                              <td colSpan={9} className="px-4 py-2 bg-gray-50">
                                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                                  <div><strong>Tanggal:</strong> {batch.batch_date}</div>
                                  <div><strong>Waktu:</strong> {batch.batch_time?.substring(0, 5) || '12:00'}</div>
                                  <div><strong>Cabang:</strong> {batch.nama_branch}</div>
                                  <div><strong>Sub Kategori:</strong> {batch.sub_category}</div>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-gray-100">
                                        <th className="px-2 py-1 text-left">Produk</th>
                                        <th className="px-2 py-1 text-left">Sistem</th>
                                        <th className="px-2 py-1 text-left">Fisik</th>
                                        <th className="px-2 py-1 text-left">Selisih</th>
                                        <th className="px-2 py-1 text-left">Catatan</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {batchDetails.map((detail) => {
                                        const difference = detail.physical_stock - (detail.system_stock || 0)
                                        return (
                                          <tr key={detail.detail_id} className="border-t">
                                            <td className="px-2 py-1">{detail.product_name}</td>
                                            <td className="px-2 py-1">{detail.system_stock}</td>
                                            <td className="px-2 py-1">{detail.physical_stock}</td>
                                            <td className={`px-2 py-1 font-medium ${
                                              difference > 0 ? 'text-green-600' : 
                                              difference < 0 ? 'text-red-600' : 'text-gray-600'
                                            }`}>
                                              {difference.toFixed(2)}
                                            </td>
                                            <td className="px-2 py-1">{detail.notes || '-'}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t flex-wrap gap-2">
                <div className="text-sm text-gray-700">
                  Halaman {currentPage} dari {totalPages}
                </div>
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                  >
                    ← Sebelumnya
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 border rounded text-sm ${
                          currentPage === pageNum 
                            ? 'bg-blue-600 text-white' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                  >
                    Selanjutnya →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </PageAccessControl>
  )
}