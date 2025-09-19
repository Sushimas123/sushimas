'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/src/lib/supabaseClient";
import { Download, RefreshCw } from 'lucide-react';
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

export default function AnalysisPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalysisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
    endDate: new Date().toISOString().split('T')[0] // today
  });
  const [debouncedProductFilter, setDebouncedProductFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editingTolerance, setEditingTolerance] = useState<{id: number, value: string} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    ready_no: false,
    tanggal: true,
    product: true,
    unit_kecil: false,
    cabang: true,
    ready: true,
    gudang: true,
    barang_masuk: true,
    waste: true,
    total_barang: true,
    sub_category: false,
    keluar_form: true,
    hasil_esb: true,
    selisih: true,
    total_production: true,
    sumif_total: true,
    tolerance_percentage: true,
    tolerance_range: true,
    status: true
  });
  const [userRole, setUserRole] = useState<string>('guest');

  // Load column settings on mount
  useEffect(() => {
    const saved = localStorage.getItem('analysis-visible-columns');
    if (saved) {
      try {
        setVisibleColumns(JSON.parse(saved));
      } catch (e) {
      }
    }
  }, []);

  useEffect(() => {
    fetchAnalysisData();
    
    // Get user role
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role || 'guest');
    }
  }, [dateRange]);

  // Save column settings whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('analysis-visible-columns', JSON.stringify(visibleColumns));
    } catch (e) {
    }
  }, [visibleColumns]);

  // Debounce product filter
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductFilter(productFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [productFilter]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleReadyClick = (tanggal: string, cabang: string, productName: string) => {
    const params = new URLSearchParams({
      date: tanggal,
      branch: cabang,
      product: productName
    });
    router.push(`/ready?${params.toString()}`);
  };

  const handleGudangClick = (tanggal: string, cabang: string, productName: string) => {
    const params = new URLSearchParams({
      date: tanggal,
      branch: cabang,
      product: productName
    });
    router.push(`/gudang?${params.toString()}`);
  };

  const handleEsbClick = (tanggal: string, cabang: string, productName: string) => {
    const params = new URLSearchParams({
      date: tanggal,
      branch: cabang,
      product: productName
    });
    router.push(`/esb?${params.toString()}`);
  };

  const handleProductionClick = (tanggal: string, cabang: string, productName: string) => {
    const params = new URLSearchParams({
      date: tanggal,
      branch: cabang,
      product: productName
    });
    router.push(`/produksi_detail?${params.toString()}`);
  };

  const handleTotalKonversiClick = (tanggal: string, cabang: string, productName: string) => {
    const params = new URLSearchParams({
      date: tanggal,
      branch: cabang,
      product: productName
    });
    router.push(`/produksi?${params.toString()}`);
  };

  const handleToleranceUpdate = async (productId: number, newValue: string) => {
    const tolerance = parseFloat(newValue);
    if (isNaN(tolerance) || tolerance < 0 || tolerance > 100) {
      showToast('Tolerance must be between 0 and 100', 'error');
      setEditingTolerance(null);
      return;
    }

    try {      
      // Update tolerance in all branch settings for this product
      const { data: branchSettings } = await supabase
        .from('product_branch_settings')
        .select('id_setting')
        .eq('id_product', productId);
      
      if (branchSettings && branchSettings.length > 0) {
        // Update existing settings
        for (const setting of branchSettings) {
          const { error: updateError } = await supabase
            .from('product_branch_settings')
            .update({ tolerance_percentage: tolerance })
            .eq('id_setting', setting.id_setting);
          
          if (updateError) {
            console.error('Update error:', updateError);
            throw updateError;
          }
        }
      } else {
        showToast('No branch settings found for this product. Please configure in Product Settings first.', 'error');
        setEditingTolerance(null);
        return;
      }
      
      // Update local data and recalculate status
      setData(prev => prev.map(item => {
        if (item.id_product === productId) {
          const toleranceValue = Math.abs(item.hasil_esb) * (tolerance / 100);
          const toleranceMin = -toleranceValue;
          const toleranceMax = toleranceValue;
          const toleranceRange = `${toleranceMin.toFixed(1)} ~ ${toleranceMax.toFixed(1)}`;
          const status = Math.abs(item.selisih) <= toleranceValue ? 'OK' : (item.selisih < 0 ? 'Kurang' : 'Lebih');
          
          return { 
            ...item, 
            tolerance_percentage: tolerance,
            tolerance_range: toleranceRange,
            status
          };
        }
        return item;
      }));
      
      showToast('Tolerance updated successfully', 'success');
    } catch (error: any) {
      console.error('Error updating tolerance:', error);
      const errorMessage = error?.message || error?.details || 'Unknown error';
      showToast(`Failed to update tolerance: ${errorMessage}`, 'error');
    } finally {
      setEditingTolerance(null);
    }
  };

  const fetchAnalysisData = async () => {
    setLoading(true);
    try {
      // Validate date range
      if (!dateRange.startDate || !dateRange.endDate) {
        showToast('Please select valid date range', 'error');
        setLoading(false);
        return;
      }

      // Add buffer 1 day before start date for accurate calculation
      const bufferDate = new Date(dateRange.startDate);
      bufferDate.setDate(bufferDate.getDate() - 1);
      const bufferDateStr = bufferDate.toISOString().split('T')[0];

      // Fetch ready data with simple date filter
      const { data: readyData, error: readyError } = await supabase
        .from('ready')
        .select('*')
        .gte('tanggal_input', bufferDateStr)
        .lte('tanggal_input', dateRange.endDate)
        .order('tanggal_input', { ascending: false })
        .limit(1000);

        if (readyError || !readyData) {
          throw new Error(`Failed to fetch ready data: ${readyError?.message || 'No data returned'}`);
        }

      const { data: productData } = await supabase.from('nama_product').select('*');
      const { data: branchData } = await supabase.from('branches').select('*');
      // Fetch tolerance data from product_branch_settings
      const { data: toleranceData } = await supabase
        .from('product_branch_settings')
        .select('id_product, id_branch, tolerance_percentage');
      
      // Get unique products and dates for optimized queries
      const uniqueProductIds = [...new Set(readyData?.map(r => r.id_product) || [])];
      
      // Fetch warehouse data with buffer - get ALL data for accurate calculations
      const { data: warehouseData } = await supabase
        .from('gudang')
        .select('*')
        .gte('tanggal', bufferDateStr)
        .in('id_product', uniqueProductIds);
      
      // Fetch ESB data with buffer
      const { data: esbData } = await supabase
        .from('esb_harian')
        .select('sales_date, product_id, branch, qty_total')
        .gte('sales_date', bufferDateStr)
        .lte('sales_date', dateRange.endDate)
        .in('product_id', uniqueProductIds);
      
      // Fetch production data with buffer
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

      if (!readyData || readyData.length === 0) {
        showToast('No ready data found. Please add some data in Ready Stock first.', 'error');
        setData([]);
        return;
      }

      // Process data with buffer for accurate calculation
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
      
      // Filter for display (remove buffer data)
      let filteredAnalysisData = allAnalysisData.filter(item => {
        return item.tanggal >= dateRange.startDate && item.tanggal <= dateRange.endDate;
      });
      
      // Apply branch filter for display only - calculations already done with full data
      const userBranchFilter = await getBranchFilter();
      if (userBranchFilter && userBranchFilter.length > 0) {
        const { data: branchData } = await supabase
          .from('branches')
          .select('nama_branch, kode_branch')
          .in('kode_branch', userBranchFilter);
        
        const allowedBranchNames = branchData?.map(b => b.nama_branch) || [];
        filteredAnalysisData = filteredAnalysisData.filter(item => 
          allowedBranchNames.includes(item.cabang)
        );
      }

      setData(filteredAnalysisData);
    } catch (error) {
      showToast('Failed to fetch analysis data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const processAnalysisData = (readyStock: any[], products: any[], warehouse: any[], esb: any[], production: any[], branches: any[], productionDetail: any[], tolerances: any[]): AnalysisData[] => {
    // Create lookup maps for better performance
    const productMap = new Map(products.map(p => [p.id_product, p]));
    const branchMap = new Map(branches.map(b => [b.id_branch, b]));
    
    // Create tolerance map by product and branch
    const toleranceMap = new Map();
    tolerances.forEach(t => {
      const key = `${t.id_product}-${t.id_branch}`;
      toleranceMap.set(key, t);
    });
    
    // Group warehouse data by product and branch for faster lookup
    const warehouseMap = new Map();
    warehouse.forEach(w => {
      const key = `${w.id_product}-${w.cabang}`;
      if (!warehouseMap.has(key)) warehouseMap.set(key, []);
      warehouseMap.get(key).push(w);
    });
    
    // Group ESB data for faster lookup
    const esbMap = new Map();
    esb.forEach(e => {
      const key = `${e.sales_date}-${e.product_id}-${e.branch?.trim()}`;
      esbMap.set(key, e);
    });
    
    // Group production data for faster lookup
    const productionMap = new Map();
    production.forEach(p => {
      const key = `${p.id_product}-${p.tanggal_input}`;
      productionMap.set(key, p);
    });
    
    // Group production detail data by product, date, and branch
    const productionDetailMap = new Map();
    productionDetail.forEach(pd => {
      const key = `${pd.item_id}-${pd.tanggal_input}-${pd.branch}`;
      if (!productionDetailMap.has(key)) productionDetailMap.set(key, []);
      productionDetailMap.get(key).push(pd);
    });
    
    return readyStock.map((ready, index) => {
      // Get product info from map
      const product = productMap.get(ready.id_product);
      const productName = product?.product_name || `Product ${ready.id_product}`;
      const unitKecil = product?.unit_kecil || '';
      
      // Get branch info from map
      const branch = branchMap.get(ready.id_branch);
      const cabangName = branch?.nama_branch || `Branch ${ready.id_branch}`;
      
      // Gudang lookup using map
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
      
      // Hasil ESB lookup using map
      const readyDate = String(ready.tanggal_input).slice(0, 10);
      const readyBranch = branch?.nama_branch?.trim() || "";
      const esbKey = `${readyDate}-${ready.id_product}-${readyBranch}`;
      const esbItem = esbMap.get(esbKey);
      const hasilESB = esbItem ? Number(esbItem.qty_total) : 0;
      

      
      const productionKey = `${ready.id_product}-${ready.tanggal_input}`;
      const productionItem = productionMap.get(productionKey);

      const gudang = warehouseItem?.total_gudang || 0;
      
      // Barang Masuk - calculate from ALL data (not filtered by date range)
      const barangMasuk = warehouseItems
        .filter((w: any) => {
          const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null;
          return warehouseDate === ready.tanggal_input;
        })
        .reduce((sum: number, w: any) => sum + (w.jumlah_masuk || 0), 0);
      const waste = ready.waste || 0;
      const totalBarang = (ready.ready || 0) + gudang;
      // Total Production - sum production detail for this product, date, and branch
      // Map branch names: production detail uses full names, ready uses branch codes
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

      const selisih = calculateSelisih(productName, hasilESB, keluarForm, totalProduction);
      
      // Get tolerance using product and branch
      const toleranceKey = `${ready.id_product}-${ready.id_branch}`;
      const tolerance = toleranceMap.get(toleranceKey);
      const tolerancePercentage = tolerance?.tolerance_percentage || 5.0;
      
      // Calculate status based on selisih and tolerance
      // Tolerance dikalikan dengan Hasil ESB sebagai base value
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
        unit_kecil: unitKecil,
        cabang: branch?.nama_branch || `Branch ${ready.id_branch}`,
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
      };
    });
  };

  // KELUAR FORM = BARANG YANG TERJUAL HARI INI
  // Rumus: (Stok Kemarin + Barang Masuk Hari Ini) - (Stok Hari Ini + Waste) + Total Konversi
  const calculateKeluarForm = (currentReady: any, allReadyStock: any[], warehouse: any[], branchMap: Map<any, any>, totalKonversi: number): number => {
    // Calculate previous day - simple string manipulation to avoid timezone issues
    const currentDate = new Date(currentReady.tanggal_input + 'T00:00:00Z');
    currentDate.setDate(currentDate.getDate() - 1);
    const previousDayStr = currentDate.getFullYear() + '-' + 
      String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(currentDate.getDate()).padStart(2, '0');
    const branch = branchMap.get(currentReady.id_branch);
    
    // Stok kemarin (Ready + Gudang)
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
    
    // Barang masuk hari ini
    const barangMasukHariIni = warehouse
      .filter(w => {
        const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null;
        return w.id_product === currentReady.id_product &&
               warehouseDate === currentReady.tanggal_input &&
               w.cabang === branch?.kode_branch;
      })
      .reduce((sum, w) => sum + (w.jumlah_masuk || 0), 0);
    
    // Stok hari ini (Ready + Gudang)
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
    
    // Keluar Form = (Stok Kemarin + Barang Masuk Hari Ini) - (Stok Hari Ini + Waste) + Total Konversi
    const keluarForm = (stokKemarin + barangMasukHariIni) - (stokHariIni + waste) + totalKonversi;
    
    return keluarForm;
  };

  const calculateSelisih = (product: string, hasilEsb: number, keluarForm: number, totalProduction: number): number => {
    return hasilEsb - keluarForm + totalProduction;
  };

  const handleExport = () => {
    if (data.length === 0) {
      showToast('No data to export', 'error');
      return;
    }

    const exportData = data.map(item => ({
      'Ready No': item.ready_no,
      'Tanggal': item.tanggal,
      'Product': item.product,
      'Unit Kecil': item.unit_kecil,
      'Cabang': item.cabang,
      'Ready': item.ready,
      'Gudang': item.gudang,
      'Barang Masuk': item.barang_masuk,
      'Waste': item.waste,
      'Total Barang': item.total_barang,
      'Sub Category': item.sub_category,
      'Pemakaian': item.keluar_form,
      'Penjualan': item.hasil_esb,
      'Selisih': item.selisih,
      'Total Production': item.total_production,
      'Total Konversi': item.sumif_total,
      'Toleransi (%)': item.tolerance_percentage,
      'Range Toleransi': item.tolerance_range,
      'Status': item.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analysis Report');
    XLSX.writeFile(wb, `analysis_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Analysis report exported successfully', 'success');
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleColumn = (column: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column as keyof typeof prev]
    }));
  };

  const filteredAndSortedData = React.useMemo(() => {
    let filtered = data.filter(item => {
      const matchesProduct = !debouncedProductFilter || item.product.toLowerCase().includes(debouncedProductFilter.toLowerCase());
      const matchesSubCategory = !subCategoryFilter || item.sub_category === subCategoryFilter;
      const matchesBranch = !branchFilter || item.cabang === branchFilter;
      return matchesProduct && matchesSubCategory && matchesBranch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key as keyof AnalysisData];
        let bValue = b[sortConfig.key as keyof AnalysisData];
        
        if (aValue === undefined) aValue = '';
        if (bValue === undefined) bValue = '';
        
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, debouncedProductFilter, subCategoryFilter, branchFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const columns = [
    { key: 'ready_no', label: 'Ready No' },
    { key: 'tanggal', label: 'Tanggal' },
    { key: 'product', label: 'Product' },
    { key: 'unit_kecil', label: 'Unit Kecil' },
    { key: 'cabang', label: 'Cabang' },
    { key: 'ready', label: 'Ready' },
    { key: 'gudang', label: 'Gudang' },
    { key: 'barang_masuk', label: 'Barang Masuk' },
    { key: 'waste', label: 'Waste' },
    { key: 'total_barang', label: 'Total Barang' },
    { key: 'sub_category', label: 'Sub Category' },
    { key: 'keluar_form', label: 'Pemakaian' },
    { key: 'hasil_esb', label: 'Penjualan' },
    { key: 'selisih', label: 'Selisih' },
    { key: 'total_production', label: 'Total Production' },
    { key: 'sumif_total', label: 'Total Konversi' },
    { key: 'tolerance_percentage', label: 'Toleransi (%)' },
    { key: 'tolerance_range', label: 'Range Toleransi' },
    { key: 'status', label: 'Status' }
  ];

  const uniqueSubCategories = [...new Set(data.map(item => item.sub_category).filter(Boolean))];
  const uniqueBranches = [...new Set(data.map(item => item.cabang).filter(Boolean))];

  return (
    <Layout>
      <PageAccessControl pageName="analysis">
        <div className="p-4 md:p-6">
        {toast && (
          <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {toast.message}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-xl font-bold text-gray-800">📊 Analysis Master View</h1>
        </div>

        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <div className="flex flex-wrap gap-4 items-end">

            <div>
              <label htmlFor="startDate" className="block text-sm font-medium mb-2 text-gray-700">Start Date</label>
              <input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({...prev, startDate: e.target.value}))}
                className="border border-gray-300 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium mb-2 text-gray-700">End Date</label>
              <input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({...prev, endDate: e.target.value}))}
                className="border border-gray-300 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="productFilter" className="block text-sm font-medium mb-2 text-gray-700">Product Filter</label>
              <input
                id="productFilter"
                name="productFilter"
                type="text"
                placeholder="Search products..."
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="subCategoryFilter" className="block text-sm font-medium mb-2 text-gray-700">Sub Category</label>
              <select
                id="subCategoryFilter"
                name="subCategoryFilter"
                value={subCategoryFilter}
                onChange={(e) => setSubCategoryFilter(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Sub Categories</option>
                {uniqueSubCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="branchFilter" className="block text-sm font-medium mb-2 text-gray-700">Branch</label>
              <select
                id="branchFilter"
                name="branchFilter"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Branches</option>
                {uniqueBranches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  setDateRange({ startDate: yesterday, endDate: yesterday });
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-1 py-1 rounded text-xs"
              >
                Yesterday
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                  setDateRange({ 
                    startDate: weekAgo.toISOString().split('T')[0], 
                    endDate: today.toISOString().split('T')[0] 
                  });
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-1 py-1 rounded text-xs"
              >
                7D
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                  setDateRange({ 
                    startDate: monthAgo.toISOString().split('T')[0], 
                    endDate: today.toISOString().split('T')[0] 
                  });
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-1 py-1 rounded text-xs"
              >
                30D
              </button>

              <button
                onClick={() => setShowColumnFilter(!showColumnFilter)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-1 py-1 rounded text-xs"
              >
                📋
              </button>
              {(userRole === 'super admin' || userRole === 'admin') && (
                <button
                  onClick={handleExport}
                  className="bg-green-600 hover:bg-green-700 text-white px-1 py-1 rounded text-xs"
                >
                  📊
                </button>
              )}
              <button
                onClick={fetchAnalysisData}
                className="bg-gray-600 hover:bg-gray-700 text-white px-1 py-1 rounded text-xs"
              >
                🔄
              </button>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
            Showing {paginatedData.length} of {filteredAndSortedData.length} records
            {loading && <span className="ml-4 text-orange-600">⏳ Loading...</span>}
            {sortConfig && (
              <span className="ml-4 text-blue-600">
                Sorted by {sortConfig.key} ({sortConfig.direction})
              </span>
            )}
            <span className="ml-4 text-gray-500">
              📅 {dateRange.startDate} to {dateRange.endDate}
            </span>
          </div>
        </div>

        {/* Column Filter Panel */}
        {showColumnFilter && (
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <h3 className="font-medium text-gray-800 mb-3 text-sm">Show/Hide Columns</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {columns.map(column => (
                <label key={column.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key as keyof typeof visibleColumns]}
                    onChange={() => toggleColumn(column.key)}
                    className="rounded"
                  />
                  <span className="text-gray-700">{column.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto bg-white rounded-lg shadow max-h-[70vh]">
          <table className="w-full text-xs border border-gray-200">
            <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10">
              <tr>
                {visibleColumns.ready_no && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ready_no')}>Ready No</th>}
                {visibleColumns.tanggal && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal')}>Tanggal</th>}
                {visibleColumns.product && <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product')}>Product</th>}
                {visibleColumns.unit_kecil && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('unit_kecil')}>Unit Kecil</th>}
                {visibleColumns.cabang && <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('cabang')}>Cabang</th>}
                {visibleColumns.ready && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ready')}>Ready</th>}
                {visibleColumns.gudang && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('gudang')}>Gudang</th>}
                {visibleColumns.barang_masuk && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('barang_masuk')}>Barang Masuk</th>}
                {visibleColumns.waste && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('waste')}>Waste</th>}
                {visibleColumns.total_barang && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('total_barang')}>Total Barang</th>}
                {visibleColumns.sub_category && <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sub_category')}>Sub Category</th>}
                {visibleColumns.keluar_form && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('keluar_form')}>Pemakaian</th>}
                {visibleColumns.hasil_esb && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('hasil_esb')}>ESB</th>}
                {visibleColumns.selisih && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('selisih')}>Selisih</th>}
                {visibleColumns.total_production && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('total_production')}>Total Production</th>}
                {visibleColumns.sumif_total && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sumif_total')}>Total Konversi</th>}
                {visibleColumns.tolerance_percentage && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tolerance_percentage')}>Toleransi (%)</th>}
                {visibleColumns.tolerance_range && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tolerance_range')}>Range Toleransi</th>}
                {visibleColumns.status && <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>Status</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-gray-600">Loading analysis data...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="text-center py-4 text-gray-500">
                    No analysis data found
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {visibleColumns.ready_no && <td className="border px-2 py-1 text-center">{item.ready_no}</td>}
                    {visibleColumns.tanggal && <td className="border px-2 py-1 text-center">{item.tanggal}</td>}
                    {visibleColumns.product && <td className="border px-2 py-1 font-medium">{item.product}</td>}
                    {visibleColumns.unit_kecil && <td className="border px-2 py-1 text-center">{item.unit_kecil}</td>}
                    {visibleColumns.cabang && <td className="border px-2 py-1">{item.cabang}</td>}
                    {visibleColumns.ready && (
                      <td className="border px-2 py-1 text-center">
                        <button
                          onClick={() => handleReadyClick(item.tanggal, item.cabang, item.product)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title="Click to view ready stock details"
                        >
                          {item.ready.toFixed(2)}
                        </button>
                      </td>
                    )}
                    {visibleColumns.gudang && (
                      <td className="border px-2 py-1 text-center">
                        <button
                          onClick={() => handleGudangClick(item.tanggal, item.cabang, item.product)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title="Click to view gudang details"
                        >
                          {item.gudang.toFixed(2)}
                        </button>
                      </td>
                    )}
                    {visibleColumns.barang_masuk && <td className="border px-2 py-1 text-center">{item.barang_masuk.toFixed(2)}</td>}
                    {visibleColumns.waste && <td className="border px-2 py-1 text-center">{item.waste.toFixed(2)}</td>}
                    {visibleColumns.total_barang && <td className="border px-2 py-1 text-center font-medium">{item.total_barang.toFixed(2)}</td>}
                    {visibleColumns.sub_category && <td className="border px-2 py-1">{item.sub_category}</td>}
                    {visibleColumns.keluar_form && <td className="border px-2 py-1 text-center">{item.keluar_form.toFixed(2)}</td>}
                    {visibleColumns.hasil_esb && (
                      <td className="border px-2 py-1 text-center">
                        <button
                          onClick={() => handleEsbClick(item.tanggal, item.cabang, item.product)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title="Click to view ESB details"
                        >
                          {item.hasil_esb.toFixed(2)}
                        </button>
                      </td>
                    )}
                    {visibleColumns.selisih && <td className={`border px-2 py-1 text-center font-medium ${
                      item.selisih > 0 ? 'text-green-600' : item.selisih < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {item.selisih.toFixed(2)}
                    </td>}
                    {visibleColumns.total_production && (
                      <td className="border px-2 py-1 text-center">
                        <button
                          onClick={() => handleProductionClick(item.tanggal, item.cabang, item.product)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title="Click to view production details"
                        >
                          {item.total_production.toFixed(2)}
                        </button>
                      </td>
                    )}
                    {visibleColumns.sumif_total && (
                      <td className="border px-2 py-1 text-center">
                        <button
                          onClick={() => handleTotalKonversiClick(item.tanggal, item.cabang, item.product)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title="Click to view produksi details"
                        >
                          {item.sumif_total.toFixed(2)}
                        </button>
                      </td>
                    )}
                    {visibleColumns.tolerance_percentage && <td className="border px-2 py-1 text-center">
                      {editingTolerance?.id === item.id_product ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={editingTolerance?.value || ''}
                            onChange={(e) => setEditingTolerance({id: item.id_product, value: e.target.value})}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleToleranceUpdate(item.id_product, editingTolerance?.value || '0');
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingTolerance(null);
                              }
                            }}
                            className="w-12 text-center text-xs border border-blue-300 bg-yellow-100 focus:bg-white focus:border-blue-500 rounded px-1"
                            autoFocus
                          />
                          <button
                            onClick={() => handleToleranceUpdate(item.id_product, editingTolerance?.value || '0')}
                            className="text-green-600 hover:text-green-800 text-xs px-1"
                            title="Save (or press Enter)"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingTolerance(null)}
                            className="text-red-600 hover:text-red-800 text-xs px-1"
                            title="Cancel (or press Escape)"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span 
                          className="cursor-pointer hover:bg-blue-100 px-1 rounded"
                          onClick={() => setEditingTolerance({id: item.id_product, value: item.tolerance_percentage.toString()})}
                          title="Click to edit tolerance"
                        >
                          {item.tolerance_percentage.toFixed(1)}%
                        </span>
                      )}
                    </td>}
                    {visibleColumns.tolerance_range && <td className="border px-2 py-1 text-center text-xs">{item.tolerance_range}</td>}
                    {visibleColumns.status && <td className={`border px-2 py-1 text-center font-medium ${
                      item.status === 'OK' ? 'text-green-600 bg-green-50' : 
                      item.status === 'Kurang' ? 'text-red-600 bg-red-50' : 'text-purple-600 bg-purple-50'
                    }`}>
                      {item.status}
                    </td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} entries
          </p>
          <div className="flex gap-1">
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(1)}
              className="px-3 py-1 border rounded disabled:opacity-50 text-sm hover:bg-gray-50"
            >
              First
            </button>
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 border rounded disabled:opacity-50 text-sm hover:bg-gray-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 border rounded text-sm bg-blue-50">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button 
              disabled={currentPage === totalPages || totalPages === 0} 
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 border rounded disabled:opacity-50 text-sm hover:bg-gray-50"
            >
              Next
            </button>
            <button 
              disabled={currentPage === totalPages || totalPages === 0} 
              onClick={() => setCurrentPage(totalPages)}
              className="px-3 py-1 border rounded disabled:opacity-50 text-sm hover:bg-gray-50"
            >
              Last
            </button>
          </div>
        </div>
        </div>
      </PageAccessControl>
    </Layout>
  );
}