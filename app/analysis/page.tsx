'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';

interface AnalysisData {
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
}

export default function AnalysisPage() {
  const [data, setData] = useState<AnalysisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchAnalysisData();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAnalysisData = async () => {
    setLoading(true);
    try {
      // Fetch from ready table without joins first
      const { data: readyData, error: readyError } = await supabase
        .from('ready')
        .select('*')
        .order('tanggal_input', { ascending: false });

      if (readyError) {
        console.error('Ready fetch error:', readyError);
        throw new Error(`Failed to fetch ready data: ${readyError.message}`);
      }

      // Fetch products separately
      const { data: productData, error: productError } = await supabase
        .from('nama_product')
        .select('*');

      if (productError) {
        console.error('Product fetch error:', productError);
      }

      // Fetch branches data
      const { data: branchData, error: branchError } = await supabase.from('branches').select('*');
      if (branchError) {
        console.error('Branch fetch error:', branchError);
      }
      
      // Fetch other tables with correct names
      const { data: warehouseData } = await supabase.from('gudang').select('*');
      const { data: esbData } = await supabase.from('esb_harian').select('*');
      const { data: productionData } = await supabase.from('produksi').select('*');



      if (!readyData || readyData.length === 0) {
        showToast('No ready data found. Please add some data in Ready Stock first.', 'error');
        setData([]);
        return;
      }

      const analysisData = processAnalysisData(
        readyData || [],
        productData || [],
        warehouseData || [],
        esbData || [],
        productionData || [],
        branchData || []
      );


      setData(analysisData);
    } catch (error) {
      console.error('Error fetching analysis data:', error);
      showToast('Failed to fetch analysis data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const processAnalysisData = (readyStock: any[], products: any[], warehouse: any[], esb: any[], production: any[], branches: any[]): AnalysisData[] => {
    
    return readyStock.map((ready, index) => {
      // Get product info from products array
      const product = products.find(p => p.id_product === ready.id_product);
      const productName = product?.product_name || `Product ${ready.id_product}`;
      const unitKecil = product?.unit_kecil || '';
      
      // Get branch info from branches table using id_branch
      const branch = branches.find(b => b.id_branch === ready.id_branch);
      const cabangName = branch?.nama_branch || `Branch ${ready.id_branch}`;
      
      // Gudang lookup by product, date, and branch name
      // Note: gudang.cabang stores kode_branch, so we need to match with branch.kode_branch
      const warehouseItem = warehouse.find(w => {
        const warehouseDate = w.tanggal ? w.tanggal.split('T')[0] : null;
        return w.id_product === ready.id_product &&
               warehouseDate === ready.tanggal_input &&
               w.cabang === branch?.kode_branch;
      });
      
      const esbItem = esb.find(e => 
        e.tanggal_input === ready.tanggal_input && 
        e.id_product === ready.id_product
      );
      
      const productionItem = production.find(p => 
        p.id_product === ready.id_product && 
        p.tanggal_input === ready.tanggal_input
      );

      const gudang = warehouseItem?.total_gudang || 0;
      const barangMasuk = warehouseItem?.jumlah_masuk || 0;
      const waste = ready.waste || 0;
      const totalBarang = (ready.ready || 0) + gudang;
      const totalProduction = productionItem?.total || 0;
      
      const keluarForm = calculateKeluarForm(ready, readyStock, index, totalProduction, gudang);
      const hasilEsb = esbItem?.total || 0;
      
      const sumifTotal = production
        .filter(p => p.id_product === ready.id_product && p.tanggal_input === ready.tanggal_input)
        .reduce((sum, p) => sum + (p.total || 0), 0);

      const selisih = calculateSelisih(productName, hasilEsb, keluarForm, sumifTotal);

      return {
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
        hasil_esb: hasilEsb,
        selisih,
        total_production: totalProduction,
        sumif_total: sumifTotal
      };
    });
  };

  const calculateKeluarForm = (currentReady: any, allReadyStock: any[], currentIndex: number, totalProduction: number, gudang: number): number => {
    const previousDay = new Date(currentReady.tanggal_input);
    previousDay.setDate(previousDay.getDate() - 1);
    
    // Match by Product, Branch, and Date for accurate per-branch calculation
    const previousReady = allReadyStock.find(r => 
      r.id_product === currentReady.id_product && 
      r.id_branch === currentReady.id_branch &&
      r.tanggal_input === previousDay.toISOString().split('T')[0]
    );
    
    // Excel formula: INDEX(Ready Kemarin) + Production Hari Ini - (Ready Hari Ini - Gudang Hari Ini) - Waste Hari Ini
    const readyKemarin = previousReady?.ready || 0;
    const productionHariIni = totalProduction;
    const readyHariIni = currentReady.ready || 0;
    const gudangHariIni = gudang;
    const wasteHariIni = currentReady.waste || 0;
    
    return readyKemarin + productionHariIni - (readyHariIni - gudangHariIni) - wasteHariIni;
  };

  const calculateSelisih = (product: string, hasilEsb: number, keluarForm: number, sumifTotal: number): number => {
    if (product === "Badan Salmon WIP") {
      return (hasilEsb + (0.1 * hasilEsb)) - ((keluarForm - (keluarForm * 0.07))) + sumifTotal;
    } else {
      return hasilEsb - keluarForm + sumifTotal;
    }
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
      'Keluar Form': item.keluar_form,
      'Hasil ESB': item.hasil_esb,
      'Selisih': item.selisih,
      'Total Production': item.total_production,
      'Sumif Total': item.sumif_total
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

  const filteredAndSortedData = React.useMemo(() => {
    let filtered = data.filter(item => {
      const matchesDate = !dateFilter || item.tanggal.includes(dateFilter);
      const matchesProduct = !productFilter || item.product.toLowerCase().includes(productFilter.toLowerCase());
      const matchesSubCategory = !subCategoryFilter || item.sub_category === subCategoryFilter;
      return matchesDate && matchesProduct && matchesSubCategory;
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
  }, [data, dateFilter, productFilter, subCategoryFilter, sortConfig]);

  const uniqueSubCategories = [...new Set(data.map(item => item.sub_category).filter(Boolean))];

  return (
    <Layout>
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
              <label className="block text-sm font-medium mb-2 text-gray-700">Date Filter</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Product Filter</label>
              <input
                type="text"
                placeholder="Search products..."
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Sub Category</label>
              <select
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
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1"
              >
                <Download size={16} />
                Export Excel
              </button>
              <button
                onClick={fetchAnalysisData}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
            Showing {filteredAndSortedData.length} records
            {sortConfig && (
              <span className="ml-4 text-blue-600">
                Sorted by {sortConfig.key} ({sortConfig.direction})
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full text-xs border border-gray-200">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ready_no')}>Ready No</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal')}>Tanggal</th>
                <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product')}>Product</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('unit_kecil')}>Unit Kecil</th>
                <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('cabang')}>Cabang</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ready')}>Ready</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('gudang')}>Gudang</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('barang_masuk')}>Barang Masuk</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('waste')}>Waste</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('total_barang')}>Total Barang</th>
                <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sub_category')}>Sub Category</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('keluar_form')}>Keluar Form</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('hasil_esb')}>Hasil ESB</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('selisih')}>Selisih</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('total_production')}>Total Production</th>
                <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sumif_total')}>Sumif Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {Array.from({ length: 16 }).map((_, cellIdx) => (
                      <td key={cellIdx} className="border px-2 py-1">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center py-4 text-gray-500">
                    No analysis data found
                  </td>
                </tr>
              ) : (
                filteredAndSortedData.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border px-2 py-1 text-center">{item.ready_no}</td>
                    <td className="border px-2 py-1 text-center">{item.tanggal}</td>
                    <td className="border px-2 py-1 font-medium">{item.product}</td>
                    <td className="border px-2 py-1 text-center">{item.unit_kecil}</td>
                    <td className="border px-2 py-1">{item.cabang}</td>
                    <td className="border px-2 py-1 text-center">{item.ready.toFixed(2)}</td>
                    <td className="border px-2 py-1 text-center">{item.gudang.toFixed(2)}</td>
                    <td className="border px-2 py-1 text-center">{item.barang_masuk.toFixed(2)}</td>
                    <td className="border px-2 py-1 text-center">{item.waste.toFixed(2)}</td>
                    <td className="border px-2 py-1 text-center font-medium">{item.total_barang.toFixed(2)}</td>
                    <td className="border px-2 py-1">{item.sub_category}</td>
                    <td className="border px-2 py-1 text-center">{item.keluar_form.toFixed(2)}</td>
                    <td className="border px-2 py-1 text-center">{item.hasil_esb.toFixed(2)}</td>
                    <td className={`border px-2 py-1 text-center font-medium ${
                      item.selisih > 0 ? 'text-green-600' : item.selisih < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {item.selisih.toFixed(2)}
                    </td>
                    <td className="border px-2 py-1 text-center">{item.total_production.toFixed(2)}</td>
                    <td className="border px-2 py-1 text-center">{item.sumif_total.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}