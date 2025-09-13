"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Search, Filter, Plus, Eye, Edit, Trash2, Calendar, Building2, User, Package } from 'lucide-react'
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'

interface PurchaseOrder {
  id: number
  po_number: string
  status: string
  priority?: string
  supplier_name: string
  branch_name: string
  created_at: string
  created_by_name: string
  tanggal_barang_sampai?: string
  total_harga: number
  items: Array<{product_name: string, qty: number}>
}

interface FilterOptions {
  branches: Array<{id_branch: number, nama_branch: string}>
  suppliers: Array<{id_supplier: number, nama_supplier: string}>
  statuses: string[]
  priorities: string[]
}

export default function PurchaseOrderPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    cabang_id: '',
    supplier_id: '',
    status: '',
    priority: ''
  })
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    branches: [],
    suppliers: [],
    statuses: ['Pending', 'Sedang diproses', 'Barang sampai', 'Sampai Sebagian', 'Dibatalkan'],
    priorities: ['biasa', 'sedang', 'tinggi']
  })

  useEffect(() => {
    fetchFilterOptions()
    fetchPurchaseOrders()
  }, [])

  useEffect(() => {
    fetchPurchaseOrders()
  }, [filters])

  const fetchFilterOptions = async () => {
    try {
      // Fetch branches
      const { data: branches } = await supabase
        .from('branches')
        .select('id_branch, nama_branch')
        .order('nama_branch')

      // Fetch suppliers with distinct names
      const { data: suppliersRaw } = await supabase
        .from('suppliers')
        .select('id_supplier, nama_supplier')
        .order('nama_supplier')
      
      // Remove duplicates based on nama_supplier (case insensitive)
      const uniqueSuppliers = suppliersRaw?.reduce((acc: any[], current) => {
        const existing = acc.find(item => item.nama_supplier.toLowerCase() === current.nama_supplier.toLowerCase())
        if (!existing) {
          acc.push(current)
        }
        return acc
      }, []) || []

      setFilterOptions({
        branches: branches || [],
        suppliers: uniqueSuppliers,
        statuses: ['Pending', 'Sedang diproses', 'Barang sampai', 'Sampai Sebagian', 'Dibatalkan'],
        priorities: ['biasa', 'sedang', 'tinggi']
      })
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  const fetchPurchaseOrders = async () => {
    setLoading(true)
    try {
      // Query purchase_orders with basic fields only
      let query = supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.cabang_id) {
        query = query.eq('cabang_id', filters.cabang_id)
      }
      if (filters.supplier_id) {
        query = query.eq('supplier_id', filters.supplier_id)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority)
      }

      const { data: poData, error } = await query

      if (error) throw error
      
      // Get supplier, branch names and items separately
      const transformedData = await Promise.all(
        (poData || []).map(async (po: any) => {
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
            .select('qty, product_id')
            .eq('po_id', po.id)

          // Get product names and calculate total price
          let totalHarga = 0
          const poItems = await Promise.all(
            (items || []).map(async (item) => {
              const { data: product } = await supabase
                .from('nama_product')
                .select('product_name, harga')
                .eq('id_product', item.product_id)
                .single()

              const itemTotal = (product?.harga || 0) * item.qty
              totalHarga += itemTotal

              return {
                product_name: product?.product_name || 'Unknown Product',
                qty: item.qty
              }
            })
          )

          return {
            id: po.id,
            po_number: po.po_number,
            status: po.status,
            priority: po.priority,
            supplier_name: supplier?.nama_supplier || 'Unknown',
            branch_name: branch?.nama_branch || 'Unknown',
            created_at: po.created_at,
            created_by_name: 'System',
            tanggal_barang_sampai: po.tanggal_barang_sampai,
            total_harga: totalHarga,
            items: poItems
          }
        })
      )
      
      setPurchaseOrders(transformedData)
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800'
      case 'Sedang diproses': return 'bg-blue-100 text-blue-800'
      case 'Barang sampai': return 'bg-purple-100 text-purple-800'
      case 'Sampai Sebagian': return 'bg-green-100 text-green-800'
      case 'Dibatalkan': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'tinggi': return 'bg-red-100 text-red-800'
      case 'sedang': return 'bg-yellow-100 text-yellow-800'
      case 'biasa': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
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
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const handleDeletePO = async (poId: number, poNumber: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus PO ${poNumber}? Semua data barang masuk dan gudang terkait juga akan dihapus.`)) {
      return
    }

    try {
      // First delete related gudang records
      const { error: gudangError } = await supabase
        .from('gudang')
        .delete()
        .eq('source_type', 'PO')
        .eq('source_reference', poNumber)

      if (gudangError) {
        console.error('Error deleting gudang records:', gudangError)
        throw gudangError
      }

      // Then delete related barang_masuk records
      const { error: barangMasukError } = await supabase
        .from('barang_masuk')
        .delete()
        .eq('no_po', poNumber)

      if (barangMasukError) {
        console.error('Error deleting barang masuk:', barangMasukError)
        throw barangMasukError
      }

      // Finally delete the PO
      const { error: poError } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', poId)

      if (poError) throw poError

      alert('PO dan semua data barang masuk & gudang terkait berhasil dihapus!')
      fetchPurchaseOrders()
    } catch (error) {
      console.error('Error deleting PO:', error)
      alert('Gagal menghapus PO')
    }
  }

  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="text-blue-600" size={28} />
                Purchase Orders
              </h1>
            </div>
            <a href="/purchaseorder/create" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Plus size={16} />
              Buat PO Baru
            </a>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={16} className="text-gray-500" />
              <h3 className="font-medium text-gray-800">Filter</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                <select
                  value={filters.cabang_id}
                  onChange={(e) => setFilters({...filters, cabang_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Semua Cabang</option>
                  {filterOptions.branches.map(branch => (
                    <option key={branch.id_branch} value={branch.id_branch}>{branch.nama_branch}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select
                  value={filters.supplier_id}
                  onChange={(e) => setFilters({...filters, supplier_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Semua Supplier</option>
                  {filterOptions.suppliers.map(supplier => (
                    <option key={supplier.id_supplier} value={supplier.id_supplier}>{supplier.nama_supplier}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters({...filters, priority: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Semua Priority</option>
                  {filterOptions.priorities.map(priority => (
                    <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Semua Status</option>
                  {filterOptions.statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({cabang_id: '', supplier_id: '', status: '', priority: ''})}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 text-sm"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </div>

          {/* Purchase Orders List */}
          <div className="bg-white rounded-lg shadow">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Memuat data...</p>
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada Purchase Order</h3>
                <p className="mt-1 text-sm text-gray-500">Mulai dengan membuat PO baru</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cabang</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Harga</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal PO</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tgl Barang Sampai</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{po.po_number}</div>
                          <div className="text-sm text-gray-500">#{po.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{po.supplier_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center text-sm text-gray-900">
                            <Building2 size={14} className="mr-1 text-gray-400" />
                            {po.branch_name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(po.priority || 'biasa')}`}>
                            {po.priority || 'Biasa'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(po.status)}`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">
                            {po.items.length > 0 ? (
                              <div className="space-y-1">
                                {po.items.slice(0, 2).map((item, index) => (
                                  <div key={index} className="flex justify-between">
                                    <span className="truncate max-w-[150px]">{item.product_name}</span>
                                    <span className="ml-2 font-medium">{item.qty}</span>
                                  </div>
                                ))}
                                {po.items.length > 2 && (
                                  <div className="text-xs text-gray-500">+{po.items.length - 2} items lainnya</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500">Tidak ada items</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-medium text-gray-900">
                            {formatCurrency(po.total_harga)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar size={14} className="mr-1 text-gray-400" />
                            {formatDate(po.created_at)}
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <User size={12} className="mr-1" />
                            {po.created_by_name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {po.tanggal_barang_sampai ? (
                            <div className="flex items-center text-sm text-gray-900">
                              <Calendar size={14} className="mr-1 text-green-400" />
                              {formatDate(po.tanggal_barang_sampai)}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <a 
                              href={`/purchaseorder/on_progress?id=${po.id}`}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded" 
                              title="Preview PO"
                            >
                              <Eye size={16} />
                            </a>
                            {po.status === 'Sedang diproses' && (
                              <a 
                                href={`/purchaseorder/barang_sampai?id=${po.id}`}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded" 
                                title="Barang Sampai"
                              >
                                <Package size={16} />
                              </a>
                            )}
                            {po.status !== 'Dibatalkan' ? (
                              <a 
                                href={`/purchaseorder/edit?id=${po.id}`}
                                className="text-orange-600 hover:text-orange-800 p-1 rounded" 
                                title="Edit PO"
                              >
                                <Edit size={16} />
                              </a>
                            ) : (
                              <span 
                                className="text-gray-400 p-1 rounded cursor-not-allowed" 
                                title="PO dibatalkan tidak dapat diedit"
                              >
                                <Edit size={16} />
                              </span>
                            )}
                            <button
                              onClick={() => handleDeletePO(po.id, po.po_number)}
                              className="text-red-600 hover:text-red-800 p-1 rounded"
                              title="Delete PO, Barang Masuk & Gudang"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </PageAccessControl>
    </Layout>
  )
}