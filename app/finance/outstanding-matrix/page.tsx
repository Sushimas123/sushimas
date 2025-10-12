"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { TrendingUp, Filter, Download, ChevronDown, ChevronRight } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

interface OutstandingData {
  id: number
  po_number: string
  nama_supplier: string
  kategori: string | null
  sub_kategori: string | null
  nama_product: string | null
  nama_branch: string
  sisa_bayar: number
  status_payment: string
}

export default function OutstandingMatrix() {
  const [data, setData] = useState<OutstandingData[]>([])
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<string[]>([])
  const [categories, setCategories] = useState<{kategori: string, subKategori: {name: string, products: string[]}[]}[]>([])
  const [dateFrom, setDateFrom] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    return `${year}-${month.toString().padStart(2, '0')}-01`
  })
  const [dateTo, setDateTo] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    const lastDay = new Date(year, month, 0).getDate()
    return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
  })
  const [selectedKategori, setSelectedKategori] = useState('')
  const [selectedSubKategori, setSelectedSubKategori] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [collapsedSubCategories, setCollapsedSubCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchOutstandingData()
  }, [])

  const fetchOutstandingData = async () => {
    setLoading(true)
    try {
      // Get finance data with date filter
      let query = supabase
        .from('finance_dashboard_view')
        .select('*')
        .order('po_date', { ascending: false })
      
      // Apply date filters if provided
      if (dateFrom) {
        query = query.gte('tanggal_barang_sampai', dateFrom)
      }
      if (dateTo) {
        query = query.lte('tanggal_barang_sampai', dateTo)
      }
      
      const { data: financeData, error } = await query

      if (error) throw error

      // Get PO items and payments for calculation
      const poIds = financeData.map(item => item.id)
      
      const [itemsData, paymentsData, poDetailsData] = await Promise.all([
        supabase.from('po_items').select('po_id, qty, harga, actual_price, received_qty, product_id').in('po_id', poIds),
        supabase.from('po_payments').select('po_id, payment_amount, status').in('po_id', poIds),
        supabase.from('purchase_orders').select('id, bulk_payment_ref, total_tagih').in('id', poIds)
      ])

      // Get unique product IDs and supplier IDs from the actual data
      const productIds = [...new Set(itemsData.data?.map(item => item.product_id).filter(Boolean) || [])]
      const supplierIds = [...new Set(financeData.map(item => item.supplier_id).filter(Boolean))]

      const [productsData, suppliersData] = await Promise.all([
        productIds.length > 0 ? supabase.from('nama_product').select('id_product, product_name, category, sub_category').in('id_product', productIds) : { data: [] },
        supplierIds.length > 0 ? supabase.from('suppliers').select('id_supplier, kategori, sub_kategori').in('id_supplier', supplierIds) : { data: [] }
      ])

      // Create lookup maps
      const itemsByPO: Record<number, any[]> = {}
      itemsData.data?.forEach(item => {
        if (!itemsByPO[item.po_id]) itemsByPO[item.po_id] = []
        itemsByPO[item.po_id].push(item)
      })

      const paymentsByPO: Record<number, any[]> = {}
      paymentsData.data?.forEach(payment => {
        if (payment.status === 'completed') {
          if (!paymentsByPO[payment.po_id]) paymentsByPO[payment.po_id] = []
          paymentsByPO[payment.po_id].push(payment)
        }
      })

      const poDetailsMap: Record<number, any> = {}
      poDetailsData.data?.forEach(po => { poDetailsMap[po.id] = po })

      const productsMap: Record<number, any> = {}
      productsData?.data?.forEach(product => { 
        productsMap[product.id_product] = product 
      })
      
      const suppliersMap: Record<number, any> = {}
      suppliersData?.data?.forEach(supplier => { 
        suppliersMap[supplier.id_supplier] = supplier 
      })

      // Process data
      const processedData = financeData.map((item: any) => {
        const items = itemsByPO[item.id] || []
        const payments = paymentsByPO[item.id] || []
        const poData = poDetailsMap[item.id]
        // Get categories from PO items
        const poItems = itemsByPO[item.id] || []
        const categories = new Set<string>()
        const subCategories = new Set<string>()
        
        poItems.forEach(poItem => {
          const productData = productsMap[poItem.product_id]
          if (productData?.category) categories.add(productData.category)
          if (productData?.sub_category) subCategories.add(productData.sub_category)
        })
        
        // Fallback to supplier category if no product category found
        let kategori = categories.size > 0 ? Array.from(categories)[0] : null
        let subKategori = subCategories.size > 0 ? Array.from(subCategories)[0] : null
        
        if (!kategori) {
          const supplierData = suppliersMap[item.supplier_id]
          kategori = supplierData?.kategori || 'Uncategorized'
          subKategori = supplierData?.sub_kategori || 'General'
        }

        // Calculate corrected total
        let correctedTotal = 0
        for (const poItem of items) {
          const actualPrice = poItem.actual_price || 0
          const originalPrice = poItem.harga || 0
          const receivedQty = poItem.received_qty || 0
          const originalQty = poItem.qty || 0
          
          if (actualPrice > 0 && receivedQty > 0) {
            correctedTotal += receivedQty * actualPrice
          } else if (originalPrice > 0 && originalQty > 0) {
            correctedTotal += originalQty * originalPrice
          }
        }

        if (correctedTotal === 0 && item.total_po) {
          correctedTotal = item.total_po
        }

        const totalPaid = payments.reduce((sum, p) => sum + p.payment_amount, 0)
        const totalTagih = poData?.total_tagih || 0
        const basisAmount = totalTagih > 0 ? totalTagih : correctedTotal
        
        let calculatedStatus = 'unpaid'
        let sisaBayar = basisAmount - totalPaid
        
        if (poData?.bulk_payment_ref) {
          calculatedStatus = 'paid'
          sisaBayar = 0
        } else {
          calculatedStatus = totalPaid === 0 ? 'unpaid' : totalPaid >= basisAmount ? 'paid' : 'partial'
        }

        // Get product names from PO items
        const productNames = new Set<string>()
        poItems.forEach(poItem => {
          const productData = productsMap[poItem.product_id]
          if (productData?.product_name) productNames.add(productData.product_name)
        })
        const namaProduct = productNames.size > 0 ? Array.from(productNames)[0] : 'Unknown Product'

        return {
          id: item.id,
          po_number: item.po_number,
          nama_supplier: item.nama_supplier,
          kategori: kategori,
          sub_kategori: subKategori,
          nama_product: namaProduct,
          nama_branch: item.nama_branch,
          sisa_bayar: sisaBayar,
          status_payment: calculatedStatus
        }
      }).filter(item => item.status_payment !== 'paid' && item.sisa_bayar > 0)

      setData(processedData)

      // Extract unique branches and categories
      const uniqueBranches = [...new Set(processedData.map(item => item.nama_branch))].sort()
      setBranches(uniqueBranches)

      const categoryMap: Record<string, Record<string, Set<string>>> = {}
      processedData.forEach(item => {
        const kategori = item.kategori || 'Uncategorized'
        const subKategori = item.sub_kategori || 'General'
        const namaProduct = item.nama_product || 'Unknown Product'
        
        if (!categoryMap[kategori]) {
          categoryMap[kategori] = {}
        }
        if (!categoryMap[kategori][subKategori]) {
          categoryMap[kategori][subKategori] = new Set()
        }
        categoryMap[kategori][subKategori].add(namaProduct)
      })

      const categoriesArray = Object.entries(categoryMap).map(([kategori, subKategoriMap]) => ({
        kategori,
        subKategori: Object.entries(subKategoriMap).map(([subKat, productSet]) => ({
          name: subKat,
          products: Array.from(productSet).sort()
        })).sort((a, b) => a.name.localeCompare(b.name))
      })).sort((a, b) => a.kategori.localeCompare(b.kategori))

      setCategories(categoriesArray)

    } catch (error) {
      console.error('Error fetching outstanding data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter data based on selected categories
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const kategori = item.kategori || 'Uncategorized'
      const subKategori = item.sub_kategori || 'General'
      
      if (selectedKategori && kategori !== selectedKategori) return false
      if (selectedSubKategori && subKategori !== selectedSubKategori) return false
      
      return true
    })
  }, [data, selectedKategori, selectedSubKategori])

  // Create matrix data
  const matrixData = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {}
    
    filteredData.forEach(item => {
      const kategori = item.kategori || 'Uncategorized'
      const subKategori = item.sub_kategori || 'General'
      const namaProduct = item.nama_product || 'Unknown Product'
      const rowKey = `${kategori}|${subKategori}|${namaProduct}`
      if (!matrix[rowKey]) {
        matrix[rowKey] = {}
        branches.forEach(branch => {
          matrix[rowKey][branch] = 0
        })
      }
      matrix[rowKey][item.nama_branch] += item.sisa_bayar
    })

    return matrix
  }, [filteredData, branches])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const exportToXLSX = async () => {
    try {
      const XLSX = await import('xlsx')
      
      const worksheetData = []
      
      // Header row
      const headerRow = ['Kategori', 'Sub Kategori', ...branches, 'Total']
      worksheetData.push(headerRow)
      
      // Data rows
      categories.forEach(category => {
        category.subKategori.forEach(subKat => {
          subKat.products.forEach(product => {
            const rowKey = `${category.kategori}|${subKat.name}|${product}`
            const rowData = matrixData[rowKey]
            if (rowData) {
              const total = branches.reduce((sum, branch) => sum + (rowData[branch] || 0), 0)
              const row = [
                category.kategori,
                `${subKat.name} - ${product}`,
                ...branches.map(branch => rowData[branch] || 0),
                total
              ]
              worksheetData.push(row)
            }
          })
        })
      })
      
      // Total row
      const totalRow = ['TOTAL', '', ...branches.map(branch => {
        return Object.values(matrixData).reduce((sum, row) => sum + (row[branch] || 0), 0)
      })]
      const grandTotal = Object.values(matrixData).reduce((sum, row) => {
        return sum + branches.reduce((branchSum, branch) => branchSum + (row[branch] || 0), 0)
      }, 0)
      totalRow.push(grandTotal)
      worksheetData.push(totalRow)
      
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Outstanding Matrix')
      
      XLSX.writeFile(workbook, `outstanding-matrix-${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (error) {
      console.error('Error exporting to XLSX:', error)
      alert('Gagal export file')
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

  return (
    <Layout>
      <PageAccessControl pageName="outstanding-matrix">
        <div className="p-6 bg-gray-50 min-h-screen">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Outstanding Matrix
            </h1>
            <p className="text-gray-600 mt-1">Outstanding amount by category and branch</p>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow border mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Filter Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Kategori</label>
                <select
                  value={selectedKategori}
                  onChange={(e) => {
                    setSelectedKategori(e.target.value)
                    setSelectedSubKategori('')
                  }}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                >
                  <option value="">Semua Kategori</option>
                  {categories.map(cat => (
                    <option key={cat.kategori} value={cat.kategori}>{cat.kategori}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Sub Kategori</label>
                <select
                  value={selectedSubKategori}
                  onChange={(e) => setSelectedSubKategori(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                  disabled={!selectedKategori}
                >
                  <option value="">Semua Sub Kategori</option>
                  {selectedKategori && categories
                    .find(cat => cat.kategori === selectedKategori)
                    ?.subKategori.map(subKat => (
                      <option key={subKat.name} value={subKat.name}>{subKat.name}</option>
                    ))
                  }
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchOutstandingData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Filter
                </button>
                <button
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                    setSelectedKategori('')
                    setSelectedSubKategori('')
                    fetchOutstandingData()
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white p-4 rounded-lg shadow border mb-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Outstanding</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(filteredData.reduce((sum, item) => sum + item.sisa_bayar, 0))}
                </p>
              </div>
              <button
                onClick={exportToXLSX}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <Download size={16} />
                Export Excel
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0 z-20">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-30">
                      Kategori
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-32 bg-gray-50 z-30">
                      Sub Kategori / Product
                    </th>
                    {branches.map(branch => (
                      <th key={branch} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-gray-50">
                        {branch}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-blue-50">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {categories.map(category => {
                    const isCategoryCollapsed = collapsedCategories.has(category.kategori)
                    const categoryTotal = category.subKategori.reduce((sum, subKat) => {
                      return sum + subKat.products.reduce((productSum, product) => {
                        const rowKey = `${category.kategori}|${subKat.name}|${product}`
                        const rowData = matrixData[rowKey] || {}
                        return productSum + branches.reduce((branchSum, branch) => branchSum + (rowData[branch] || 0), 0)
                      }, 0)
                    }, 0)
                    
                    if (categoryTotal === 0) return null
                    
                    return (
                      <React.Fragment key={category.kategori}>
                        {/* Category Header Row */}
                        <tr 
                          className="bg-gray-100 hover:bg-gray-200 cursor-pointer"
                          onClick={() => {
                            const newCollapsed = new Set(collapsedCategories)
                            if (isCategoryCollapsed) {
                              newCollapsed.delete(category.kategori)
                            } else {
                              newCollapsed.add(category.kategori)
                            }
                            setCollapsedCategories(newCollapsed)
                          }}
                        >
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 sticky left-0 bg-gray-100">
                            <div className="flex items-center gap-2">
                              {isCategoryCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              {category.kategori}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 sticky left-32 bg-gray-100">
                            {category.subKategori.length} sub kategori
                          </td>
                          {branches.map(branch => {
                            const branchTotal = category.subKategori.reduce((sum, subKat) => {
                              return sum + subKat.products.reduce((productSum, product) => {
                                const rowKey = `${category.kategori}|${subKat.name}|${product}`
                                const rowData = matrixData[rowKey] || {}
                                return productSum + (rowData[branch] || 0)
                              }, 0)
                            }, 0)
                            return (
                              <td key={branch} className="px-4 py-3 text-sm text-right font-medium text-gray-900 bg-gray-100">
                                {branchTotal > 0 ? formatCurrency(branchTotal) : '-'}
                              </td>
                            )
                          })}
                          <td className="px-4 py-3 text-sm font-bold text-right text-gray-900 bg-blue-100">
                            {formatCurrency(categoryTotal)}
                          </td>
                        </tr>
                        
                        {/* Sub Category and Product Rows */}
                        {!isCategoryCollapsed && category.subKategori.map((subKat) => {
                          const subCatKey = `${category.kategori}|${subKat.name}`
                          const isSubCatCollapsed = collapsedSubCategories.has(subCatKey)
                          const subCatTotal = subKat.products.reduce((sum, product) => {
                            const rowKey = `${category.kategori}|${subKat.name}|${product}`
                            const rowData = matrixData[rowKey] || {}
                            return sum + branches.reduce((branchSum, branch) => branchSum + (rowData[branch] || 0), 0)
                          }, 0)
                          
                          if (subCatTotal === 0) return null
                          
                          return (
                            <React.Fragment key={subCatKey}>
                              {/* Sub Category Header Row */}
                              <tr 
                                className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                                onClick={() => {
                                  const newCollapsed = new Set(collapsedSubCategories)
                                  if (isSubCatCollapsed) {
                                    newCollapsed.delete(subCatKey)
                                  } else {
                                    newCollapsed.add(subCatKey)
                                  }
                                  setCollapsedSubCategories(newCollapsed)
                                }}
                              >
                                <td className="px-4 py-3 text-sm text-gray-500 sticky left-0 bg-gray-50 pl-8">
                                  {/* Empty for sub-category indent */}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-32 bg-gray-50">
                                  <div className="flex items-center gap-2">
                                    {isSubCatCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                    {subKat.name} ({subKat.products.length} products)
                                  </div>
                                </td>
                                {branches.map(branch => {
                                  const branchTotal = subKat.products.reduce((sum, product) => {
                                    const rowKey = `${category.kategori}|${subKat.name}|${product}`
                                    const rowData = matrixData[rowKey] || {}
                                    return sum + (rowData[branch] || 0)
                                  }, 0)
                                  return (
                                    <td key={branch} className="px-4 py-3 text-sm text-right font-medium text-gray-900 bg-gray-50">
                                      {branchTotal > 0 ? formatCurrency(branchTotal) : '-'}
                                    </td>
                                  )
                                })}
                                <td className="px-4 py-3 text-sm font-medium text-right text-gray-900 bg-blue-50">
                                  {formatCurrency(subCatTotal)}
                                </td>
                              </tr>
                              
                              {/* Product Rows */}
                              {!isSubCatCollapsed && subKat.products.map((product) => {
                                const rowKey = `${category.kategori}|${subKat.name}|${product}`
                                const rowData = matrixData[rowKey] || {}
                                const rowTotal = branches.reduce((sum, branch) => sum + (rowData[branch] || 0), 0)
                                
                                if (rowTotal === 0) return null
                                
                                return (
                                  <tr key={rowKey} className="hover:bg-gray-25">
                                    <td className="px-4 py-3 text-sm text-gray-400 sticky left-0 bg-white pl-12">
                                      {/* Empty for product indent */}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700 sticky left-32 bg-white pl-8">
                                      {product}
                                    </td>
                                    {branches.map(branch => (
                                      <td key={branch} className="px-4 py-3 text-sm text-right text-gray-900">
                                        {rowData[branch] > 0 ? formatCurrency(rowData[branch]) : '-'}
                                      </td>
                                    ))}
                                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                                      {formatCurrency(rowTotal)}
                                    </td>
                                  </tr>
                                )
                              })}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                  
                  {/* Total Row */}
                  <tr className="bg-gray-200 font-bold border-t-2 border-gray-300">
                    <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-200">
                      GRAND TOTAL
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 sticky left-32 bg-gray-200">
                      -
                    </td>
                    {branches.map(branch => {
                      const branchTotal = Object.values(matrixData).reduce((sum, row) => sum + (row[branch] || 0), 0)
                      return (
                        <td key={branch} className="px-4 py-3 text-sm text-right font-bold text-gray-900 bg-gray-200">
                          {formatCurrency(branchTotal)}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-sm font-bold text-right text-gray-900 bg-blue-200">
                      {formatCurrency(filteredData.reduce((sum, item) => sum + item.sisa_bayar, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PageAccessControl>
    </Layout>
  )
}