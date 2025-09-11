"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from "@/src/lib/supabaseClient"
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import Layout from '../../components/Layout'
import PivotTable from '../../components/PivotTable'
import { canAccessPage } from '@/src/utils/dbPermissions'
import PageAccessControl from '../../components/PageAccessControl'
import { getBranchFilter, applyBranchFilter } from '@/src/utils/branchAccess'

interface User {
  id: number
  email: string
  name: string
  role: string
  cabang: string
}

interface AnalysisData {
  id_product: number
  ready_no: string
  tanggal: string
  product: string
  unit_kecil: string
  cabang: string
  ready: number
  gudang: number
  barang_masuk: number
  waste: number
  total_barang: number
  sub_category: string
  keluar_form: number
  hasil_esb: number
  selisih: number
  total_production: number
  sumif_total: number
  tolerance_percentage: number
  tolerance_range: string
  status: string
}

interface InvestigationNotes {
  id: number
  analysis_id: number
  notes: string
  created_by: string
  created_at: string
}

// Komponen NegativeDiscrepancyDashboard
const NegativeDiscrepancyDashboard: React.FC = () => {
  const [data, setData] = useState<AnalysisData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [notes, setNotes] = useState<{ [key: number]: string }>({})
  const [savedNotes, setSavedNotes] = useState<InvestigationNotes[]>([])
  const [filterCategory, setFilterCategory] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [dateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchNegativeData()
  }, [])

  const fetchNegativeData = async () => {
    setLoading(true)
    try {
      // Fetch data menggunakan logic yang sama dengan analysis page
      const bufferDate = new Date(dateRange.startDate)
      bufferDate.setDate(bufferDate.getDate() - 1)
      const bufferDateStr = bufferDate.toISOString().split('T')[0]

      const { data: readyData } = await supabase
        .from('ready')
        .select('*')
        .gte('tanggal_input', bufferDateStr)
        .lte('tanggal_input', dateRange.endDate)
        .limit(100)

      const { data: productData } = await supabase.from('nama_product').select('*')
      const { data: branchData } = await supabase.from('branches').select('*')
      const { data: toleranceData } = await supabase.from('product_tolerances').select('*')
      
      // Fetch data untuk calculation selisih
      const uniqueProductIds = [...new Set(readyData?.map(r => r.id_product) || [])]
      
      const { data: warehouseData } = await supabase
        .from('gudang')
        .select('*')
        .gte('tanggal', bufferDateStr)
        .in('id_product', uniqueProductIds)
      
      const { data: esbData } = await supabase
        .from('esb_harian')
        .select('sales_date, product_id, branch, qty_total')
        .gte('sales_date', bufferDateStr)
        .lte('sales_date', dateRange.endDate)
        .in('product_id', uniqueProductIds)
      
      const { data: productionData } = await supabase
        .from('produksi')
        .select('id_product, tanggal_input, total_konversi')
        .gte('tanggal_input', bufferDateStr)
        .lte('tanggal_input', dateRange.endDate)
        .in('id_product', uniqueProductIds)
      
      const { data: productionDetailData } = await supabase
        .from('produksi_detail')
        .select('item_id, tanggal_input, total_pakai, branch')
        .gte('tanggal_input', bufferDateStr)
        .lte('tanggal_input', dateRange.endDate)
        .in('item_id', uniqueProductIds)
      
      if (readyData && productData && branchData) {
        // Process menggunakan logic analysis yang sama
        const analysisData = processAnalysisData(
          readyData,
          productData,
          warehouseData || [],
          esbData || [],
          productionData || [],
          branchData,
          productionDetailData || [],
          toleranceData || []
        )
        
        // Filter untuk display (remove buffer data)
        const filteredData = analysisData.filter(item => {
          return item.tanggal >= dateRange.startDate && item.tanggal <= dateRange.endDate
        })
        
        setData(filteredData)
        
        const negativeItems = filteredData.filter(item => item.selisih < 0)
        if (negativeItems.length > 0) {
          loadInvestigationNotes(negativeItems.map(item => item.id_product))
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Copy function processAnalysisData dari analysis page
  const processAnalysisData = (readyStock: any[], products: any[], warehouse: any[], esb: any[], production: any[], branches: any[], productionDetail: any[], tolerances: any[]): AnalysisData[] => {
    const productMap = new Map(products.map(p => [p.id_product, p]))
    const branchMap = new Map(branches.map(b => [b.id_branch, b]))
    const toleranceMap = new Map(tolerances.map(t => [t.id_product, t]))
    
    const warehouseMap = new Map()
    warehouse.forEach(w => {
      const key = `${w.id_product}-${w.cabang}`
      if (!warehouseMap.has(key)) warehouseMap.set(key, [])
      warehouseMap.get(key).push(w)
    })
    
    const esbMap = new Map()
    esb.forEach(e => {
      const key = `${e.sales_date}-${e.product_id}-${e.branch?.trim()}`
      esbMap.set(key, e)
    })
    
    const productionMap = new Map()
    production.forEach(p => {
      const key = `${p.id_product}-${p.tanggal_input}`
      productionMap.set(key, p)
    })
    
    return readyStock.map((ready) => {
      const product = productMap.get(ready.id_product)
      const productName = product?.product_name || `Product ${ready.id_product}`
      const unitKecil = product?.unit_kecil || ''
      
      const branch = branchMap.get(ready.id_branch)
      const cabangName = branch?.nama_branch || `Branch ${ready.id_branch}`
      
      // Gudang calculation
      const warehouseKey = `${ready.id_product}-${branch?.kode_branch}`
      const warehouseItems = warehouseMap.get(warehouseKey) || []
      const filteredWarehouseItems = warehouseItems.filter((w: any) => {
        const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null
        return warehouseDate <= ready.tanggal_input
      })
      
      const warehouseItem = filteredWarehouseItems.length > 0 
        ? filteredWarehouseItems.reduce((latest: any, current: any) => {
            const latestTimestamp = latest.tanggal || '1900-01-01T00:00:00.000Z'
            const currentTimestamp = current.tanggal || '1900-01-01T00:00:00.000Z'
            return currentTimestamp > latestTimestamp ? current : latest
          })
        : null
      
      // Hasil ESB calculation
      const readyDate = String(ready.tanggal_input).slice(0, 10)
      const readyBranch = branch?.nama_branch?.trim() || ""
      const esbKey = `${readyDate}-${ready.id_product}-${readyBranch}`
      const esbItem = esbMap.get(esbKey)
      const hasilESB = esbItem ? Number(esbItem.qty_total) : 0
      
      const productionKey = `${ready.id_product}-${ready.tanggal_input}`
      const productionItem = productionMap.get(productionKey)
      
      const gudang = warehouseItem?.total_gudang || 0
      const barangMasuk = warehouseItems
        .filter((w: any) => {
          const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null
          return warehouseDate === ready.tanggal_input
        })
        .reduce((sum: number, w: any) => sum + (w.jumlah_masuk || 0), 0)
      
      const waste = ready.waste || 0
      const totalBarang = (ready.ready || 0) + gudang
      
      // Total Production calculation
      const branchCodeToNameMap = new Map()
      branches.forEach(branch => {
        branchCodeToNameMap.set(branch.kode_branch, branch.nama_branch)
      })
      
      const expectedBranchName = branchCodeToNameMap.get(branch?.kode_branch || '') || branch?.nama_branch
      
      const totalProduction = productionDetail
        .filter((pd: any) => {
          return pd.item_id === ready.id_product && 
                 pd.tanggal_input === ready.tanggal_input &&
                 pd.branch === expectedBranchName
        })
        .reduce((sum: number, pd: any) => sum + (pd.total_pakai || 0), 0)
      
      const sumifTotal = productionItem?.total_konversi || 0
      
      // Keluar Form calculation (simplified)
      const keluarForm = 0 // Simplified for dashboard
      
      // SELISIH = hasilESB - keluarForm + totalProduction
      const selisih = hasilESB - keluarForm + totalProduction
      
      const tolerance = toleranceMap.get(ready.id_product)
      const tolerancePercentage = tolerance?.tolerance_percentage || 5.0
      
      const toleranceValue = hasilESB * (tolerancePercentage / 100)
      const toleranceMin = -toleranceValue
      const toleranceMax = toleranceValue
      const toleranceRange = `${toleranceMin.toFixed(1)} ~ ${toleranceMax.toFixed(1)}`
      const status = Math.abs(selisih) <= toleranceValue ? 'OK' : (selisih < 0 ? 'Kurang' : 'Lebih')

      return {
        id_product: ready.id_product,
        ready_no: ready.ready_no || '',
        tanggal: ready.tanggal_input || '',
        product: productName,
        unit_kecil: unitKecil,
        cabang: cabangName,
        ready: ready.ready || 0,
        gudang,
        barang_masuk: barangMasuk,
        waste,
        total_barang: totalBarang,
        sub_category: ready.sub_category || '',
        keluar_form: keluarForm,
        hasil_esb: hasilESB,
        selisih,
        total_production: totalProduction,
        sumif_total: sumifTotal,
        tolerance_percentage: tolerancePercentage,
        tolerance_range: toleranceRange,
        status
      }
    })
  }

  const loadInvestigationNotes = async (analysisIds: number[]) => {
    if (analysisIds.length === 0) return
    
    const { data: notesData, error } = await supabase
      .from('investigation_notes')
      .select('*')
      .in('analysis_id', analysisIds)
      .order('created_at', { ascending: false })

    if (!error && notesData) {
      setSavedNotes(notesData)
    }
  }

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const saveNotes = async (id: number) => {
    if (!notes[id] || notes[id].trim() === '') return

    const userData = localStorage.getItem('user')
    const user = userData ? JSON.parse(userData) : { name: 'Unknown' }

    const { error } = await supabase
      .from('investigation_notes')
      .insert({
        analysis_id: id,
        notes: notes[id],
        created_by: user.name || 'Unknown'
      })

    if (!error) {
      loadInvestigationNotes([id])
      setNotes(prev => ({ ...prev, [id]: '' }))
    }
  }

  const getSeverityLevel = (selisih: number) => {
    const absoluteValue = Math.abs(selisih)
    if (absoluteValue > 100) return 'high'
    if (absoluteValue > 50) return 'medium'
    return 'low'
  }

  // Filter hanya data dengan selisih minus
  const negativeData = data.filter(item => item.selisih < 0)
  
  const filteredData = negativeData.filter(item => {
    const matchesCategory = !filterCategory || item.sub_category === filterCategory
    const matchesBranch = !filterBranch || item.cabang === filterBranch
    return matchesCategory && matchesBranch
  })

  const categories = [...new Set(negativeData.map(item => item.sub_category))]
  const branches = [...new Set(negativeData.map(item => item.cabang))]

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
          <span>Loading investigasi data...</span>
        </div>
      </div>
    )
  }

  if (negativeData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-green-700 flex items-center mb-4">
          <AlertTriangle className="mr-2" />
          Investigasi Selisih Minus
        </h2>
        <div className="text-center py-8 text-gray-500">
          🎉 Tidak ada selisih minus yang perlu investigasi
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-red-700 flex items-center">
            <AlertTriangle className="mr-2" />
            Investigasi Selisih Minus
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Total {filteredData.length} item dengan selisih negatif perlu investigasi
          </p>
        </div>
        
        <div className="text-sm text-gray-600">
          <span className="font-medium">Periode:</span> {dateRange.startDate} to {dateRange.endDate}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4 p-3 bg-gray-50 rounded">
        <div>
          <label className="block text-sm font-medium mb-1">Kategori</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 px-3 py-1 rounded text-sm"
          >
            <option value="">Semua Kategori</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cabang</label>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="border border-gray-300 px-3 py-1 rounded text-sm"
          >
            <option value="">Semua Cabang</option>
            {branches.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left"></th>
              <th className="p-2 text-left">Tanggal</th>
              <th className="p-2 text-left">Produk</th>
              <th className="p-2 text-left">Kategori</th>
              <th className="p-2 text-left">Cabang</th>
              <th className="p-2 text-right">Penjualan</th>
              <th className="p-2 text-right">Production</th>
              <th className="p-2 text-right">Selisih</th>
              <th className="p-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4 text-gray-500">
                  Tidak ada selisih minus dengan filter yang dipilih
                </td>
              </tr>
            ) : (
              filteredData.map(item => (
                <React.Fragment key={`${item.id_product}-${item.tanggal}`}>
                  <tr className={`border-b hover:bg-gray-50 ${
                    getSeverityLevel(item.selisih) === 'high' ? 'bg-red-50' : 
                    getSeverityLevel(item.selisih) === 'medium' ? 'bg-orange-50' : 'bg-yellow-50'
                  }`}>
                    <td className="p-2">
                      <button 
                        onClick={() => toggleExpand(item.id_product)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {expandedItems.has(item.id_product) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                    <td className="p-2">{item.tanggal}</td>
                    <td className="p-2 font-medium">{item.product}</td>
                    <td className="p-2">{item.sub_category}</td>
                    <td className="p-2">{item.cabang}</td>
                    <td className="p-2 text-right">{item.hasil_esb.toFixed(2)}</td>
                    <td className="p-2 text-right">{item.total_production.toFixed(2)}</td>
                    <td className="p-2 text-right text-red-600 font-bold">{item.selisih.toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                  
                  {/* Expanded row for notes */}
                  {expandedItems.has(item.id_product) && (
                    <tr className="bg-blue-50">
                      <td colSpan={8} className="p-4">
                        <div>
                          <h4 className="font-medium mb-2">Catatan Investigasi</h4>
                          <div className="mb-3 max-h-40 overflow-y-auto">
                            {savedNotes
                              .filter(note => note.analysis_id === item.id_product)
                              .map(note => (
                                <div key={note.id} className="bg-white p-2 rounded border mb-2">
                                  <div className="text-xs text-gray-500">
                                    {note.created_by} - {new Date(note.created_at).toLocaleString()}
                                  </div>
                                  <div className="text-sm">{note.notes}</div>
                                </div>
                              ))
                            }
                            
                            {savedNotes.filter(note => note.analysis_id === item.id_product).length === 0 && (
                              <div className="text-gray-500 text-sm">Belum ada catatan investigasi</div>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={notes[item.id_product] || ''}
                              onChange={(e) => setNotes(prev => ({ ...prev, [item.id_product]: e.target.value }))}
                              placeholder="Tambah catatan investigasi..."
                              className="flex-1 border border-gray-300 px-3 py-1 rounded text-sm"
                            />
                            <button
                              onClick={() => saveNotes(item.id_product)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                            >
                              Simpan
                            </button>
                          </div>
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

      {/* Summary Stats */}
      {filteredData.length > 0 && (
        <div className="mt-6 p-4 bg-gray-100 rounded grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{filteredData.length}</div>
            <div className="text-sm text-gray-600">Total Item Minus</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {filteredData.filter(item => getSeverityLevel(item.selisih) === 'high').length}
            </div>
            <div className="text-sm text-gray-600">Kritis (&gt; 100)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {filteredData.filter(item => getSeverityLevel(item.selisih) === 'medium').length}
            </div>
            <div className="text-sm text-gray-600">Sedang (50-100)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {filteredData.filter(item => getSeverityLevel(item.selisih) === 'low').length}
            </div>
            <div className="text-sm text-gray-600">Ringan (&lt; 50)</div>
          </div>
        </div>
      )}
    </div>
  )
}

function DashboardContent() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/login')
      return
    }
    
    try {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
    } catch (error) {
      console.error('Error parsing user data:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="p-6 space-y-6">
      {/* Negative Discrepancy Dashboard */}
      <NegativeDiscrepancyDashboard />
      
      {/* Pivot Table Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            📊 Analysis Pivot Table
          </h2>
          <p className="text-sm text-gray-600">
            Kolom: Tanggal | Baris: Subcategory → Product | Value: Selisih
          </p>
        </div>
        <PivotTable />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Layout>
      <PageAccessControl pageName="dashboard">
        <DashboardContent />
      </PageAccessControl>
    </Layout>
  )
}