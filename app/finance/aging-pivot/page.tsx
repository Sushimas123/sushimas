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
  due_dates: { [key: string]: number }
  total: number
}

export default function AgingPivotReport() {
  const [data, setData] = useState<AgingPivotData[]>([])
  const [dueDates, setDueDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBranches, setExpandedBranches] = useState<{[key: string]: boolean}>({})

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

        const outstanding = correctedTotal - item.total_paid
        if (outstanding <= 0) continue

        const key = `${item.nama_branch}-${item.nama_supplier}`
        const dueDateStr = new Date(item.tanggal_jatuh_tempo).toLocaleDateString('id-ID')
        
        dueDateSet.add(dueDateStr)

        if (!pivotMap.has(key)) {
          pivotMap.set(key, {
            branch: item.nama_branch,
            supplier: item.nama_supplier,
            due_dates: {},
            total: 0
          })
        }

        const pivotItem = pivotMap.get(key)!
        if (!pivotItem.due_dates[dueDateStr]) {
          pivotItem.due_dates[dueDateStr] = 0
        }
        pivotItem.due_dates[dueDateStr] += outstanding
        pivotItem.total += outstanding
      }

      // Sort due dates (only overdue dates)
      const sortedDueDates = Array.from(dueDateSet).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'))
        const dateB = new Date(b.split('/').reverse().join('-'))
        return dateA.getTime() - dateB.getTime()
      })
      
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
    if (!acc[item.branch]) acc[item.branch] = []
    acc[item.branch].push(item)
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
          <div className="mb-6 flex justify-between items-center">
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

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 relative">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 border-r border-gray-200" style={{minWidth: '120px'}}>Cabang</th>
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
                  {Object.entries(branchGroups).map(([branch, suppliers]) => (
                    <React.Fragment key={branch}>
                      {/* Branch Total Row - Always Visible */}
                      <tr className="bg-blue-50 font-medium cursor-pointer hover:bg-blue-100" onClick={() => toggleBranch(branch)}>
                        <td className="px-2 py-3 text-sm text-gray-900 flex items-center gap-1 sticky left-0 bg-blue-50 z-10 border-r border-gray-200" style={{minWidth: '120px'}}>
                          {expandedBranches[branch] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span className="truncate">{branch}</span>
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
                      {expandedBranches[branch] && suppliers.map((supplier) => (
                        <tr key={`${branch}-${supplier.supplier}`} className="hover:bg-gray-50 bg-gray-25">
                          <td className="px-2 py-3 text-sm text-gray-600 pl-4 sticky left-0 bg-white z-10 border-r border-gray-200" style={{minWidth: '120px'}}>
                            {/* Empty - indented */}
                          </td>
                          <td className="px-2 py-3 text-sm text-gray-900 sticky bg-white z-10 border-r border-gray-200" style={{left: '120px', minWidth: '140px'}}>
                            <span className="truncate">{supplier.supplier}</span>
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