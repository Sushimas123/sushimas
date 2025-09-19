"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Download } from 'lucide-react'
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
        const dueDate = new Date(item.tanggal_jatuh_tempo).toLocaleDateString('id-ID')
        
        dueDateSet.add(dueDate)

        if (!pivotMap.has(key)) {
          pivotMap.set(key, {
            branch: item.nama_branch,
            supplier: item.nama_supplier,
            due_dates: {},
            total: 0
          })
        }

        const pivotItem = pivotMap.get(key)!
        if (!pivotItem.due_dates[dueDate]) {
          pivotItem.due_dates[dueDate] = 0
        }
        pivotItem.due_dates[dueDate] += outstanding
        pivotItem.total += outstanding
      }

      // Generate all dates from earliest to latest
      const sortedDueDates = Array.from(dueDateSet).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'))
        const dateB = new Date(b.split('/').reverse().join('-'))
        return dateA.getTime() - dateB.getTime()
      })

      if (sortedDueDates.length > 0) {
        const startDate = new Date(sortedDueDates[0].split('/').reverse().join('-'))
        const endDate = new Date(sortedDueDates[sortedDueDates.length - 1].split('/').reverse().join('-'))
        
        const allDates: string[] = []
        const currentDate = new Date(startDate)
        
        while (currentDate <= endDate) {
          allDates.push(currentDate.toLocaleDateString('id-ID'))
          currentDate.setDate(currentDate.getDate() + 1)
        }
        
        setDueDates(allDates)
      } else {
        setDueDates([])
      }
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cabang</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
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
                      {suppliers.map((supplier, index) => (
                        <tr key={`${branch}-${supplier.supplier}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {index === 0 ? branch : ''}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 pl-8">
                            {supplier.supplier}
                          </td>
                          {dueDates.map(date => (
                            <td key={date} className="px-4 py-3 text-sm text-gray-900 text-right">
                              {supplier.due_dates[date] ? formatCurrency(supplier.due_dates[date]) : '-'}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(supplier.total)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100 font-medium">
                        <td className="px-4 py-3 text-sm text-gray-900">{branch} Total</td>
                        <td className="px-4 py-3"></td>
                        {dueDates.map(date => {
                          const branchDateTotal = suppliers.reduce((sum, s) => sum + (s.due_dates[date] || 0), 0)
                          return (
                            <td key={date} className="px-4 py-3 text-sm text-gray-900 text-right">
                              {branchDateTotal > 0 ? formatCurrency(branchDateTotal) : '-'}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                          {formatCurrency(suppliers.reduce((sum, s) => sum + s.total, 0))}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                  <tr className="bg-blue-100 font-bold">
                    <td className="px-4 py-3 text-sm text-gray-900">Grand Total</td>
                    <td className="px-4 py-3"></td>
                    {dueDates.map(date => {
                      const grandDateTotal = data.reduce((sum, item) => sum + (item.due_dates[date] || 0), 0)
                      return (
                        <td key={date} className="px-4 py-3 text-sm text-gray-900 text-right">
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