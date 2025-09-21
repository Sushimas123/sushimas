"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Download, ChevronDown, ChevronRight } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'
import * as XLSX from 'xlsx'


interface AgingPivotData {
  branch: string
  supplier: string
  supplier_bank_info?: {
    nama_penerima: string
    bank_penerima: string
    nomor_rekening: string
  }
  due_dates: { [key: string]: number }
  total: number
  notes?: string
}

export default function AgingPivotReport() {
  const [data, setData] = useState<AgingPivotData[]>([])
  const [dueDates, setDueDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBranches, setExpandedBranches] = useState<{[key: string]: boolean}>({})
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' })
  const [showNotes, setShowNotes] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aging-pivot-show-notes') === 'true'
    }
    return false
  })

  useEffect(() => {
    fetchAgingPivotData()
  }, [])

  const fetchAgingPivotData = async () => {
    try {
      const { data: financeData, error } = await supabase
        .from('finance_dashboard_view')
        .select('*')
        .neq('status_payment', 'paid')
        .order('nama_branch', { ascending: true })

      if (error) throw error

      const pivotMap = new Map<string, AgingPivotData>()
      const dueDateSet = new Set<string>()

      for (const item of financeData || []) {
        // Get supplier bank info
        const { data: supplierInfo } = await supabase
          .from('suppliers')
          .select('nama_penerima, bank_penerima, nomor_rekening')
          .eq('id_supplier', item.supplier_id)
          .single()

        const { data: items } = await supabase
          .from('po_items')
          .select('qty, actual_price, received_qty, product_id')
          .eq('po_id', item.id)

        let correctedTotal = 0
        for (const poItem of items || []) {
          if (poItem.actual_price && poItem.received_qty) {
            correctedTotal += poItem.received_qty * poItem.actual_price
          } else {
            const { data: product } = await supabase
              .from('nama_product')
              .select('harga')
              .eq('id_product', poItem.product_id)
              .single()
            correctedTotal += poItem.qty * (product?.harga || 0)
          }
        }

        // Skip if payment status is paid
        if (item.status_payment === 'paid') continue
        
        const outstanding = correctedTotal - item.total_paid
        if (outstanding <= 0) continue

        const defaultNotes = item.nama_branch === 'Sushimas Harapan Indah' ? 'Rek CV' : 'REK PT'
        const finalNotes = item.notes || defaultNotes
        const key = `${item.nama_branch}-${item.nama_supplier}-${finalNotes}`
        const dueDateStr = new Date(item.tanggal_jatuh_tempo).toLocaleDateString('id-ID')
        
        dueDateSet.add(dueDateStr)
        
        if (!pivotMap.has(key)) {
          pivotMap.set(key, {
            branch: item.nama_branch,
            supplier: item.nama_supplier,
            supplier_bank_info: supplierInfo || undefined,
            due_dates: {},
            total: 0,
            notes: finalNotes
          })
        }
        
        const pivotItem = pivotMap.get(key)!
        if (!pivotItem.due_dates[dueDateStr]) {
          pivotItem.due_dates[dueDateStr] = 0
        }
        pivotItem.due_dates[dueDateStr] += outstanding
        pivotItem.total += outstanding
      }

      // Sort and filter due dates
      let sortedDueDates = Array.from(dueDateSet).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'))
        const dateB = new Date(b.split('/').reverse().join('-'))
        return dateA.getTime() - dateB.getTime()
      })
      
      // Apply date filter if set
      if (dateFilter.from || dateFilter.to) {
        sortedDueDates = sortedDueDates.filter(dateStr => {
          const date = new Date(dateStr.split('/').reverse().join('-'))
          const fromDate = dateFilter.from ? new Date(dateFilter.from) : null
          const toDate = dateFilter.to ? new Date(dateFilter.to) : null
          
          if (fromDate && date < fromDate) return false
          if (toDate && date > toDate) return false
          return true
        })
      }
      
      setDueDates(sortedDueDates)
      setData(Array.from(pivotMap.values()))
    } catch (error) {
      console.error('Error fetching aging pivot data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const exportToExcel = () => {
    const exportData: any[] = []
    
    const branchGroups = data.reduce((acc, item) => {
      if (!acc[item.branch]) acc[item.branch] = []
      acc[item.branch].push(item)
      return acc
    }, {} as { [key: string]: AgingPivotData[] })

    Object.entries(branchGroups).forEach(([branch, suppliers]) => {
      suppliers.forEach(supplier => {
        const row: any = {
          'CABANG': branch,
          'SUPPLIER': supplier.supplier
        }
        
        dueDates.forEach(date => {
          row[date] = supplier.due_dates[date] || 0
        })
        
        row['TOTAL'] = supplier.total
        exportData.push(row)
      })
      
      const branchTotal: any = {
        'CABANG': `${branch} Total`,
        'SUPPLIER': ''
      }
      
      dueDates.forEach(date => {
        branchTotal[date] = suppliers.reduce((sum, s) => sum + (s.due_dates[date] || 0), 0)
      })
      
      branchTotal['TOTAL'] = suppliers.reduce((sum, s) => sum + s.total, 0)
      exportData.push(branchTotal)
    })

    const grandTotal: any = {
      'CABANG': 'Grand Total',
      'SUPPLIER': ''
    }
    
    dueDates.forEach(date => {
      grandTotal[date] = data.reduce((sum, item) => sum + (item.due_dates[date] || 0), 0)
    })
    
    grandTotal['TOTAL'] = data.reduce((sum, item) => sum + item.total, 0)
    exportData.push(grandTotal)

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Aging Pivot Report')
    XLSX.writeFile(wb, `aging-pivot-report-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const branchGroups = data.reduce((acc, item) => {
    const groupKey = showNotes ? (item.notes || 'Unknown') : item.branch
    if (!acc[groupKey]) acc[groupKey] = []
    acc[groupKey].push(item)
    return acc
  }, {} as { [key: string]: AgingPivotData[] })

  const grandTotal = data.reduce((sum, item) => sum + item.total, 0)

  const toggleBranch = (branch: string) => {
    setExpandedBranches(prev => ({
      ...prev,
      [branch]: !prev[branch]
    }))
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
      <PageAccessControl pageName="aging-report">
        <div className="p-6">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Aging Pivot Report</h1>
                <p className="text-gray-600">Laporan aging berdasarkan tanggal jatuh tempo</p>
              </div>
              <button
                onClick={exportToExcel}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download size={16} />
                Export Excel
              </button>
            </div>
            
            {/* Controls */}
            <div className="bg-white p-4 rounded-lg shadow border mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Tampilkan:</span>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showNotes}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setShowNotes(checked)
                        localStorage.setItem('aging-pivot-show-notes', checked.toString())
                      }}
                      className="sr-only"
                    />
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showNotes ? 'bg-blue-600' : 'bg-gray-200'
                    }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showNotes ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </div>
                    <span className="ml-2 text-sm text-gray-700">
                      {showNotes ? 'Notes' : 'Cabang'}
                    </span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dari Tanggal</label>
                  <input
                    type="date"
                    value={dateFilter.from}
                    onChange={(e) => setDateFilter({...dateFilter, from: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sampai Tanggal</label>
                  <input
                    type="date"
                    value={dateFilter.to}
                    onChange={(e) => setDateFilter({...dateFilter, to: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => {
                      setLoading(true)
                      fetchAgingPivotData()
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Filter
                  </button>
                  <button
                    onClick={() => {
                      setDateFilter({ from: '', to: '' })
                      setLoading(true)
                      fetchAgingPivotData()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 relative">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 border-r border-gray-200" style={{minWidth: '120px'}}>{showNotes ? 'Notes' : 'Cabang'}</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky bg-gray-50 z-10 border-r border-gray-200" style={{left: '120px', minWidth: '140px'}}>Supplier</th>
                    {dueDates.map(date => (
                      <th key={date} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {date}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(branchGroups).map(([groupKey, suppliers]) => (
                    <React.Fragment key={groupKey}>
                      {/* Group Total Row - Always Visible */}
                      <tr className="bg-blue-50 font-medium cursor-pointer hover:bg-blue-100" onClick={() => toggleBranch(groupKey)}>
                        <td className="px-2 py-3 text-sm text-gray-900 flex items-center gap-1 sticky left-0 bg-blue-50 z-10 border-r border-gray-200" style={{minWidth: '120px'}}>
                          {expandedBranches[groupKey] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span className="truncate">{groupKey}</span>
                        </td>
                        <td className="px-2 py-3 text-sm text-gray-500 sticky bg-blue-50 z-10 border-r border-gray-200" style={{left: '120px', minWidth: '140px'}}>
                          <span className="truncate">{suppliers.length} supplier{suppliers.length > 1 ? 's' : ''}</span>
                        </td>
                        {dueDates.map(date => {
                          const branchDateTotal = suppliers.reduce((sum: number, s) => sum + (s.due_dates[date] || 0), 0)
                          return (
                            <td key={date} className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                              {branchDateTotal > 0 ? formatCurrency(branchDateTotal) : '-'}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                          {formatCurrency(suppliers.reduce((sum: number, s) => sum + s.total, 0))}
                        </td>
                      </tr>
                      
                      {/* Supplier Detail Rows - Collapsible */}
                      {expandedBranches[groupKey] && suppliers.map((supplier, index) => (
                        <tr key={`${groupKey}-${supplier.supplier}-${supplier.branch}-${index}`} className="hover:bg-gray-50 bg-gray-25">
                          <td className="px-2 py-3 text-sm text-gray-600 pl-4 sticky left-0 bg-white z-10 border-r border-gray-200" style={{minWidth: '120px'}}>
                            <span className="text-xs text-gray-500">{showNotes ? supplier.branch : ''}</span>
                          </td>
                          <td className="px-2 py-3 text-sm text-gray-900 sticky bg-white z-10 border-r border-gray-200" style={{left: '120px', minWidth: '140px'}}>
                            <div>
                              <div className="font-medium truncate">{supplier.supplier}</div>
                              {supplier.supplier_bank_info && (
                                <div className="text-xs text-gray-500 mt-1">
                                  <div className="truncate">{supplier.supplier_bank_info.nama_penerima}</div>
                                  <div className="truncate">{supplier.supplier_bank_info.bank_penerima} - {supplier.supplier_bank_info.nomor_rekening}</div>
                                </div>
                              )}
                            </div>
                          </td>
                          {dueDates.map(date => (
                            <td key={date} className="px-4 py-3 text-sm text-gray-700 text-right">
                              {supplier.due_dates[date] ? formatCurrency(supplier.due_dates[date]) : '-'}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(supplier.total)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  
                  {/* Grand Total Row */}
                  <tr className="bg-gray-200 font-bold">
                    <td className="px-2 py-3 text-sm text-gray-900 sticky left-0 bg-gray-200 z-10 border-r border-gray-200" style={{minWidth: '120px'}}>Grand Total</td>
                    <td className="px-2 py-3 sticky bg-gray-200 z-10 border-r border-gray-200" style={{left: '120px', minWidth: '140px'}}></td>
                    {dueDates.map(date => {
                      const grandDateTotal = data.reduce((sum: number, item) => sum + (item.due_dates[date] || 0), 0)
                      return (
                        <td key={date} className="px-4 py-3 text-sm text-gray-900 text-right font-bold">
                          {grandDateTotal > 0 ? formatCurrency(grandDateTotal) : '-'}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      {formatCurrency(grandTotal)}
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