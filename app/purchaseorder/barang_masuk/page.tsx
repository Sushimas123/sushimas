"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Package, Edit } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

interface BarangMasuk {
  id: number
  tanggal: string
  id_barang: number
  product_name: string
  jumlah: number
  unit_kecil: number
  unit_besar: number
  satuan_kecil: string
  satuan_besar: string
  total_real: number
  id_supplier: number
  supplier_name: string
  id_branch: number
  branch_name: string
  no_po: string
  invoice_number: string
  keterangan: string
  created_at: string
  po_id?: number
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

export default function BarangMasukPage() {
  const [barangMasuk, setBarangMasuk] = useState<BarangMasuk[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 50

  useEffect(() => {
    fetchBranches()
    fetchBarangMasuk()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
    fetchBarangMasuk()
  }, [selectedBranch])
  
  useEffect(() => {
    fetchBarangMasuk()
  }, [currentPage])

  const fetchBranches = async () => {
    try {
      const { data } = await supabase
        .from('branches')
        .select('*')
        .order('nama_branch')
      setBranches(data || [])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchBarangMasuk = async () => {
    try {
      // Get total count first
      let countQuery = supabase
        .from('barang_masuk')
        .select('*', { count: 'exact', head: true })
      
      if (selectedBranch) {
        countQuery = countQuery.eq('id_branch', parseInt(selectedBranch))
      }
      
      const { count } = await countQuery
      setTotalCount(count || 0)
      
      // Get paginated data
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      let query = supabase
        .from('barang_masuk')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)
      
      if (selectedBranch) {
        query = query.eq('id_branch', parseInt(selectedBranch))
      }
      
      const { data, error } = await query

      if (error) {
        console.error('Barang masuk query error:', error)
        throw error
      }

      if (!data || data.length === 0) {
        setBarangMasuk([])
        return
      }

      const barangMasukWithDetails = await Promise.all(
        data.map(async (item) => {
          let productName = 'Unknown'
          let supplierName = 'Unknown'
          let branchName = 'Unknown'

          let productData = null
          try {
            const { data: product } = await supabase
              .from('nama_product')
              .select('product_name, unit_kecil, unit_besar, satuan_kecil, satuan_besar')
              .eq('id_product', item.id_barang)
              .maybeSingle()
            
            if (product) {
              productName = product.product_name
              productData = product
            }
          } catch (err) {
            console.warn('Product fetch error:', err)
          }

          if (item.id_supplier) {
            try {
              const { data: supplier } = await supabase
                .from('suppliers')
                .select('nama_supplier')
                .eq('id_supplier', item.id_supplier)
                .maybeSingle()
              
              if (supplier) {
                supplierName = supplier.nama_supplier
              }
            } catch (err) {
              console.warn('Supplier fetch error:', err)
            }
          }

          try {
            const { data: branch } = await supabase
              .from('branches')
              .select('nama_branch')
              .eq('id_branch', item.id_branch)
              .maybeSingle()
            
            if (branch) {
              branchName = branch.nama_branch
            }
          } catch (err) {
            console.warn('Branch fetch error:', err)
          }

          // Get PO ID if available
          let poId = null
          if (item.no_po && item.no_po !== '-') {
            try {
              const { data: po } = await supabase
                .from('purchase_orders')
                .select('id')
                .eq('po_number', item.no_po)
                .maybeSingle()
              if (po) poId = po.id
            } catch (err) {
              console.warn('PO fetch error:', err)
            }
          }

          return {
            id: item.id,
            tanggal: item.tanggal,
            id_barang: item.id_barang,
            product_name: productName,
            jumlah: item.jumlah,
            unit_kecil: item.unit_kecil || 0,
            unit_besar: item.unit_besar || 0,
            satuan_kecil: productData?.unit_kecil || item.satuan_kecil || '',
            satuan_besar: productData?.unit_besar || item.satuan_besar || '',
            total_real: item.total_real || 0,
            id_supplier: item.id_supplier,
            supplier_name: supplierName,
            id_branch: item.id_branch,
            branch_name: branchName,
            no_po: item.no_po || '-',
            invoice_number: item.invoice_number || '-',
            keterangan: item.keterangan || '-',
            created_at: item.created_at,
            po_id: poId
          }
        })
      )

      setBarangMasuk(barangMasukWithDetails)
    } catch (error) {
      console.error('Error fetching barang masuk:', error)
      alert('Gagal memuat data Barang Masuk')
    } finally {
      setLoading(false)
    }
  }

  // Group barang masuk by PO
  const groupedByPO = barangMasuk.reduce((groups: Record<string, POGroup>, item) => {
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
    groups[key].total_qty += item.total_real || 0
    return groups
  }, {})

  const poGroups = Object.values(groupedByPO)
  const totalPages = Math.ceil(totalCount / itemsPerPage)
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <div className="p-6">
          <div className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Package className="text-green-600" size={28} />
                  Barang Masuk
                </h1>
                <p className="text-gray-600 mt-1">Daftar barang yang sudah masuk ke gudang berdasarkan PO</p>
              </div>
              <div className="flex gap-4">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2"
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
          </div>

          <div className="space-y-6">
            {poGroups.map((poGroup, index) => (
              <div key={index} className="bg-white rounded-lg shadow">
                <div className="bg-blue-50 px-6 py-4 border-b">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-800">
                          PO: {poGroup.po_id ? (
                            <a 
                              href={`/purchaseorder/barang_sampai?id=${poGroup.po_id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {poGroup.no_po}
                            </a>
                          ) : (
                            <span className="text-gray-600">{poGroup.no_po}</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {poGroup.supplier_name} • {poGroup.branch_name} • {new Date(poGroup.tanggal).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      {poGroup.invoice_number !== '-' && (
                        <div className="text-sm">
                          <span className="text-gray-500">Invoice:</span>
                          <span className="font-medium ml-1">{poGroup.invoice_number}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Qty Real</p>
                      <p className="font-semibold text-green-600">
                        {poGroup.total_qty.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="p-3 text-left font-medium text-gray-700">Nama Barang</th>
                        <th className="p-3 text-center font-medium text-gray-700">Jumlah PO</th>
                        <th className="p-3 text-center font-medium text-gray-700">Total Real</th>
                        <th className="p-3 text-center font-medium text-gray-700">Unit</th>
                        <th className="p-3 text-left font-medium text-gray-700">Keterangan</th>
                        <th className="p-3 text-center font-medium text-gray-700">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poGroup.items.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{item.product_name}</td>
                          <td className="p-3 text-center">{item.jumlah}</td>
                          <td className="p-3 text-center font-medium text-green-600">{item.total_real}</td>
                          <td className="p-3 text-center">{item.satuan_kecil}</td>
                          <td className="p-3 text-sm text-gray-600">{item.keterangan}</td>
                          <td className="p-3 text-center">
                            <a 
                              href={`/purchaseorder/barang_masuk/receive?edit=${item.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                            >
                              <Edit size={14} />
                              Edit
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            
            {poGroups.length === 0 && (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                Tidak ada data barang masuk
              </div>
            )}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white rounded-lg shadow p-4 mt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} dari {totalCount} data
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
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
                        className={`px-3 py-1 border rounded ${
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
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  )
}