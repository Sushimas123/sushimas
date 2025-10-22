"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Package, Edit, ChevronDown, ChevronUp, Filter, RefreshCw } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import { getBranchFilter } from '@/src/utils/branchAccess'

interface BarangMasuk {
  id: number
  tanggal: string
  id_barang: number
  product_name: string
  jumlah: number
  qty_po: number
  unit_kecil: number
  unit_besar: number
  satuan_kecil: string
  satuan_besar: string
  total_real: number
  harga: number
  id_supplier: number
  supplier_name: string
  id_branch: number
  branch_name: string
  no_po: string
  invoice_number: string
  keterangan: string
  created_at: string
  updated_at?: string
  po_id?: number
  is_in_gudang?: boolean
  from_petty_cash?: boolean
  created_by_name?: string
  updated_by_name?: string
}

interface Branch {
  id_branch: number
  nama_branch: string
}

interface POGroup {
  no_po: string
  po_id?: number
  tanggal: string
  supplier_name: string
  branch_name: string
  invoice_number: string
  items: BarangMasuk[]
  total_qty: number
}

// Skeleton Loading Components
const SkeletonPOGroup = () => (
  <div className="bg-white rounded-lg shadow animate-pulse">
    <div className="p-4 border-b">
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
    <div className="p-4">
      {[1, 2].map(i => (
        <div key={i} className="border-b p-3 last:border-b-0">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-1"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
            <div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-1"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>
      ))}
    </div>
  </div>
)

