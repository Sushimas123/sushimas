"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Download, ChevronDown, ChevronRight, Menu, X, Filter } from 'lucide-react'
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
  approval_status?: string
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
  const [sortField, setSortField] = useState<'date' | 'supplier' | 'branch' | 'notes' | 'approval' | 'total'>('total')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [supplierFilter, setSupplierFilter] = useState('')
  
  // Get unique suppliers from the data
  const availableSuppliers = React.useMemo(() => {
    const suppliers = [...new Set(data
      .filter(supplier => dueDates.some(date => supplier.due_dates[date] > 0))
      .map(item => item.supplier.toLowerCase()))]
    return suppliers.sort().map(s => s.charAt(0).toUpperCase() + s.slice(1))
  }, [data, dueDates])
  const [isMobile, setIsMobile] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'pivot' | 'summary'>('pivot')

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    fetchAgingPivotData()
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const fetchAgingPivotData = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('finance_dashboard_view')
        .select('*')
        .neq('status_payment', 'paid')
        .not('tanggal_barang_sampai', 'is', null)
        .order('nama_branch', { ascending: true })

      if (dateFilter.from) {
        query = query.gte('tanggal_jatuh_tempo', dateFilter.from)
      }
      if (dateFilter.to) {
        query = query.lte('tanggal_jatuh_tempo', dateFilter.to)
      }

      const { data: financeData, error } = await query

      if (error) throw error

      const supplierIds = [...new Set(financeData?.map(item => item.supplier_id).filter(Boolean))]
      const poIds = [...new Set(financeData?.map(item => item.id).filter(Boolean))]
      
      const [suppliersResult, approvalResult] = await Promise.all([
        supabase
          .from('suppliers')
          .select('id_supplier, nama_penerima, bank_penerima, nomor_rekening')
          .in('id_supplier', supplierIds),
        supabase
          .from('purchase_orders')
          .select('id, approval_status')
          .in('id', poIds)
      ])
      
      const { data: suppliersInfo } = suppliersResult
      const { data: approvalInfo } = approvalResult

      const suppliersMap = new Map()
      suppliersInfo?.forEach(supplier => {
        suppliersMap.set(supplier.id_supplier, supplier)
      })
      
      const approvalMap = new Map()
      approvalInfo?.forEach(po => {
        approvalMap.set(po.id, po.approval_status)
      })

      const pivotMap = new Map<string, AgingPivotData>()
      const dueDateSet = new Set<string>()

      for (const item of financeData || []) {
        const supplierInfo = suppliersMap.get(item.supplier_id)
        const approvalStatus = approvalMap.get(item.id)

        const outstanding = item.sisa_bayar
        
        if (item.status_payment === 'paid' || outstanding <= 0 || item.bulk_payment_ref) continue

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
            notes: finalNotes,
            approval_status: approvalStatus
          })
        }
        
        const pivotItem = pivotMap.get(key)!
        if (!pivotItem.due_dates[dueDateStr]) {
          pivotItem.due_dates[dueDateStr] = 0
        }
        pivotItem.due_dates[dueDateStr] += outstanding
        pivotItem.total += outstanding
      }

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

  const formatCurrencyShort = (amount: number) => {
    if (amount >= 1000000000) {
      return `Rp ${(amount / 1000000000).toFixed(1)}M`
    } else if (amount >= 1000000) {
      return `Rp ${(amount / 1000000).toFixed(1)}Jt`
    } else if (amount >= 1000) {
      return `Rp ${(amount / 1000).toFixed(1)}K`
    }
    return `Rp ${amount}`
  }

  const exportToExcel = () => {
    const exportData: any[] = []
    
    const branchGroups = data.reduce((acc, item) => {
      const groupKey = showNotes ? (item.notes || 'Unknown') : item.branch
      if (!acc[groupKey]) acc[groupKey] = []
      acc[groupKey].push(item)
      return acc
    }, {} as { [key: string]: AgingPivotData[] })

    Object.entries(branchGroups).forEach(([branch, suppliers]) => {
      suppliers.forEach(supplier => {
        const row: any = {
          'CABANG': supplier.branch,
          'SUPPLIER': supplier.supplier,
          'NOTES': supplier.notes || ''
        }
        
        dueDates.forEach(date => {
          row[date] = supplier.due_dates[date] || 0
        })
        
        row['TOTAL'] = supplier.total
        exportData.push(row)
      })
      
      const branchTotal: any = {
        'CABANG': `${branch} Total`,
        'SUPPLIER': '',
        'NOTES': ''
      }
      
      dueDates.forEach(date => {
        branchTotal[date] = suppliers.reduce((sum, s) => sum + (s.due_dates[date] || 0), 0)
      })
      
      branchTotal['TOTAL'] = suppliers.reduce((sum, s) => sum + s.total, 0)
      exportData.push(branchTotal)
    })

    const grandTotal: any = {
      'CABANG': 'Grand Total',
      'SUPPLIER': '',
      'NOTES': ''
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

  // Mobile Components
  const MobilePivotView = () => (
    <div className="space-y-4">
      {Object.entries(branchGroups).map(([groupKey, suppliers]) => (
        <div key={groupKey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Group Header */}
          <div 
            className="bg-blue-50 p-4 border-b border-blue-100 cursor-pointer"
            onClick={() => toggleBranch(groupKey)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {expandedBranches[groupKey] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{groupKey}</div>
                  <div className="text-xs text-gray-600">
                    {suppliers.length} supplier{suppliers.length > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-blue-700 text-sm">
                  {formatCurrencyShort(suppliers.reduce((sum, s) => sum + s.total, 0))}
                </div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
            </div>
            
            {/* Date Summary */}
            <div className="mt-2 flex flex-wrap gap-1">
              {dueDates.slice(0, 3).map(date => {
                const branchDateTotal = suppliers.reduce((sum, s) => sum + (s.due_dates[date] || 0), 0)
                if (branchDateTotal > 0) {
                  return (
                    <div key={date} className="bg-white px-2 py-1 rounded text-xs border">
                      <div className="text-gray-600">{date}</div>
                      <div className="font-semibold">{formatCurrencyShort(branchDateTotal)}</div>
                    </div>
                  )
                }
                return null
              })}
              {dueDates.length > 3 && (
                <div className="bg-gray-100 px-2 py-1 rounded text-xs">
                  +{dueDates.length - 3} more
                </div>
              )}
            </div>
          </div>
          
          {/* Supplier Details */}
          {expandedBranches[groupKey] && suppliers.map((supplier, index) => (
            <div key={index} className="p-4 border-b border-gray-100 last:border-b-0 bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-sm mb-1">{supplier.supplier}</div>
                  {!showNotes && (
                    <div className="text-xs text-gray-600 mb-1">{supplier.notes}</div>
                  )}
                  {showNotes && supplier.branch !== groupKey && (
                    <div className="text-xs text-gray-600 mb-1">{supplier.branch}</div>
                  )}
                  <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                    supplier.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                    supplier.approval_status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {supplier.approval_status || 'pending'}
                  </div>
                </div>
                <div className="text-right ml-2">
                  <div className="font-bold text-gray-900 text-sm">
                    {formatCurrencyShort(supplier.total)}
                  </div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
              </div>
              
              {/* Bank Info */}
              {supplier.supplier_bank_info && (
                <div className="bg-white p-2 rounded border text-xs mt-2">
                  <div className="font-semibold text-gray-700">{supplier.supplier_bank_info.nama_penerima}</div>
                  <div className="text-gray-600">{supplier.supplier_bank_info.bank_penerima}</div>
                  <div className="text-gray-600">{supplier.supplier_bank_info.nomor_rekening}</div>
                </div>
              )}
              
              {/* Due Dates */}
              <div className="mt-2 space-y-1">
                {dueDates.map(date => {
                  const amount = supplier.due_dates[date] || 0
                  if (amount > 0) {
                    return (
                      <div key={date} className="flex justify-between items-center text-xs">
                        <span className="text-gray-600">{date}</span>
                        <span className="font-semibold">{formatCurrencyShort(amount)}</span>
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
      
      {/* Grand Total */}
      <div className="bg-gray-200 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div className="font-bold text-gray-900">Grand Total</div>
          <div className="text-right">
            <div className="font-bold text-lg text-gray-900">{formatCurrencyShort(grandTotal)}</div>
            <div className="text-sm text-gray-700">{formatCurrency(grandTotal)}</div>
          </div>
        </div>
      </div>
    </div>
  )

  const MobileSummaryView = () => {
    const filteredSuppliers = data
      .filter(supplier => dueDates.some(date => supplier.due_dates[date] > 0))
      .sort((a, b) => {
        const aVal = sortField === 'date' ? dueDates.filter(date => a.due_dates[date] > 0)[0] || '' :
                    sortField === 'supplier' ? a.supplier : 
                    sortField === 'branch' ? a.branch : 
                    sortField === 'notes' ? (a.notes || '') :
                    sortField === 'approval' ? (a.approval_status || 'pending') :
                    dueDates.reduce((sum, date) => sum + (a.due_dates[date] || 0), 0)
        const bVal = sortField === 'date' ? dueDates.filter(date => b.due_dates[date] > 0)[0] || '' :
                    sortField === 'supplier' ? b.supplier : 
                    sortField === 'branch' ? b.branch : 
                    sortField === 'notes' ? (b.notes || '') :
                    sortField === 'approval' ? (b.approval_status || 'pending') :
                    dueDates.reduce((sum, date) => sum + (b.due_dates[date] || 0), 0)
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        }
        return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
      })

    return (
      <div className="space-y-4">
        {/* Sort Controls */}
        <div className="bg-white p-3 rounded-lg border">
          <label className="block text-sm font-medium text-gray-700 mb-2">Urutkan berdasarkan:</label>
          <select 
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="total">Total Outstanding</option>
            <option value="supplier">Nama Supplier</option>
            <option value="branch">Cabang</option>
            <option value="date">Tanggal Jatuh Tempo</option>
            <option value="notes">Notes</option>
            <option value="approval">Status Approval</option>
          </select>
          <div className="mt-2">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={sortDirection === 'desc'}
                onChange={(e) => setSortDirection(e.target.checked ? 'desc' : 'asc')}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Urutan menurun</span>
            </label>
          </div>
        </div>

        {/* Supplier List */}
        {filteredSuppliers.map((supplier, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="font-semibold text-gray-900 text-sm mb-1">{supplier.supplier}</div>
                <div className="text-xs text-gray-600 mb-1">{supplier.branch}</div>
                <div className="text-xs text-gray-600 mb-2">{supplier.notes || '-'}</div>
                <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                  supplier.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                  supplier.approval_status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {supplier.approval_status || 'pending'}
                </div>
              </div>
              <div className="text-right ml-2">
                <div className="font-bold text-gray-900">
                  {formatCurrencyShort(dueDates.reduce((sum, date) => sum + (supplier.due_dates[date] || 0), 0))}
                </div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
            </div>
            
            {/* Bank Info */}
            {supplier.supplier_bank_info && (
              <div className="bg-gray-50 p-2 rounded border text-xs mb-3">
                <div className="font-semibold text-gray-700">{supplier.supplier_bank_info.nama_penerima}</div>
                <div className="text-gray-600">{supplier.supplier_bank_info.bank_penerima}</div>
                <div className="text-gray-600">{supplier.supplier_bank_info.nomor_rekening}</div>
              </div>
            )}
            
            {/* Due Dates */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-700 mb-1">Tanggal Jatuh Tempo:</div>
              {dueDates.filter(date => supplier.due_dates[date] > 0).map(date => (
                <div key={date} className="flex justify-between items-center text-xs bg-blue-50 px-2 py-1 rounded">
                  <span className="text-gray-600">{date}</span>
                  <span className="font-semibold">{formatCurrencyShort(supplier.due_dates[date])}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {/* Summary Total */}
        <div className="bg-gray-200 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <div className="font-bold text-gray-900">Total Summary</div>
            <div className="text-right">
              <div className="font-bold text-lg text-gray-900">
                {formatCurrencyShort(filteredSuppliers.reduce((sum, supplier) => 
                  sum + dueDates.reduce((dateSum, date) => dateSum + (supplier.due_dates[date] || 0), 0), 0)
                )}
              </div>
              <div className="text-sm text-gray-700">
                {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const MobileFilters = () => (
    <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
      <div className="space-y-4">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Tampilkan berdasarkan:</span>
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

        {/* Date Filters */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={dateFilter.from}
              onChange={(e) => setDateFilter({...dateFilter, from: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={dateFilter.to}
              onChange={(e) => setDateFilter({...dateFilter, to: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              fetchAgingPivotData()
              setMobileFilterOpen(false)
            }}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Terapkan Filter
          </button>
          <button
            onClick={() => {
              setDateFilter({ from: '', to: '' })
              fetchAgingPivotData()
              setMobileFilterOpen(false)
            }}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  if (isMobile) {
    return (
      <Layout>
        <PageAccessControl pageName="aging-report">
          <div className="p-4 pb-20">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 rounded-lg bg-white border border-gray-200 shadow-sm"
                  >
                    {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Aging Report</h1>
                    <p className="text-gray-600 text-sm">Laporan aging berdasarkan tanggal jatuh tempo</p>
                  </div>
                </div>
                <button
                  onClick={exportToExcel}
                  className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700"
                >
                  <Download size={18} />
                </button>
              </div>

              {/* Mobile Menu */}
              {mobileMenuOpen && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 shadow-lg">
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setActiveTab('pivot')
                        setMobileMenuOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2 rounded-lg ${
                        activeTab === 'pivot' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      📊 Tampilan Pivot
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('summary')
                        setMobileMenuOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2 rounded-lg ${
                        activeTab === 'summary' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      📋 Rekapan Supplier
                    </button>
                    <button
                      onClick={() => {
                        setMobileFilterOpen(true)
                        setMobileMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 rounded-lg text-gray-700 flex items-center gap-2"
                    >
                      <Filter size={16} />
                      Filter Data
                    </button>
                  </div>
                </div>
              )}

              {/* Filter Panel */}
              {mobileFilterOpen && <MobileFilters />}

              {/* Tab Indicators */}
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  onClick={() => setActiveTab('pivot')}
                  className={`flex-1 py-2 text-center font-medium text-sm ${
                    activeTab === 'pivot'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500'
                  }`}
                >
                  Pivot
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`flex-1 py-2 text-center font-medium text-sm ${
                    activeTab === 'summary'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500'
                  }`}
                >
                  Summary
                </button>
              </div>

              {/* Quick Filter Button */}
              {!mobileFilterOpen && (
                <button
                  onClick={() => setMobileFilterOpen(true)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 mb-4 flex items-center justify-center gap-2 text-gray-700 font-medium"
                >
                  <Filter size={16} />
                  Filter Data
                  {(dateFilter.from || dateFilter.to) && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                      Active
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Content */}
            {activeTab === 'pivot' ? <MobilePivotView /> : <MobileSummaryView />}
          </div>
        </PageAccessControl>
      </Layout>
    )
  }

  // Desktop View (original code remains the same)
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
                    onClick={fetchAgingPivotData}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Filter
                  </button>
                  <button
                    onClick={() => {
                      setDateFilter({ from: '', to: '' })
                      fetchAgingPivotData()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>                </div>
              </div>


          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 relative">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 border-r border-gray-200" style={{minWidth: '120px'}}>
                      {showNotes ? 'Notes' : 'Cabang'}
                    </th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky bg-gray-50 z-10 border-r border-gray-200" style={{left: '120px', minWidth: '140px'}}>
                      Supplier
                    </th>
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
                        <tr key={`${groupKey}-${supplier.supplier}-${index}`} className="hover:bg-gray-50 bg-gray-50">
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
                    <td className="px-2 py-3 text-sm text-gray-900 sticky left-0 bg-gray-200 z-10 border-r border-gray-200" style={{minWidth: '120px'}}>
                      Grand Total
                    </td>
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

          {/* Summary Section - Suppliers with Outstanding in Filtered Date Range */}
          {(dateFilter.from || dateFilter.to) && (
            <div className="mt-6 bg-white rounded-lg shadow border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="text-lg font-medium text-gray-900">
                  Rekapan Supplier dengan Tagihan ({dateFilter.from && dateFilter.to ? `${dateFilter.from} s/d ${dateFilter.to}` : dateFilter.from || dateFilter.to})
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Daftar supplier yang memiliki outstanding di periode yang difilter
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  Tanggal jatuh tempo: {dueDates.join(', ')}
                </div>
                <div className="mt-3">
                  <select
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm w-64"
                  >
                    <option value="">Semua Supplier</option>
                    {availableSuppliers.map(supplier => (
                      <option key={supplier} value={supplier}>{supplier}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortField === 'date') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField('date')
                            setSortDirection('asc')
                          }
                        }}
                      >
                        Tanggal Jatuh Tempo {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortField === 'supplier') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField('supplier')
                            setSortDirection('asc')
                          }
                        }}
                      >
                        Supplier {sortField === 'supplier' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortField === 'branch') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField('branch')
                            setSortDirection('asc')
                          }
                        }}
                      >
                        Cabang {sortField === 'branch' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortField === 'notes') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField('notes')
                            setSortDirection('asc')
                          }
                        }}
                      >
                        Notes {sortField === 'notes' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortField === 'approval') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField('approval')
                            setSortDirection('asc')
                          }
                        }}
                      >
                        Approval Status {sortField === 'approval' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortField === 'total') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField('total')
                            setSortDirection('desc')
                          }
                        }}
                      >
                        Total Outstanding {sortField === 'total' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank Info</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data
                      .filter(supplier => dueDates.some(date => supplier.due_dates[date] > 0))
                      .filter(supplier => 
                        supplierFilter === '' || 
                        supplier.supplier.toLowerCase() === supplierFilter.toLowerCase()
                      )
                      .sort((a, b) => {
                        const aVal = sortField === 'date' ? dueDates.filter(date => a.due_dates[date] > 0)[0] || '' :
                                    sortField === 'supplier' ? a.supplier : 
                                    sortField === 'branch' ? a.branch : 
                                    sortField === 'notes' ? (a.notes || '') :
                                    sortField === 'approval' ? (a.approval_status || 'pending') :
                                    dueDates.reduce((sum, date) => sum + (a.due_dates[date] || 0), 0)
                        const bVal = sortField === 'date' ? dueDates.filter(date => b.due_dates[date] > 0)[0] || '' :
                                    sortField === 'supplier' ? b.supplier : 
                                    sortField === 'branch' ? b.branch : 
                                    sortField === 'notes' ? (b.notes || '') :
                                    sortField === 'approval' ? (b.approval_status || 'pending') :
                                    dueDates.reduce((sum, date) => sum + (b.due_dates[date] || 0), 0)
                        
                        if (typeof aVal === 'string' && typeof bVal === 'string') {
                          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
                        }
                        return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
                      })
                      .map((supplier, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {dueDates.filter(date => supplier.due_dates[date] > 0).join(', ')}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{supplier.supplier}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{supplier.branch}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{supplier.notes || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`font-medium ${
                              supplier.approval_status === 'approved' ? 'text-green-600' :
                              supplier.approval_status === 'rejected' ? 'text-red-600' :
                              'text-orange-600'
                            }`}>
                              {supplier.approval_status || 'pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(dueDates.reduce((sum, date) => sum + (supplier.due_dates[date] || 0), 0))}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {supplier.supplier_bank_info ? (
                              <div>
                                <div className="font-medium">{supplier.supplier_bank_info.nama_penerima}</div>
                                <div className="text-xs text-gray-500">
                                  {supplier.supplier_bank_info.bank_penerima} - {supplier.supplier_bank_info.nomor_rekening}
                                </div>
                              </div>
                            ) : '-'}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                        {formatCurrency(data
                          .filter(supplier => dueDates.some(date => supplier.due_dates[date] > 0))
                          .filter(supplier => 
                            supplierFilter === '' || 
                            supplier.supplier.toLowerCase() === supplierFilter.toLowerCase()
                          )
                          .reduce((sum, supplier) => sum + dueDates.reduce((dateSum, date) => dateSum + (supplier.due_dates[date] || 0), 0), 0)
                        )}
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  )
}