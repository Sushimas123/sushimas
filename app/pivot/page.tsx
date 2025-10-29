'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/src/lib/supabaseClient";
import { Download, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import { getBranchFilter, applyBranchFilter } from '@/src/utils/branchAccess';
import PageAccessControl from '../../components/PageAccessControl';
import { safeLog } from '@/src/utils/logSanitizer';

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
      [date: string]: {
        selisih: number;
        pemakaian: number;
      }
    }
  };
}

const dataCache = new Map();

export default function PivotPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalysisData[]>([]);
  const [pivotData, setPivotData] = useState<PivotData>({});
  const [loading, setLoading] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [tempBranchFilter, setTempBranchFilter] = useState('');
  const [tempDateRange, setTempDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [branches, setBranches] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [displayMode, setDisplayMode] = useState<'selisih' | 'pemakaian'>('selisih');
  const [userRole, setUserRole] = useState('');
  const [allowedBranches, setAllowedBranches] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeUserData();
    };
    init();
    
    const saved = localStorage.getItem('pivot-date-range');
    if (saved) {
      try {
        const savedRange = JSON.parse(saved);
        setDateRange(savedRange);
        setTempDateRange(savedRange);
      } catch (e) {
        // Error loading saved date range
      }
    }
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchBranches();
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole && (allowedBranches.length > 0 || userRole === 'super admin' || userRole === 'admin')) {
      fetchBranches();
    }
  }, [allowedBranches]);

  useEffect(() => {
    localStorage.setItem('pivot-date-range', JSON.stringify(dateRange));
  }, [dateRange]);

  const applyFilters = () => {
    setDateRange(tempDateRange);
    setBranchFilter(tempBranchFilter);
    setHasAppliedFilter(true);
    setTimeout(() => fetchAnalysisData(), 100);
  };

  const resetFilters = () => {
    const defaultDateRange = {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    };
    setTempDateRange(defaultDateRange);
    setTempBranchFilter('');
    setDateRange(defaultDateRange);
    setBranchFilter('');
    setData([]);
    setPivotData({});
    setHasAppliedFilter(false);
  };

  const initializeUserData = async () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role);
      
      if (user.role === 'super admin' || user.role === 'admin') {
        setAllowedBranches([]);
      } else {
        if (user.id_user) {
          const { data: userBranches, error } = await supabase
            .from('user_branches')
            .select(`
              kode_branch, 
              branches!inner(nama_branch)
            `)
            .eq('id_user', user.id_user)
            .eq('is_active', true);
          
          if (userBranches && userBranches.length > 0) {
            const branchNames = userBranches.map(ub => (ub.branches as any).nama_branch);
            setAllowedBranches(branchNames);
          } else {
            const fallbackBranch = user.cabang || '';
            setAllowedBranches([fallbackBranch].filter(Boolean));
          }
        }
      }
    }
  };

  const fetchBranches = async () => {
    try {
      let branchQuery = supabase.from('branches').select('*');
      
      if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranches.length > 0) {
        branchQuery = branchQuery.in('nama_branch', allowedBranches);
      }
      
      const { data: branchData } = await branchQuery;
      setBranches(branchData || []);
    } catch (error) {
      // Error fetching branches
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
    if (!hasAppliedFilter) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      if (!dateRange.startDate || !dateRange.endDate) {
        showToast('Please select valid date range', 'error');
        setLoading(false);
        return;
      }

      const bufferDate = new Date(dateRange.startDate);
      bufferDate.setDate(bufferDate.getDate() - 30);
      const bufferDateStr = bufferDate.toISOString().split('T')[0];

      let readyQuery = supabase
        .from('ready')
        .select('*')
        .gte('tanggal_input', bufferDateStr)
        .lte('tanggal_input', dateRange.endDate)
        .order('tanggal_input', { ascending: false });

      if (branchFilter) {
        const selectedBranchData = branches.find(b => b.nama_branch === branchFilter);
        if (selectedBranchData) {
          readyQuery = readyQuery.eq('id_branch', selectedBranchData.id_branch);
        }
      } else if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranches.length > 0) {
        const allowedBranchIds = branches
          .filter(b => allowedBranches.includes(b.nama_branch))
          .map(b => b.id_branch);
        if (allowedBranchIds.length > 0) {
          readyQuery = readyQuery.in('id_branch', allowedBranchIds);
        }
      }

      const { data: readyData, error: readyError } = await readyQuery;

      if (readyError || !readyData) {
        throw new Error(`Failed to fetch ready data: ${readyError?.message || 'No data returned'}`);
      }

      const { data: productData } = await supabase.from('nama_product').select('*');
      const { data: branchData } = await supabase.from('branches').select('*');
      
      const uniqueProductIds = [...new Set(readyData?.map(r => r.id_product) || [])];
      
      let warehouseData: any[] = [];
      let whFrom = 0;
      const whBatch = 1000;
      while (true) {
        const { data: whBatchData, error } = await supabase
          .from('gudang_final_view')
          .select('*')
          .gte('tanggal', bufferDateStr)
          .in('id_product', uniqueProductIds)
          .range(whFrom, whFrom + whBatch - 1);
        if (error) break;
        if (!whBatchData || whBatchData.length === 0) break;
        warehouseData = warehouseData.concat(whBatchData);
        if (whBatchData.length < whBatch) break;
        whFrom += whBatch;
      }
      
      let allEsbData: any[] = [];
      let esbPage = 0;
      const esbPageSize = 1000;
      
      while (true) {
        const { data: esbBatch } = await supabase
          .from('esb_harian')
          .select('sales_date, product_id, branch, qty_total')
          .gte('sales_date', dateRange.startDate)
          .lte('sales_date', dateRange.endDate)
          .in('product_id', uniqueProductIds)
          .range(esbPage * esbPageSize, (esbPage + 1) * esbPageSize - 1);
        
        if (!esbBatch || esbBatch.length === 0) break;
        allEsbData = [...allEsbData, ...esbBatch];
        
        if (esbBatch.length < esbPageSize) break;
        esbPage++;
      }
      
      const esbData = allEsbData;
      
      const { data: productionData } = await supabase
        .from('produksi')
        .select('id_product, tanggal_input, total_konversi')
        .gte('tanggal_input', bufferDateStr)
        .lte('tanggal_input', dateRange.endDate)
        .in('id_product', uniqueProductIds);
      
      let productionDetailData: any[] = [];
      let pdFrom = 0;
      const pdBatch = 1000;
      while (true) {
        const { data: pdBatchData, error } = await supabase
          .from('produksi_detail')
          .select('item_id, tanggal_input, total_pakai, branch')
          .gte('tanggal_input', bufferDateStr)
          .lte('tanggal_input', dateRange.endDate)
          .in('item_id', uniqueProductIds)
          .range(pdFrom, pdFrom + pdBatch - 1);
        if (error) break;
        if (!pdBatchData || pdBatchData.length === 0) break;
        productionDetailData = productionDetailData.concat(pdBatchData);
        if (pdBatchData.length < pdBatch) break;
        pdFrom += pdBatch;
      }

      const allAnalysisData = processAnalysisData(
        readyData || [],
        productData || [],
        warehouseData || [],
        esbData || [],
        productionData || [],
        branchData || [],
        productionDetailData || [],        
      );
      
      const filteredAnalysisData = allAnalysisData.filter(item => {
        return item.tanggal >= dateRange.startDate && item.tanggal <= dateRange.endDate;
      });

      const pivotDataTemp: PivotData = {};
      
      filteredAnalysisData.forEach(item => {
        const subCategory = item.sub_category;
        const productName = item.product;
        const date = item.tanggal;
        
        if (productSearch && !productName.toLowerCase().includes(productSearch.toLowerCase())) {
          return;
        }
        
        if (!pivotDataTemp[subCategory]) {
          pivotDataTemp[subCategory] = {};
        }
        
        if (!pivotDataTemp[subCategory][productName]) {
          pivotDataTemp[subCategory][productName] = {};
        }
        
        pivotDataTemp[subCategory][productName][date] = {
          selisih: item.selisih,
          pemakaian: item.keluar_form
        };
      });
      
      setData(filteredAnalysisData);
      setPivotData(pivotDataTemp);
    } catch (error: any) {
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const norm = (s?: string) => (s || '').trim().toLowerCase();
  
  const pickLatestOnOrBefore = (items: any[], date: string) => {
    return items
      .filter(w => {
        const d = w.tanggal ? w.tanggal.split('T')[0] : null;
        return d && d <= date;
      })
      .sort((a, b) => new Date(b.tanggal || '1900-01-01').getTime() - new Date(a.tanggal || '1900-01-01').getTime())[0] || null;
  };

  const processAnalysisData = (readyStock: any[], products: any[], warehouse: any[], esb: any[], production: any[], branches: any[], productionDetail: any[]): AnalysisData[] => {
    const productMap = new Map(products.map(p => [p.id_product, p]));
    const branchMap = new Map(branches.map(b => [b.id_branch, b]));

    const warehouseMap = new Map();
    warehouse.forEach(w => {
      const key = `${w.id_product}-${w.cabang}`;
      if (!warehouseMap.has(key)) warehouseMap.set(key, []);
      warehouseMap.get(key).push(w);
    });
    
    const esbMap = new Map();
    esb.forEach(e => {
      const key = `${e.sales_date}-${e.product_id}-${norm(e.branch)}`;
      esbMap.set(key, e);
    });
    
    const productionMap = new Map();
    production.forEach(p => {
      const key = `${p.id_product}-${p.tanggal_input}`;
      productionMap.set(key, p);
    });
    
    return readyStock.map((ready, index) => {
      const product = productMap.get(ready.id_product);
      const productName = product?.product_name || `Product ${ready.id_product}`;
      const branch = branchMap.get(ready.id_branch);
      
      const warehouseKey = `${ready.id_product}-${branch?.kode_branch}`;
      const warehouseItems = warehouseMap.get(warehouseKey) || [];
      const warehouseItem = pickLatestOnOrBefore(warehouseItems, ready.tanggal_input);
      
      const readyDate = String(ready.tanggal_input).slice(0, 10);
      const readyBranchNorm = norm(branch?.nama_branch);
      const esbKey = `${readyDate}-${ready.id_product}-${readyBranchNorm}`;
      const esbItem = esbMap.get(esbKey);
      const hasilESB = esbItem ? Number(esbItem.qty_total) : 0;
      
      const productionKey = `${ready.id_product}-${ready.tanggal_input}`;
      const productionItem = productionMap.get(productionKey);
      
      const branchCodeToNameMap = new Map();
      branches.forEach(branch => {
        branchCodeToNameMap.set(branch.kode_branch, branch.nama_branch);
      });
      
      const expectedBranchName = branchCodeToNameMap.get(branch?.kode_branch || '') || branch?.nama_branch;
      
      const totalProduction = productionDetail
        .filter((pd: any) => {
          return pd.item_id === ready.id_product && 
                 pd.tanggal_input === ready.tanggal_input &&
                 (pd.branch || '').trim() === (expectedBranchName || '').trim();
        })
        .reduce((sum: number, pd: any) => sum + (pd.total_pakai || 0), 0);
      
      const sumifTotal = productionItem?.total_konversi || 0;
      const keluarForm = calculateKeluarForm(ready, readyStock, warehouse, branchMap, sumifTotal);
      const selisih = calculateSelisih(hasilESB, keluarForm, totalProduction);
      
      const tolerancePercentage = 5.0;
      const toleranceValue = hasilESB * (tolerancePercentage / 100);
      const toleranceMin = -toleranceValue;
      const toleranceMax = toleranceValue;
      const toleranceRange = `${toleranceMin.toFixed(1)} ~ ${toleranceMax.toFixed(1)}`;
      const status = Math.abs(selisih) <= toleranceValue ? 'OK' : (selisih < 0 ? 'Kurang' : 'Lebih');
      const normalizedSubCategory = (ready.sub_category || '').toUpperCase();

      return {
        id_product: ready.id_product,
        ready_no: ready.ready_no || `${index + 1}`,
        tanggal: ready.tanggal_input || '',
        product: productName,
        unit_kecil: product?.unit_kecil || '',
        cabang: branch?.nama_branch || `Branch ${ready.id_branch}`,
        ready: ready.ready || 0,
        gudang: warehouseItem?.running_total || warehouseItem?.total_gudang || 0,
        barang_masuk: 0,
        waste: ready.waste || 0,
        total_barang: (ready.ready || 0) + (warehouseItem?.running_total || warehouseItem?.total_gudang || 0),
        sub_category: normalizedSubCategory|| 'Unknown',
        keluar_form: keluarForm,
        hasil_esb: hasilESB,
        selisih,
        total_production: totalProduction,
        sumif_total: sumifTotal,
        tolerance_percentage: tolerancePercentage,
        tolerance_range: toleranceRange,
        status
      };
    });
  };

  const calculateKeluarForm = (currentReady: any, allReadyStock: any[], warehouse: any[], branchMap: Map<any, any>, totalKonversi: number): number => {
    const currentDate = new Date(currentReady.tanggal_input + 'T00:00:00Z');
    currentDate.setDate(currentDate.getDate() - 1);
    const previousDayStr = currentDate.getFullYear() + '-' + 
      String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(currentDate.getDate()).padStart(2, '0');
    const branch = branchMap.get(currentReady.id_branch);
    
    const previousReady = allReadyStock.find(r => 
      r.id_product === currentReady.id_product && 
      r.id_branch === currentReady.id_branch &&
      r.tanggal_input === previousDayStr
    );
    
    const previousWarehouseItems = warehouse.filter(w => {
      const d = w.tanggal ? w.tanggal.split('T')[0] : null;
      return w.id_product === currentReady.id_product &&
             d && d <= previousDayStr &&
             w.cabang === branch?.kode_branch;
    });
    const previousWarehouseItem = pickLatestOnOrBefore(previousWarehouseItems, previousDayStr);
    
    const stokKemarin = (previousReady?.ready || 0) + (previousWarehouseItem?.running_total || previousWarehouseItem?.total_gudang || 0);
    
    const barangMasukHariIni = warehouse
      .filter(w => {
        const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null;
        return w.id_product === currentReady.id_product &&
               warehouseDate === currentReady.tanggal_input &&
               w.cabang === branch?.kode_branch;
      })
      .reduce((sum, w) => sum + (w.jumlah_masuk || 0), 0);
    
    const currentWarehouseItems = warehouse.filter(w => {
      const d = w.tanggal ? w.tanggal.split('T')[0] : null;
      return w.id_product === currentReady.id_product &&
             d && d <= currentReady.tanggal_input &&
             w.cabang === branch?.kode_branch;
    });
    const currentWarehouseItem = pickLatestOnOrBefore(currentWarehouseItems, currentReady.tanggal_input);
    
    const stokHariIni = (currentReady.ready || 0) + (currentWarehouseItem?.running_total || currentWarehouseItem?.total_gudang || 0);
    const waste = currentReady.waste || 0;
    
    const keluarForm = (stokKemarin + barangMasukHariIni) - (stokHariIni + waste) + totalKonversi;
    
    return keluarForm;
  };

  const calculateSelisih = (hasilEsb: number, keluarForm: number, totalProduction: number): number => {
    return hasilEsb - keluarForm + totalProduction;
  };

  const handleExport = () => {
    if (Object.keys(pivotData).length === 0) {
      showToast('No data to export', 'error');
      return;
    }

    const dates = getAllDates();
    const exportData: any[] = [];

    Object.entries(pivotData).forEach(([subcategory, products]) => {
      const subcategoryRow: any = { 'Subcategory / Product': subcategory };
      dates.forEach(date => {
        const total = Object.values(products).reduce((sum, productDates) => {
          const value = displayMode === 'selisih' ? productDates[date]?.selisih : productDates[date]?.pemakaian;
          return sum + (value || 0);
        }, 0);
        subcategoryRow[new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })] = total.toFixed(2);
      });
      exportData.push(subcategoryRow);

      Object.entries(products).forEach(([product, datesData]) => {
        const productRow: any = { 'Subcategory / Product': `  ${product}` };
        dates.forEach(date => {
          const value = displayMode === 'selisih' ? datesData[date]?.selisih : datesData[date]?.pemakaian;
          productRow[new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })] = (value || 0).toFixed(2);
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
      <PageAccessControl pageName="pivot">
        <div className="p-6 space-y-6">
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

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">From:</label>
                <input
                  type="date"
                  value={tempDateRange.startDate}
                  onChange={(e) => setTempDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="px-3 py-2 border rounded text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">To:</label>
                <input
                  type="date"
                  value={tempDateRange.endDate}
                  onChange={(e) => setTempDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="px-3 py-2 border rounded text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Branch:</label>
                <select
                  value={tempBranchFilter}
                  onChange={(e) => setTempBranchFilter(e.target.value)}
                  className="px-1 py-2 border rounded text-sm"
                >
                  <option value="">{userRole === 'super admin' || userRole === 'admin' ? 'All Branches' : 'All My Branches'}</option>
                  {branches.map(branch => (
                    <option key={branch.id_branch} value={branch.nama_branch}>
                      {branch.nama_branch}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={applyFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Apply Filter
                </button>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                >
                  Reset
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Product:</label>
                <input
                  type="text"
                  placeholder="🔍 Search product..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="px-3 py-2 border rounded text-sm w-30"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Pivot Table - {displayMode === 'selisih' ? 'Selisih' : 'Pemakaian'} Analysis</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setDisplayMode('selisih')}
                  className={`px-3 py-1 rounded text-sm ${
                    displayMode === 'selisih' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Selisih
                </button>
                <button
                  onClick={() => setDisplayMode('pemakaian')}
                  className={`px-3 py-1 rounded text-sm ${
                    displayMode === 'pemakaian' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Pemakaian
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {!hasAppliedFilter ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="mb-4">
                    <AlertTriangle size={48} className="mx-auto text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Data to Display</h3>
                  <p className="text-sm">Please select date range and branch filter, then click "Apply Filter" to load data.</p>
                </div>
              ) : (
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
                              const value = displayMode === 'selisih' ? productDates[date]?.selisih : productDates[date]?.pemakaian;
                              return sum + (value || 0);
                            }, 0);
                            
                            return (
                              <td key={date} className={`border px-3 py-2 text-center font-medium ${
                                total < 0 ? 'text-red-600' : total > 0 ? 'text-green-600' : 'text-gray-600'
                              }`}>
                                {total.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                        
                        {expandedSubcategories.has(subcategory) && 
                          Object.entries(products).map(([product, datesData]) => (
                            <tr key={product} className="bg-blue-50">
                              <td className="border px-3 py-2 pl-8">{product}</td>
                              {dates.map(date => {
                                const value = displayMode === 'selisih' ? datesData[date]?.selisih : datesData[date]?.pemakaian;
                                
                                return (
                                  <td key={date} className={`border px-3 py-2 text-center ${
                                    (value || 0) < 0 ? 'text-red-600' : 
                                    (value || 0) > 0 ? 'text-green-600' : 'text-gray-600'
                                  }`}>
                                    {(value || 0).toFixed(2)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        }
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
              
              {hasAppliedFilter && Object.keys(pivotData).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No data available for the selected filters
                </div>
              )}
            </div>
          </div>

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