export default function BarangMasukPage() {
  const [barangMasuk, setBarangMasuk] = useState<BarangMasuk[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedPOs, setExpandedPOs] = useState<Record<string, boolean>>({})
  const [showFilter, setShowFilter] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_gudang'>('all')
  const [processingItems, setProcessingItems] = useState<Set<number>>(new Set())
  const [fetchTimeout, setFetchTimeout] = useState<NodeJS.Timeout>()
  const itemsPerPage = 20

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  useEffect(() => {
    fetchBranches()
    fetchBarangMasuk()
  }, [])

  useEffect(() => {
    if (fetchTimeout) clearTimeout(fetchTimeout)
    
    const timeout = setTimeout(() => {
      setCurrentPage(1)
      fetchBarangMasuk()
    }, 500)
    
    setFetchTimeout(timeout)
    
    return () => clearTimeout(timeout)
  }, [selectedBranch, searchTerm, statusFilter])
  
  useEffect(() => {
    fetchBarangMasuk()
  }, [currentPage])

  const fetchBranches = async () => {
    try {
      // Get branch filter first
      const branchFilter = await getBranchFilter()
      
      let branchQuery = supabase
        .from('branches')
        .select('*')
        .order('nama_branch')
      
      // Apply branch filter for non-admin/manager users
      if (branchFilter && branchFilter.length > 0) {
        branchQuery = branchQuery.in('kode_branch', branchFilter)
      }
      
      const { data } = await branchQuery
      setBranches(data || [])
    } catch (error) {
      // Error fetching branches
    }
  }

  const fetchBarangMasuk = async () => {
    try {
      setLoading(true)
      
      // Get branch filter for access control
      const branchFilter = await getBranchFilter()
      let allowedBranchIds: number[] = []
      
      if (branchFilter && branchFilter.length > 0) {
        const { data: branchData } = await supabase
          .from('branches')
          .select('id_branch')
          .in('kode_branch', branchFilter)
        allowedBranchIds = branchData?.map(b => b.id_branch) || []
      }
      
      // Get IDs for search filters if searchTerm exists
      let searchProductIds: number[] = []
      let searchSupplierIds: number[] = []
      let searchBranchIds: number[] = []
      
      if (searchTerm) {
        const search = `%${searchTerm}%`
        
        // Search in products
        const { data: products } = await supabase
          .from('nama_product')
          .select('id_product')
          .ilike('product_name', search)
        searchProductIds = products?.map(p => p.id_product) || []
        
        // Search in suppliers
        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('id_supplier')
          .ilike('nama_supplier', search)
        searchSupplierIds = suppliers?.map(s => s.id_supplier) || []
        
        // Search in branches
        const { data: branches } = await supabase
          .from('branches')
          .select('id_branch')
          .ilike('nama_branch', search)
        searchBranchIds = branches?.map(b => b.id_branch) || []
      }
      
      // Build query with all filters (server-side)
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      let query = supabase
        .from('barang_masuk')
        .select(`
          *,
          created_by_user:users!barang_masuk_created_by_fkey(nama_lengkap),
          updated_by_user:users!barang_masuk_updated_by_fkey(nama_lengkap)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      
      // Apply status filter (server-side)
      if (statusFilter === 'pending') {
        query = query.eq('is_in_gudang', false)
      } else if (statusFilter === 'in_gudang') {
        query = query.eq('is_in_gudang', true)
      }
      
      // Apply branch access control
      if (allowedBranchIds.length > 0) {
        query = query.in('id_branch', allowedBranchIds)
      }
      
      if (selectedBranch) {
        query = query.eq('id_branch', parseInt(selectedBranch))
      }
      
      // Apply search filters
      if (searchTerm) {
        query = query.or(
          `no_po.ilike.%${searchTerm}%,` +
          `invoice_number.ilike.%${searchTerm}%` +
          (searchProductIds.length > 0 ? `,id_barang.in.(${searchProductIds.join(',')})` : '') +
          (searchSupplierIds.length > 0 ? `,id_supplier.in.(${searchSupplierIds.join(',')})` : '') +
          (searchBranchIds.length > 0 ? `,id_branch.in.(${searchBranchIds.join(',')})` : '')
        )
      }
      
      const { data, count, error } = await query

      if (error) {
        throw error
      }

      setTotalCount(count || 0)

      if (!data || data.length === 0) {
        setBarangMasuk([])
        setLoading(false)
        return
      }

      // Batch fetch all related data to avoid N+1 queries
      const productIds = [...new Set(data.map(item => item.id_barang))];
      const supplierIds = [...new Set(data.map(item => item.id_supplier).filter(id => id))];
      const branchIds = [...new Set(data.map(item => item.id_branch))];
      const poNumbers = [...new Set(data.map(item => item.no_po).filter(no => no && no !== '-'))];

      // Fetch all related data in parallel
      const [
        { data: products },
        { data: suppliers },
        { data: branches },
        { data: purchaseOrders },
      ] = await Promise.all([
        supabase
          .from('nama_product')
          .select('id_product, product_name, unit_kecil, unit_besar, satuan_kecil, satuan_besar')
          .in('id_product', productIds),
        supabase
          .from('suppliers')
          .select('id_supplier, nama_supplier')
          .in('id_supplier', supplierIds),
        supabase
          .from('branches')
          .select('id_branch, nama_branch, kode_branch')
          .in('id_branch', branchIds),
        supabase
          .from('purchase_orders')
          .select('id, po_number')
          .in('po_number', poNumbers),
      ]);

      // Create lookup maps
      const productMap = new Map(products?.map(p => [p.id_product, p]) || []);
      const supplierMap = new Map(suppliers?.map(s => [s.id_supplier, s]) || []);
      const branchMap = new Map(branches?.map(b => [b.id_branch, b]) || []);
      const poMap = new Map(purchaseOrders?.map(po => [po.po_number, po]) || []);

      // Check gudang entries in batch
      const gudangCheckPromises = data.map(async (item) => {
        const branch = branchMap.get(item.id_branch);
        if (!branch?.kode_branch || !item.no_po || item.no_po === '-') return false;
        
        const { data: gudangEntry } = await supabase
          .from('gudang')
          .select('order_no')
          .eq('id_product', item.id_barang)
          .eq('cabang', branch.kode_branch)
          .eq('source_type', 'PO')
          .eq('source_reference', item.no_po)
          .eq('tanggal', item.tanggal)
          .maybeSingle();
        
        return !!gudangEntry;
      });

      const gudangResults = await Promise.all(gudangCheckPromises);

      // Check which items are from petty cash
      const pettyCashCheckPromises = data.map(async (item) => {
        const { data: pettyCashExpense } = await supabase
          .from('petty_cash_expenses')
          .select('id')
          .eq('barang_masuk_id', item.id)
          .maybeSingle();
        
        return !!pettyCashExpense;
      });

      const pettyCashResults = await Promise.all(pettyCashCheckPromises);

      const barangMasukWithDetails = data.map((item, index) => {
        const product = productMap.get(item.id_barang);
        const supplier = item.id_supplier ? supplierMap.get(item.id_supplier) : null;
        const branch = branchMap.get(item.id_branch);
        const po = item.no_po && item.no_po !== '-' ? poMap.get(item.no_po) : null;
        const isInGudang = gudangResults[index];
        const fromPettyCash = pettyCashResults[index];

        return {
          id: item.id,
          tanggal: item.tanggal,
          id_barang: item.id_barang,
          product_name: product?.product_name || 'Unknown',
          jumlah: item.jumlah,
          qty_po: item.qty_po || 0,
          unit_kecil: item.unit_kecil || product?.unit_kecil || 0,
          unit_besar: item.unit_besar || product?.unit_besar || 0,
          satuan_kecil: item.satuan_kecil || product?.satuan_kecil || '',
          satuan_besar: item.satuan_besar || product?.satuan_besar || '',
          total_real: item.jumlah || 0,
          harga: item.harga || 0,
          id_supplier: item.id_supplier,
          supplier_name: supplier?.nama_supplier || 'Unknown',
          id_branch: item.id_branch,
          branch_name: branch?.nama_branch || 'Unknown',
          no_po: item.no_po || '-',
          invoice_number: item.invoice_number || '-',
          keterangan: item.keterangan || '-',
          created_at: item.created_at,
          updated_at: item.updated_at,
          po_id: po?.id,
          is_in_gudang: isInGudang,
          from_petty_cash: fromPettyCash,
          created_by_name: (item as any).created_by_user?.nama_lengkap || '-',
          updated_by_name: (item as any).updated_by_user?.nama_lengkap || '-'
        }
      });

      setBarangMasuk(barangMasukWithDetails);
      
      // Set default expanded state for mobile - expand first 3 POs by default
      const poGroups = groupByPO(barangMasukWithDetails);
      const defaultExpanded: Record<string, boolean> = {};
      
      Object.keys(poGroups).slice(0, 3).forEach(key => {
        defaultExpanded[key] = true;
      });
      
      setExpandedPOs(defaultExpanded);
    } catch (error) {
      alert('Gagal memuat data Barang Masuk')
    } finally {
      setLoading(false)
    }
  }

  // Group barang masuk by PO (data already filtered server-side)
  const groupByPO = (items: BarangMasuk[]): Record<string, POGroup> => {
    return items.reduce((groups: Record<string, POGroup>, item) => {
      const key = item.no_po || 'no-po'
      if (!groups[key]) {
        groups[key] = {
          no_po: item.no_po,
          po_id: item.po_id,
          tanggal: item.tanggal,
          supplier_name: item.supplier_name,
          branch_name: item.branch_name,
          invoice_number: item.invoice_number,
          items: [],
          total_qty: 0
        }
      }
      groups[key].items.push(item)
      groups[key].total_qty += item.jumlah || 0
      return groups
    }, {})
  }

  const poGroups = groupByPO(barangMasuk)
  const totalPages = Math.ceil(totalCount / itemsPerPage)
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const togglePO = (poKey: string) => {
    setExpandedPOs(prev => ({
      ...prev,
      [poKey]: !prev[poKey]
    }))
  }

  const expandAllPOs = () => {
    const allExpanded: Record<string, boolean> = {};
    Object.keys(poGroups).forEach(key => {
      allExpanded[key] = true;
    });
    setExpandedPOs(allExpanded);
  }

  const collapseAllPOs = () => {
    setExpandedPOs({});
  }

  const handleMasukGudang = async (item: BarangMasuk) => {
    // Prevent double click
    if (processingItems.has(item.id)) {
      return
    }
    
    if (!confirm(`Masukkan barang ${item.product_name} ke gudang?`)) {
      return
    }

    // Mark as processing
    setProcessingItems(prev => new Set(prev).add(item.id))

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      
      // 1. PRE-VALIDATION
      if (!user.id_user) {
        throw new Error('User ID tidak ditemukan')
      }
      
      if (!item.id_barang || !item.jumlah || item.jumlah <= 0) {
        throw new Error('Data barang tidak valid')
      }
      
      // Get branch code from branch ID
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('kode_branch')
        .eq('id_branch', item.id_branch)
        .single()
      
      if (branchError || !branchData) {
        throw new Error('Branch data tidak ditemukan')
      }
      
      const branchCode = branchData.kode_branch
      
      // Check for duplicate - prevent same barang_masuk record from being processed twice
      const { data: existingEntry } = await supabase
        .from('gudang')
        .select('order_no')
        .eq('id_product', item.id_barang)
        .eq('cabang', branchCode)
        .eq('source_type', 'PO')
        .eq('source_reference', item.no_po)
        .eq('jumlah_masuk', item.jumlah)
        .eq('tanggal', item.tanggal)
      
      if (existingEntry && existingEntry.length > 0) {
        throw new Error('Data ini sudah pernah dimasukkan ke gudang!')
      }

      // 2. ATOMIC TRANSACTION - PREPARE ALL DATA FIRST
      let gudangInsertId: number | null = null
      let shouldUpdatePOStatus = false
      let allPOItems: any[] = []
      
      try {
        // Step 1: Get current stock for calculation
        const { data: currentStock } = await supabase
          .from('gudang')
          .select('total_gudang')
          .eq('id_product', item.id_barang)
          .eq('cabang', branchCode)
          .order('tanggal', { ascending: false })
          .limit(1)
        
        const previousStock = currentStock?.[0]?.total_gudang || 0
        const newTotalStock = previousStock + item.jumlah
        
        // Step 2: Prepare gudang data
        const gudangData = {
          tanggal: item.tanggal,
          id_product: item.id_barang,
          jumlah_masuk: item.jumlah,
          jumlah_keluar: 0,
          total_gudang: newTotalStock,
          nama_pengambil_barang: user.nama_lengkap || 'System',
          cabang: branchCode,
          source_type: 'PO',
          source_reference: item.no_po,
          created_by: user.id_user
        }
        
        // Step 3: INSERT TO GUDANG (Critical Operation 1)
        const { data: insertedGudang, error: gudangError } = await supabase
          .from('gudang')
          .insert(gudangData)
          .select()
          .single()
        
        if (gudangError) {
          throw new Error(`Gagal insert ke gudang: ${gudangError.message}`)
        }
        
        gudangInsertId = insertedGudang.id
        console.log('✅ Gudang entry created:', gudangInsertId)
        
        // Step 4: Check if we need to update PO status
        if (item.po_id && item.no_po !== '-') {
          // Get all items for this PO
          const { data: poItems, error: poItemsError } = await supabase
            .from('barang_masuk')
            .select('id, id_barang, jumlah')
            .eq('no_po', item.no_po)
          
          if (poItemsError) {
            throw new Error(`Gagal mengecek PO items: ${poItemsError.message}`)
          }
          
          allPOItems = poItems || []
          
          if (allPOItems.length > 0) {
            // Check if ALL items from this PO are now in gudang
            const gudangCheckPromises = allPOItems.map(async (poItem) => {
              const { data: gudangEntry } = await supabase
                .from('gudang')
                .select('order_no')
                .eq('id_product', poItem.id_barang)
                .eq('cabang', branchCode)
                .eq('source_type', 'PO')
                .eq('source_reference', item.no_po)
                .maybeSingle()
              return !!gudangEntry
            })
            
            const allInGudangResults = await Promise.all(gudangCheckPromises)
            shouldUpdatePOStatus = allInGudangResults.every(inGudang => inGudang)
            
            console.log('PO Status Check:', {
              totalItems: allPOItems.length,
              inGudang: allInGudangResults.filter(Boolean).length,
              shouldUpdate: shouldUpdatePOStatus
            })
            
            // Step 5: UPDATE PO STATUS (Critical Operation 2 - FINAL STEP)
            if (shouldUpdatePOStatus) {
              const { error: poUpdateError } = await supabase
                .from('purchase_orders')
                .update({ 
                  status: 'Di Gudang'
                })
                .eq('id', item.po_id)
              
              if (poUpdateError) {
                throw new Error(`Gagal update status PO: ${poUpdateError.message}`)
              }
              
              console.log('✅ PO status updated to "Di Gudang"')
            }
          }
        }
        
        // Step 6: UPDATE BARANG_MASUK STATUS (Mark as processed)
        // Note: barang_masuk table may not have updated_at/updated_by columns
        // This step is optional for audit trail
        
        // ALL OPERATIONS SUCCESSFUL
        console.log('🎉 All atomic operations completed successfully')
        
        // Show success message
        let successMessage = `✅ Barang "${item.product_name}" berhasil dimasukkan ke gudang!`
        if (shouldUpdatePOStatus) {
          successMessage += `\n\nStatus PO ${item.no_po} telah diupdate menjadi "Di Gudang".`
        }
        alert(successMessage)
        
        // Refresh data
        fetchBarangMasuk()
        
      } catch (transactionError) {
        // 3. ROLLBACK MECHANISM
        console.error('❌ Transaction failed, attempting rollback:', transactionError)
        
        let rollbackMessages = []
        
        // Rollback gudang insert if it was successful
        if (gudangInsertId) {
          try {
            const { error: deleteError } = await supabase
              .from('gudang')
              .delete()
              .eq('id', gudangInsertId)
            
            if (!deleteError) {
              rollbackMessages.push('Gudang entry deleted')
              console.log('↩️ Rollback: Gudang entry deleted')
            } else {
              rollbackMessages.push('Gagal delete gudang entry')
              console.error('Rollback failed for gudang:', deleteError)
            }
          } catch (rollbackError) {
            rollbackMessages.push('Error saat rollback gudang')
            console.error('Rollback error for gudang:', rollbackError)
          }
        }
        
        // Note: We don't rollback PO status because it was the final step
        // If we failed before updating PO status, no need to rollback
        
        // Compose error message with rollback info
        const errorMessage = transactionError instanceof Error ? transactionError.message : 'Unknown error'
        const rollbackInfo = rollbackMessages.length > 0 
          ? `\n\nRollback actions: ${rollbackMessages.join(', ')}`
          : ''
        
        throw new Error(`Gagal memasukkan barang ke gudang: ${errorMessage}${rollbackInfo}`)
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('❌ handleMasukGudang error:', error)
      alert(`❌ ${errorMessage}`)
    } finally {
      // Remove from processing regardless of outcome
      setProcessingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(item.id)
        return newSet
      })
    }
  }

  return (
    <Layout>
      <PageAccessControl pageName="barang_masuk">
        <div className="p-4">
          <div className="mb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Package className="text-green-600" size={28} />
                <h1 className="text-xl font-bold text-gray-800">Barang Masuk</h1>
              </div>
              <p className="text-gray-600 text-sm">Daftar barang yang sudah masuk ke gudang berdasarkan PO</p>
              
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                >
                  <Filter size={16} />
                  Filter
                </button>
                
                {/* Status Filter Buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-2 text-sm rounded-lg border ${
                      statusFilter === 'all'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-2 text-sm rounded-lg border ${
                      statusFilter === 'pending'
                        ? 'bg-yellow-600 text-white border-yellow-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setStatusFilter('in_gudang')}
                    className={`px-3 py-2 text-sm rounded-lg border ${
                      statusFilter === 'in_gudang'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Di Gudang
                  </button>
                </div>
                
                <div className="flex gap-1 ml-auto">
                  {isMobile && (
                    <>
                      <button
                        onClick={() => {
                          const allExpanded: Record<string, boolean> = {};
                          Object.keys(poGroups).forEach(key => {
                            allExpanded[key] = true;
                          });
                          setExpandedPOs(allExpanded);
                        }}
                        className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                      >
                        Expand All
                      </button>
                      <button
                        onClick={() => setExpandedPOs({})}
                        className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                      >
                        Collapse All
                      </button>
                    </>
                  )}
                  <button
                    onClick={fetchBarangMasuk}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                </div>
              </div>
              
              {showFilter && (
                <div className="bg-white p-3 rounded-lg shadow border space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                    <input
                      type="text"
                      placeholder="Cari PO, produk, supplier, invoice..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Semua Cabang</option>
                      {branches.map(branch => (
                        <option key={branch.id_branch} value={branch.id_branch}>
                          {branch.nama_branch}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <SkeletonPOGroup key={i} />
              ))}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              {!isMobile ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0 z-20">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Tanggal</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">PO Number</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Supplier</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Branch</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Product</th>
                          <th className="px-2 py-2 text-center font-medium text-gray-700">Qty PO</th>
                          <th className="px-2 py-2 text-center font-medium text-gray-700">Qty Masuk</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Invoice</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Created By</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Updated By</th>
                          <th className="px-2 py-2 text-center font-medium text-gray-700">Status</th>
                          <th className="px-2 py-2 text-center font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {barangMasuk.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-2 py-2">
                              <div className="text-xs">{new Date(item.tanggal).toLocaleDateString('id-ID')}</div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="text-xs font-medium">
                                {item.po_id ? (
                                  <a 
                                    href={`/purchaseorder/received-preview?id=${item.po_id}`}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    {item.no_po}
                                  </a>
                                ) : item.no_po.startsWith('PETTY-CASH-') ? (
                                  <a 
                                    href={`/pettycash/expenses/${item.no_po.split('-')[2]}`}
                                    className="text-purple-600 hover:text-purple-800"
                                  >
                                    {item.no_po}
                                  </a>
                                ) : (
                                  <span className="text-gray-600">{item.no_po}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="text-xs truncate max-w-[100px]">{item.supplier_name}</div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="text-xs">{item.branch_name}</div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="text-xs font-medium truncate max-w-[120px]" title={item.product_name}>
                                {item.product_name}
                                {item.from_petty_cash && (
                                  <span className="text-purple-600 ml-1">💰</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="text-xs">
                                <span className="font-medium">{item.qty_po}</span>
                                <div className="text-xs text-gray-500">{item.satuan_besar}</div>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="text-xs">
                                <span className="font-medium text-green-600">{item.jumlah}</span>
                                <div className="text-xs text-gray-500">{item.satuan_kecil}</div>
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="text-xs truncate max-w-[80px]">
                                {item.invoice_number !== '-' ? item.invoice_number : '-'}
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="text-xs truncate max-w-[80px]">{item.created_by_name}</div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="text-xs truncate max-w-[80px]">{item.updated_by_name}</div>
                            </td>
                            <td className="px-2 py-2 text-center">
                              {item.is_in_gudang ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                  <Package size={10} />
                                  Di Gudang
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                  <Package size={10} />
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center">
                              {!item.is_in_gudang ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => {
                                      // Save current URL with filters to sessionStorage
                                      const currentUrl = new URL(window.location.href)
                                      sessionStorage.setItem('barang_masuk_return_url', currentUrl.pathname + currentUrl.search)
                                      window.location.href = `/purchaseorder/barang_masuk/receive?edit=${item.id}`
                                    }}
                                    className="text-green-600 hover:text-green-800 p-1 rounded"
                                    title="Update Data"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleMasukGudang(item)}
                                    disabled={!item.updated_at || processingItems.has(item.id)}
                                    className={`p-1 rounded ${
                                      processingItems.has(item.id)
                                        ? 'text-gray-400 cursor-wait'
                                        : item.updated_at 
                                        ? 'text-blue-600 hover:text-blue-800' 
                                        : 'text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={processingItems.has(item.id) ? "Processing..." : item.updated_at ? "Masuk Gudang" : "Harus update data terlebih dahulu"}
                                  >
                                    <Package size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Mobile Card View */
                <div className="space-y-4">
                  {Object.entries(poGroups).map(([poKey, poGroup], index) => {
                    const isExpanded = expandedPOs[poKey]
                    
                    return (
                      <div key={index} className="bg-white rounded-lg shadow">
                        <div 
                          className="p-4 border-b cursor-pointer"
                          onClick={() => togglePO(poKey)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-800 text-sm">
                                  PO: {poGroup.po_id ? (
                                    <a 
                                      href={`/purchaseorder/received-preview?id=${poGroup.po_id}`}
                                      className="text-blue-600 hover:text-blue-800"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {poGroup.no_po}
                                    </a>
                                  ) : poGroup.no_po.startsWith('PETTY-CASH-') ? (
                                    <a 
                                      href={`/pettycash/expenses/${poGroup.no_po.split('-')[2]}`}
                                      className="text-purple-600 hover:text-purple-800"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {poGroup.no_po}
                                    </a>
                                  ) : (
                                    <span className="text-gray-600">{poGroup.no_po}</span>
                                  )}
                                </h3>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                              <p className="text-xs text-gray-600 mb-1">
                                {poGroup.supplier_name}
                              </p>
                              <p className="text-xs text-gray-600">
                                {poGroup.branch_name} • {new Date(poGroup.tanggal).toLocaleDateString('id-ID')}
                              </p>
                              {poGroup.invoice_number !== '-' && (
                                <div className="text-xs mt-1">
                                  <span className="text-gray-500">Invoice:</span>
                                  <span className="font-medium ml-1">{poGroup.invoice_number}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="p-1">
                            {poGroup.items.map((item) => (
                              <div key={item.id} className="border-b p-2 last:border-b-0">
                                <div className="grid grid-cols-2 gap-2 text-xs mb-1">
                                  <div>
                                    <div className="text-xs text-gray-500">Tanggal</div>
                                    <div className="text-xs">{new Date(item.tanggal).toLocaleDateString('id-ID')}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">Barang</div>
                                    <div className="font-medium truncate text-xs">
                                      {item.product_name}
                                      {item.from_petty_cash && (
                                        <span className="text-purple-600 ml-1">💰</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 text-xs mb-1">
                                  <div>
                                    <div className="text-xs text-gray-500">Jumlah PO</div>
                                    <div className="text-xs">
                                      <span className="font-medium">{item.qty_po}</span>
                                      <span className="text-xs text-gray-500 ml-1">{item.satuan_besar}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">Barang Masuk</div>
                                    <div className="text-xs">
                                      <span className="font-medium text-green-600">{item.jumlah}</span>
                                      <span className="text-xs text-gray-500 ml-1">{item.satuan_kecil}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {item.keterangan !== '-' && (
                                  <div className="mb-1">
                                    <div className="text-xs text-gray-500">Keterangan</div>
                                    <div className="text-xs">{item.keterangan}</div>
                                  </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-2 text-xs mb-1">
                                  <div>
                                    <div className="text-xs text-gray-500">Created By</div>
                                    <div className="text-xs">{item.created_by_name}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">Updated By</div>
                                    <div className="text-xs">{item.updated_by_name}</div>
                                  </div>
                                </div>
                                
                                {!item.is_in_gudang ? (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    <button
                                      onClick={() => {
                                        // Save current URL with filters to sessionStorage
                                        const currentUrl = new URL(window.location.href)
                                        sessionStorage.setItem('barang_masuk_return_url', currentUrl.pathname + currentUrl.search)
                                        window.location.href = `/purchaseorder/barang_masuk/receive?edit=${item.id}`
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                      title="Update Data"
                                    >
                                      <Edit size={12} />
                                      Update
                                    </button>
                                    <button
                                      onClick={() => handleMasukGudang(item)}
                                      disabled={!item.updated_at || processingItems.has(item.id)}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                        processingItems.has(item.id)
                                          ? 'bg-gray-400 text-white cursor-wait'
                                          : item.updated_at 
                                          ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                      }`}
                                      title={processingItems.has(item.id) ? "Processing..." : item.updated_at ? "Masuk Gudang" : "Harus update data terlebih dahulu"}
                                    >
                                      <Package size={12} />
                                      {processingItems.has(item.id) ? 'Processing...' : 'Masuk Gudang'}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mt-2">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                      <Package size={12} />
                                      Sudah di Gudang
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
                
              {barangMasuk.length === 0 && (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <Package className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-500 mb-4">
                    {searchTerm || selectedBranch || statusFilter !== 'all' 
                      ? 'Tidak ada data yang sesuai dengan filter'
                      : 'Tidak ada data barang masuk'
                    }
                  </p>
                  {(searchTerm || selectedBranch || statusFilter !== 'all') && (
                    <button 
                      onClick={() => {
                        setSearchTerm('')
                        setSelectedBranch('')
                        setStatusFilter('all')
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              )}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white rounded-lg shadow p-4 mt-4">
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                    <div className="text-sm text-gray-700">
                      Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} dari {totalCount} data
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Prev
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
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-2 py-1 border rounded text-sm ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                      
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  )
}