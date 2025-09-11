'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/src/lib/supabaseClient";
import { Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import { getBranchFilter, applyBranchFilter } from '@/src/utils/branchAccess';
import PageAccessControl from '../../components/PageAccessControl';

interface AnalysisData {
  id_product: number;
  ready_no: string;
  tanggal: string;
  product: string;
  unit_kecil: string;
  cabang: string;
  ready: number;
  gudang: number;
  barang_masuk: number;
  waste: number;
  total_barang: number;
  sub_category: string;
  keluar_form: number;
  hasil_esb: number;
  selisih: number;
  total_production: number;
  sumif_total: number;
  tolerance_percentage: number;
  tolerance_range: string;
  status: string;
}

interface PivotData {
  [subcategory: string]: {
    [product: string]: {
      [date: string]: number; // selisih value
    }
  };
}

export default function PivotPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalysisData[]>([]);
  const [pivotData, setPivotData] = useState<PivotData>({});
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [branches, setBranches] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchAnalysisData();
  }, [dateRange, branchFilter]);

  const fetchBranches = async () => {
    try {
      const { data: branchData } = await supabase.from('branches').select('*');
      setBranches(branchData || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSubcategory = (subcategory: string) => {
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(subcategory)) {
      newExpanded.delete(subcategory);
    } else {
      newExpanded.add(subcategory);
    }
    setExpandedSubcategories(newExpanded);
  };

  const getAllDates = () => {
    const dates = new Set<string>();
    Object.values(pivotData).forEach(subcategoryData => {
      Object.values(subcategoryData).forEach(productData => {
        Object.keys(productData).forEach(date => {
          dates.add(date);
        });
      });
    });
    return Array.from(dates).sort();
  };

  const fetchAnalysisData = async () => {
    setLoading(true);
    try {
      if (!dateRange.startDate || !dateRange.endDate) {
        showToast('Please select valid date range', 'error');
        setLoading(false);
        return;
      }

      const bufferDate = new Date(dateRange.startDate);
      bufferDate.setDate(bufferDate.getDate() - 1);
      const bufferDateStr = bufferDate.toISOString().split('T')[0];

      let readyQuery = supabase
        .from('ready')
        .select('*')
        .gte('tanggal_input', bufferDateStr)
        .lte('tanggal_input', dateRange.endDate)
        .order('tanggal_input', { ascending: false })
        .limit(1000);

      if (branchFilter) {
        const selectedBranchData = branches.find(b => b.nama_branch === branchFilter);
        if (selectedBranchData) {
          readyQuery = readyQuery.eq('id_branch', selectedBranchData.id_branch);
        }
      }

      const { data: readyData, error: readyError } = await readyQuery;

      if (readyError || !readyData) {
        throw new Error(`Failed to fetch ready data: ${readyError?.message || 'No data returned'}`);
      }

      const { data: productData } = await supabase.from('nama_product').select('*');
      const { data: branchData } = await supabase.from('branches').select('*');
      const { data: toleranceData } = await supabase.from('product_tolerances').select('*');
      
      const uniqueProductIds = [...new Set(readyData?.map(r => r.id_product) || [])];
      
      const { data: warehouseData } = await supabase
        .from('gudang')
        .select('*')
        .gte('tanggal', bufferDateStr)
        .lte('tanggal', dateRange.endDate)
        .in('id_product', uniqueProductIds);
      
      const { data: esbData } = await supabase
        .from('esb_harian')
        .select('*')
        .gte('sales_date', dateRange.startDate)
        .lte('sales_date', dateRange.endDate)
        .in('product_id', uniqueProductIds);
      
      const { data: productionData } = await supabase
        .from('produksi')
        .select('*')
        .gte('tanggal_input', dateRange.startDate)
        .lte('tanggal_input', dateRange.endDate)
        .in('id_product', uniqueProductIds);
      
      const { data: productionDetailData } = await supabase
        .from('produksi_detail')
        .select('item_id, tanggal_input, total_pakai, branch')
        .gte('tanggal_input', dateRange.startDate)
        .lte('tanggal_input', dateRange.endDate)
        .in('item_id', uniqueProductIds);

      // Create maps
      const productMap = new Map(productData?.map(p => [p.id_product, p]) || []);
      const branchMap = new Map(branchData?.map(b => [b.id_branch, b]) || []);
      const toleranceMap = new Map(toleranceData?.map(t => [t.id_product, t]) || []);
      
      const warehouseMap = new Map();
      warehouseData?.forEach(w => {
        const key = `${w.id_product}-${w.cabang}`;
        if (!warehouseMap.has(key)) warehouseMap.set(key, []);
        warehouseMap.get(key).push(w);
      });
      
      const esbMap = new Map();
      esbData?.forEach(e => {
        const key = `${e.sales_date}-${e.product_id}-${e.branch?.trim()}`;
        esbMap.set(key, e);
      });
      
      const productionMap = new Map();
      productionData?.forEach(p => {
        const key = `${p.id_product}-${p.tanggal_input}`;
        productionMap.set(key, p);
      });

      // Helper functions
      const calculateKeluarForm = (ready: any, readyStock: any[], warehouse: any[], branchMap: Map<any, any>, sumifTotal: number): number => {
        const branch = branchMap.get(ready.id_branch);
        const warehouseKey = `${ready.id_product}-${branch?.kode_branch}`;
        const warehouseItems = warehouseMap.get(warehouseKey) || [];
        
        const filteredWarehouseItems = warehouseItems.filter((w: any) => {
          const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null;
          return warehouseDate && warehouseDate <= ready.tanggal_input;
        });
        
        const warehouseItem = filteredWarehouseItems.length > 0 
          ? filteredWarehouseItems.reduce((latest: any, current: any) => {
              const latestTimestamp = latest.tanggal || '1900-01-01T00:00:00.000Z';
              const currentTimestamp = current.tanggal || '1900-01-01T00:00:00.000Z';
              return currentTimestamp > latestTimestamp ? current : latest;
            })
          : null;
        
        const stokKemarin = warehouseItem?.stok || 0;
        const barangMasukHariIni = ready.barang_masuk || 0;
        const stokHariIni = ready.ready || 0;
        const waste = ready.waste || 0;
        const totalKonversi = sumifTotal;
        
        const keluarForm = (stokKemarin + barangMasukHariIni) - (stokHariIni + waste) + totalKonversi;
        return keluarForm;
      };

      const calculateSelisih = (hasilEsb: number, keluarForm: number, totalProduction: number): number => {
        return hasilEsb - keluarForm + totalProduction;
      };

      // Process data
      const analysisData: AnalysisData[] = [];
      const pivotDataTemp: PivotData = {};
      
      readyData.forEach((ready, index) => {
        const product = productMap.get(ready.id_product);
        const productName = product?.product_name || `Product ${ready.id_product}`;
        const branch = branchMap.get(ready.id_branch);
        
        const readyDate = String(ready.tanggal_input).slice(0, 10);
        const readyBranch = branch?.nama_branch?.trim() || "";
        const esbKey = `${readyDate}-${ready.id_product}-${readyBranch}`;
        const esbItem = esbMap.get(esbKey);
        const hasilESB = esbItem ? Number(esbItem.qty_total) : 0;
        
        const branchCodeToNameMap = new Map();
        branchData?.forEach(branch => {
          branchCodeToNameMap.set(branch.kode_branch, branch.nama_branch);
        });
        
        const expectedBranchName = branchCodeToNameMap.get(branch?.kode_branch || '') || branch?.nama_branch;
        
        const totalProduction = productionDetailData
          ?.filter((pd: any) => {
            return pd.item_id === ready.id_product && 
                   pd.tanggal_input === ready.tanggal_input &&
                   pd.branch === expectedBranchName;
          })
          .reduce((sum: number, pd: any) => sum + (pd.total_pakai || 0), 0) || 0;
        
        const productionKey = `${ready.id_product}-${ready.tanggal_input}`;
        const productionItem = productionMap.get(productionKey);
        const sumifTotal = productionItem?.total_konversi || 0;
        
        const keluarForm = calculateKeluarForm(ready, readyData, warehouseData || [], branchMap, sumifTotal);
        const selisih = calculateSelisih(hasilESB, keluarForm, totalProduction);
        
        const tolerance = toleranceMap.get(ready.id_product);
        const tolerancePercentage = tolerance?.tolerance_percentage || 5.0;
        const toleranceValue = hasilESB * (tolerancePercentage / 100);
        const toleranceMin = -toleranceValue;
        const toleranceMax = toleranceValue;
        const toleranceRange = `${toleranceMin.toFixed(1)} ~ ${toleranceMax.toFixed(1)}`;
        const status = Math.abs(selisih) <= toleranceValue ? 'OK' : (selisih < 0 ? 'Kurang' : 'Lebih');

        const analysisItem: AnalysisData = {
          id_product: ready.id_product,
          ready_no: ready.ready_no || `${index + 1}`,
          tanggal: ready.tanggal_input || '',
          product: productName,
          unit_kecil: product?.unit_kecil || '',
          cabang: branch?.nama_branch || `Branch ${ready.id_branch}`,
          ready: ready.ready || 0,
          gudang: 0,
          barang_masuk: ready.barang_masuk || 0,
          waste: ready.waste || 0,
          total_barang: (ready.ready || 0) + (ready.barang_masuk || 0),
          sub_category: product?.sub_category || 'Unknown',
          keluar_form: keluarForm,
          hasil_esb: hasilESB,
          selisih,
          total_production: totalProduction,
          sumif_total: sumifTotal,
          tolerance_percentage: tolerancePercentage,
          tolerance_range: toleranceRange,
          status
        };

        analysisData.push(analysisItem);

        // Build pivot data - only include data within actual date range
        if (ready.tanggal_input >= dateRange.startDate && ready.tanggal_input <= dateRange.endDate) {
          const subCategory = product?.sub_category || 'Unknown';
          
          if (!pivotDataTemp[subCategory]) {
            pivotDataTemp[subCategory] = {};
          }
          
          if (!pivotDataTemp[subCategory][productName]) {
            pivotDataTemp[subCategory][productName] = {};
          }
          
          pivotDataTemp[subCategory][productName][ready.tanggal_input] = selisih;
        }
      });

      setData(analysisData);
      setPivotData(pivotDataTemp);
    } catch (error: any) {
      console.error('Error fetching analysis data:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (Object.keys(pivotData).length === 0) {
      showToast('No data to export', 'error');
      return;
    }

    const dates = getAllDates();
    const exportData: any[] = [];

    Object.entries(pivotData).forEach(([subcategory, products]) => {
      // Add subcategory header
      const subcategoryRow: any = { 'Subcategory / Product': subcategory };
      dates.forEach(date => {
        const total = Object.values(products).reduce((sum, productDates) => {
          return sum + (productDates[date] || 0);
        }, 0);
        subcategoryRow[new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })] = total.toFixed(2);
      });
      exportData.push(subcategoryRow);

      // Add product rows
      Object.entries(products).forEach(([product, datesData]) => {
        const productRow: any = { 'Subcategory / Product': `  ${product}` };
        dates.forEach(date => {
          productRow[new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })] = (datesData[date] || 0).toFixed(2);
        });
        exportData.push(productRow);
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pivot Analysis');
    XLSX.writeFile(wb, `pivot_analysis_${dateRange.startDate}_${dateRange.endDate}.xlsx`);
    showToast('Data exported successfully', 'success');
  };

  const dates = getAllDates();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageAccessControl pageName="analysis">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Pivot Analysis</h1>
              <p className="text-gray-600">Analysis data in pivot table format</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchAnalysisData()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Download size={16} />
                Export
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">From:</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="px-3 py-2 border rounded text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">To:</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="px-3 py-2 border rounded text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Branch:</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="px-3 py-2 border rounded text-sm"
                >
                  <option value="">All Branches</option>
                  {branches.map(branch => (
                    <option key={branch.id_branch} value={branch.nama_branch}>
                      {branch.nama_branch}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pivot Table */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Pivot Table - Selisih Analysis</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2 text-left font-medium">Subcategory / Product</th>
                    {dates.map(date => (
                      <th key={date} className="border px-3 py-2 text-center font-medium">
                        {new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(pivotData).map(([subcategory, products]) => (
                    <React.Fragment key={subcategory}>
                      {/* Subcategory row */}
                      <tr 
                        className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSubcategory(subcategory)}
                      >
                        <td className="border px-3 py-2 font-medium">
                          <div className="flex items-center">
                            <span className="mr-2">
                              {expandedSubcategories.has(subcategory) ? '▼' : '►'}
                            </span>
                            {subcategory}
                          </div>
                        </td>
                        {dates.map(date => {
                          const total = Object.values(products).reduce((sum, productDates) => {
                            return sum + (productDates[date] || 0);
                          }, 0);
                          
                          return (
                            <td key={date} className={`border px-3 py-2 text-center font-medium ${
                              total < 0 ? 'text-red-600' : total > 0 ? 'text-blue-600' : 'text-gray-600'
                            }`}>
                              {total.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                      
                      {/* Product rows */}
                      {expandedSubcategories.has(subcategory) && 
                        Object.entries(products).map(([product, datesData]) => (
                          <tr key={product} className="bg-blue-50">
                            <td className="border px-3 py-2 pl-8">{product}</td>
                            {dates.map(date => (
                              <td key={date} className={`border px-3 py-2 text-center ${
                                (datesData[date] || 0) < 0 ? 'text-red-600' : 
                                (datesData[date] || 0) > 0 ? 'text-blue-600' : 'text-gray-600'
                              }`}>
                                {(datesData[date] || 0).toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))
                      }
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              
              {Object.keys(pivotData).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No data available for the selected filters
                </div>
              )}
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg z-50 ${
              toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
              {toast.message}
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  );
}