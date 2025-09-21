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

interface InvestigationNotes {
  id: number;
  analysis_id: number;
  notes: string;
  created_by: string;
  created_at: string;
}

// Cache object untuk menyimpan data yang sudah di-fetch
const dataCache = new Map();

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
  const [displayMode, setDisplayMode] = useState<'selisih' | 'pemakaian'>('selisih');
  const [userRole, setUserRole] = useState('');
  const [allowedBranches, setAllowedBranches] = useState<string[]>([]);

  // Fungsi untuk menghasilkan cache key berdasarkan parameter
  const getCacheKey = useCallback((startDate: string, endDate: string, branchFilter: string) => {
    return `${startDate}-${endDate}-${branchFilter}`;
  }, []);

  useEffect(() => {
    const init = async () => {
      await initializeUserData();
    };
    init();
    
    // Load saved date range from localStorage
    const saved = localStorage.getItem('pivot-date-range');
    if (saved) {
      try {
        setDateRange(JSON.parse(saved));
      } catch (e) {
        safeLog('Error loading saved date range:', e);
      }
    }
  }, []);

  useEffect(() => {
    fetchAnalysisData();
  }, [dateRange, branchFilter]);

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

  // Save dateRange to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pivot-date-range', JSON.stringify(dateRange));
  }, [dateRange]);

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
          
          if (error) {
            safeLog('Error fetching user branches:', error);
          }
          
          if (userBranches && userBranches.length > 0) {
            const branchNames = userBranches.map(ub => (ub.branches as any).nama_branch);
            safeLog('🔍 User branches found:', branchNames);
            setAllowedBranches(branchNames);
          } else {
            safeLog('⚠️ No user branches found, using fallback');
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
      
      // Filter branches for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranches.length > 0) {
        safeLog('🔍 Filtering branches by allowedBranches:', allowedBranches);
        branchQuery = branchQuery.in('nama_branch', allowedBranches);
      } else {
        safeLog('🔍 User role:', userRole, 'allowedBranches:', allowedBranches);
      }
      
      const { data: branchData } = await branchQuery;
      safeLog('🔍 Final branches loaded:', branchData?.map(b => b.nama_branch));
      setBranches(branchData || []);
    } catch (error) {
      safeLog('Error fetching branches:', error);
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

      // Apply branch filter
      if (branchFilter) {
        const selectedBranchData = branches.find(b => b.nama_branch === branchFilter);
        if (selectedBranchData) {
          readyQuery = readyQuery.eq('id_branch', selectedBranchData.id_branch);
        }
      } else if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranches.length > 0) {
        // For non-admin users, filter by their allowed branches
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
      const { data: toleranceData } = await supabase.from('product_tolerances').select('*');
      
      const uniqueProductIds = [...new Set(readyData?.map(r => r.id_product) || [])];
      
      const { data: warehouseData } = await supabase
        .from('gudang')
        .select('*')
        .gte('tanggal', bufferDateStr)
        .in('id_product', uniqueProductIds);
      
      const { data: esbData } = await supabase
        .from('esb_harian')
        .select('sales_date, product_id, branch, qty_total')
        .gte('sales_date', bufferDateStr)
        .lte('sales_date', dateRange.endDate)
        .in('product_id', uniqueProductIds);
      
      const { data: productionData } = await supabase
        .from('produksi')
        .select('id_product, tanggal_input, total_konversi')
        .gte('tanggal_input', bufferDateStr)
        .lte('tanggal_input', dateRange.endDate)
        .in('id_product', uniqueProductIds);
      
      const { data: productionDetailData } = await supabase
        .from('produksi_detail')
        .select('item_id, tanggal_input, total_pakai, branch')
        .gte('tanggal_input', bufferDateStr)
        .lte('tanggal_input', dateRange.endDate)
        .in('item_id', uniqueProductIds);

      // Process data menggunakan logika yang sama dengan analysis page
      const allAnalysisData = processAnalysisData(
        readyData || [],
        productData || [],
        warehouseData || [],
        esbData || [],
        productionData || [],
        branchData || [],
        productionDetailData || [],
        toleranceData || []
      );
      
      // Filter untuk display
      const filteredAnalysisData = allAnalysisData.filter(item => {
        return item.tanggal >= dateRange.startDate && item.tanggal <= dateRange.endDate;
      });

      // Build pivot data
      const pivotDataTemp: PivotData = {};
      
      filteredAnalysisData.forEach(item => {
        const subCategory = item.sub_category;
        const productName = item.product;
        const date = item.tanggal;
        
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
      safeLog('Error fetching analysis data:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const processAnalysisData = (readyStock: any[], products: any[], warehouse: any[], esb: any[], production: any[], branches: any[], productionDetail: any[], tolerances: any[]): AnalysisData[] => {
    const productMap = new Map(products.map(p => [p.id_product, p]));
    const branchMap = new Map(branches.map(b => [b.id_branch, b]));
    const toleranceMap = new Map(tolerances.map(t => [t.id_product, t]));
    
    const warehouseMap = new Map();
    warehouse.forEach(w => {
      const key = `${w.id_product}-${w.cabang}`;
      if (!warehouseMap.has(key)) warehouseMap.set(key, []);
      warehouseMap.get(key).push(w);
    });
    
    const esbMap = new Map();
    esb.forEach(e => {
      const key = `${e.sales_date}-${e.product_id}-${e.branch?.trim()}`;
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
      const filteredWarehouseItems = warehouseItems.filter((w: any) => {
        const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null;
        return warehouseDate <= ready.tanggal_input;
      });
      
      const warehouseItem = filteredWarehouseItems.length > 0 
        ? filteredWarehouseItems.reduce((latest: any, current: any) => {
            const latestTimestamp = latest.tanggal || '1900-01-01T00:00:00.000Z';
            const currentTimestamp = current.tanggal || '1900-01-01T00:00:00.000Z';
            return currentTimestamp > latestTimestamp ? current : latest;
          })
        : null;
      
      const readyDate = String(ready.tanggal_input).slice(0, 10);
      const readyBranch = branch?.nama_branch?.trim() || "";
      const esbKey = `${readyDate}-${ready.id_product}-${readyBranch}`;
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
                 pd.branch === expectedBranchName;
        })
        .reduce((sum: number, pd: any) => sum + (pd.total_pakai || 0), 0);
      
      const sumifTotal = productionItem?.total_konversi || 0;
      const keluarForm = calculateKeluarForm(ready, readyStock, warehouse, branchMap, sumifTotal);
      const selisih = calculateSelisih(hasilESB, keluarForm, totalProduction);
      
      const tolerance = toleranceMap.get(ready.id_product);
      const tolerancePercentage = tolerance?.tolerance_percentage || 5.0;
      const toleranceValue = hasilESB * (tolerancePercentage / 100);
      const toleranceMin = -toleranceValue;
      const toleranceMax = toleranceValue;
      const toleranceRange = `${toleranceMin.toFixed(1)} ~ ${toleranceMax.toFixed(1)}`;
      const status = Math.abs(selisih) <= toleranceValue ? 'OK' : (selisih < 0 ? 'Kurang' : 'Lebih');

      return {
        id_product: ready.id_product,
        ready_no: ready.ready_no || `${index + 1}`,
        tanggal: ready.tanggal_input || '',
        product: productName,
        unit_kecil: product?.unit_kecil || '',
        cabang: branch?.nama_branch || `Branch ${ready.id_branch}`,
        ready: ready.ready || 0,
        gudang: warehouseItem?.total_gudang || 0,
        barang_masuk: 0,
        waste: ready.waste || 0,
        total_barang: (ready.ready || 0) + (warehouseItem?.total_gudang || 0),
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
      const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null;
      return w.id_product === currentReady.id_product &&
             warehouseDate <= previousDayStr &&
             w.cabang === branch?.kode_branch;
    });
    
    const previousWarehouseItem = previousWarehouseItems.length > 0 
      ? previousWarehouseItems.reduce((latest, current) => {
          const latestTimestamp = latest.tanggal || '1900-01-01T00:00:00.000Z';
          const currentTimestamp = current.tanggal || '1900-01-01T00:00:00.000Z';
          return currentTimestamp > latestTimestamp ? current : latest;
        })
      : null;
    
    const stokKemarin = (previousReady?.ready || 0) + (previousWarehouseItem?.total_gudang || 0);
    
    const barangMasukHariIni = warehouse
      .filter(w => {
        const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null;
        return w.id_product === currentReady.id_product &&
               warehouseDate === currentReady.tanggal_input &&
               w.cabang === branch?.kode_branch;
      })
      .reduce((sum, w) => sum + (w.jumlah_masuk || 0), 0);
    
    const currentWarehouseItems = warehouse.filter(w => {
      const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null;
      return w.id_product === currentReady.id_product &&
             warehouseDate <= currentReady.tanggal_input &&
             w.cabang === branch?.kode_branch;
    });
    
    const currentWarehouseItem = currentWarehouseItems.length > 0 
      ? currentWarehouseItems.reduce((latest, current) => {
          const latestTimestamp = latest.tanggal || '1900-01-01T00:00:00.000Z';
          const currentTimestamp = current.tanggal || '1900-01-01T00:00:00.000Z';
          return currentTimestamp > latestTimestamp ? current : latest;
        })
      : null;
    
    const stokHariIni = (currentReady.ready || 0) + (currentWarehouseItem?.total_gudang || 0);
    const waste = currentReady.waste || 0;
    
    const keluarForm = (stokKemarin + barangMasukHariIni) - (stokHariIni + waste) + totalKonversi;
    
    return keluarForm;
  };

  const calculateSelisih = (hasilEsb: number, keluarForm: number, totalProduction: number): number => {
    return hasilEsb - keluarForm + totalProduction;
  };

  // Fungsi untuk menghapus cache lama
  const clearOldCache = useCallback(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const [key] of dataCache) {
      const [startDate] = key.split('-');
      const cacheDate = new Date(startDate);
      
      if (cacheDate < sevenDaysAgo) {
        dataCache.delete(key);
      }
    }
  }, []);

  // Bersihkan cache setiap hari
  useEffect(() => {
    const interval = setInterval(clearOldCache, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [clearOldCache]);

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
          const value = displayMode === 'selisih' ? productDates[date]?.selisih : productDates[date]?.pemakaian;
          return sum + (value || 0);
        }, 0);
        subcategoryRow[new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })] = total.toFixed(2);
      });
      exportData.push(subcategoryRow);

      // Add product rows
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

  // Komponen NegativeDiscrepancyDashboard
  const NegativeDiscrepancyDashboard: React.FC<{ 
    data: AnalysisData[], 
    dateRange: { startDate: string, endDate: string },
    branchFilter: string 
  }> = ({ data, dateRange, branchFilter }) => {
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [notes, setNotes] = useState<{ [key: number]: string }>({});
    const [savedNotes, setSavedNotes] = useState<InvestigationNotes[]>([]);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterBranch, setFilterBranch] = useState(branchFilter);
    const [savingNotes, setSavingNotes] = useState<Set<number>>(new Set());

    let negativeData = data.filter(item => item.selisih < 0);
    
    // Filter by user's allowed branches for non-admin users
    if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranches.length > 0) {
      negativeData = negativeData.filter(item => allowedBranches.includes(item.cabang));
    }

    useEffect(() => {
      if (negativeData.length > 0) {
        loadInvestigationNotes(negativeData.map(item => item.id_product));
      }
    }, [negativeData]);

    const loadInvestigationNotes = async (analysisIds: number[]) => {
      if (analysisIds.length === 0) return;
      
      const { data: notesData, error } = await supabase
        .from('investigation_notes')
        .select('*')
        .in('analysis_id', analysisIds)
        .order('created_at', { ascending: false });

      if (!error && notesData) {
        setSavedNotes(notesData);
      }
    };

    const toggleExpand = (id: number) => {
      const newExpanded = new Set(expandedItems);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      setExpandedItems(newExpanded);
    };

    const saveNotes = async (id: number) => {
      if (!notes[id] || notes[id].trim() === '') return;

      setSavingNotes(prev => new Set(prev).add(id));
      
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : { name: 'Unknown' };

      const { error } = await supabase.from('investigation_notes', {
          analysis_id: id,
          notes: notes[id],
          created_by: user.name || 'Unknown'
        });

      if (!error) {
        loadInvestigationNotes([id]);
        setNotes(prev => ({ ...prev, [id]: '' }));
      }
      
      setSavingNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    };

    const getSeverityLevel = (selisih: number) => {
      const absoluteValue = Math.abs(selisih);
      if (absoluteValue > 100) return 'high';
      if (absoluteValue > 50) return 'medium';
      return 'low';
    };

    const filteredData = negativeData.filter(item => {
      const matchesCategory = !filterCategory || item.sub_category === filterCategory;
      const matchesBranch = !filterBranch || item.cabang === filterBranch;
      return matchesCategory && matchesBranch;
    });

    const categories = [...new Set(negativeData.map(item => item.sub_category))];
    const allBranches = [...new Set(negativeData.map(item => item.cabang))];
    // Filter branches based on user's allowed branches
    const branches = userRole === 'super admin' || userRole === 'admin' 
      ? allBranches 
      : allBranches.filter(branch => allowedBranches.includes(branch));

    if (negativeData.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-bold text-green-700 flex items-center">
            <AlertTriangle className="mr-2" />
            Tidak Ada Selisih Negatif
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Selamat! Tidak ada selisih negatif yang perlu investigasi pada periode ini.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow p-6 mt-6">
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
        </div>

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

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-1 py-1 text-left w-8"></th>
                <th className="px-1 py-1 text-left w-20">Tanggal</th>
                <th className="px-1 py-1 text-left max-w-[120px]">Produk</th>
                <th className="px-1 py-1 text-left max-w-[80px]">Kategori</th>
                <th className="px-1 py-1 text-left max-w-[80px]">Cabang</th>
                <th className="px-1 py-1 text-right w-16">Selisih</th>
                <th className="px-1 py-1 text-center w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => (
                <React.Fragment key={`${item.id_product}-${item.tanggal}`}>
                  <tr className={`border-b hover:bg-gray-50 ${
                    getSeverityLevel(item.selisih) === 'high' ? 'bg-red-50' : 
                    getSeverityLevel(item.selisih) === 'medium' ? 'bg-orange-50' : 'bg-yellow-50'
                  }`}>
                    <td className="px-1 py-1">
                      <button 
                        onClick={() => toggleExpand(item.id_product)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {expandedItems.has(item.id_product) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                    <td className="px-1 py-1 text-xs">{item.tanggal}</td>
                    <td className="px-1 py-1 font-medium text-xs truncate max-w-[120px]">{item.product}</td>
                    <td className="px-1 py-1 text-xs truncate max-w-[80px]">{item.sub_category}</td>
                    <td className="px-1 py-1 text-xs truncate max-w-[80px]">{item.cabang}</td>
                    <td className="px-1 py-1 text-right text-red-600 font-bold text-xs">{item.selisih.toFixed(2)}</td>
                    <td className="px-1 py-1 text-center">
                      <span className="px-1 py-0.5 rounded text-xs bg-red-100 text-red-800">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                  
                  {expandedItems.has(item.id_product) && (
                    <tr className="bg-blue-50">
                      <td colSpan={7} className="px-2 py-2">
                        <div>
                          <h4 className="font-medium mb-1 text-xs">Catatan Investigasi</h4>
                          <div className="mb-2 max-h-32 overflow-y-auto">
                            {savedNotes
                              .filter(note => note.analysis_id === item.id_product)
                              .map(note => (
                                <div key={note.id} className="bg-white p-1 rounded border mb-1">
                                  <div className="text-xs text-gray-500">
                                    {note.created_by} - {new Date(note.created_at).toLocaleString()}
                                  </div>
                                  <div className="text-xs">{note.notes}</div>
                                </div>
                              ))
                            }
                            
                            {savedNotes.filter(note => note.analysis_id === item.id_product).length === 0 && (
                              <div className="text-gray-500 text-xs">Belum ada catatan investigasi</div>
                            )}
                          </div>
                          
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={notes[item.id_product] || ''}
                              onChange={(e) => setNotes(prev => ({ ...prev, [item.id_product]: e.target.value }))}
                              placeholder="Tambah catatan investigasi..."
                              className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs"
                            />
                            <button
                              onClick={() => saveNotes(item.id_product)}
                              disabled={savingNotes.has(item.id_product)}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-2 py-1 rounded text-xs"
                            >
                              {savingNotes.has(item.id_product) ? 'Saving...' : 'Simpan'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

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
                  <option value="">{userRole === 'super admin' || userRole === 'admin' ? 'All Branches' : 'All My Branches'}</option>
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
                      
                      {/* Product rows */}
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
              
              {Object.keys(pivotData).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No data available for the selected filters
                </div>
              )}
            </div>
          </div>

          {/* NegativeDiscrepancyDashboard */}
          <NegativeDiscrepancyDashboard 
            data={data} 
            dateRange={dateRange} 
            branchFilter={branchFilter} 
          />

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