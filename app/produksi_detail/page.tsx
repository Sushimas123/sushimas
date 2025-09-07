'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Download, ArrowUpDown, Settings, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import PageAccessControl from '../../components/PageAccessControl';

interface ProduksiDetail {
  id: number;
  production_no: string;
  tanggal_input: string;
  item_id: number;
  jumlah_buat: number;
  gramasi: number;
  total_pakai: number;
  id_product: number;
  produksi_id: number;
  branch?: string;
  product_name?: string;
  item_name?: string;
  branch_name?: string;
}



export default function ProduksiDetailPage() {
  const router = useRouter();
  const [details, setDetails] = useState<ProduksiDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [branches, setBranches] = useState<{kode_branch: string, nama_branch: string}[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateProgress, setRecalculateProgress] = useState(0);
  const [recalculateTotal, setRecalculateTotal] = useState(0);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>('guest');

  useEffect(() => {
    fetchDetails();
    fetchBranches();
    
    // Get user role
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role || 'guest');
    }
    
    // Check for search parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, []);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('kode_branch, nama_branch')
        .order('nama_branch');
      
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };



  const fetchDetails = async () => {
    try {
      // Fetch all data using pagination
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('produksi_detail')
          .select('*')
          .order('tanggal_input', { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      const data = allData;
      
      if (!allData || allData.length === 0) {
        setDetails([]);
        return;
      }
      
      // Get all unique product IDs with null checks
      const allProductIds = [...new Set([
        ...allData.filter(d => d.id_product).map(d => d.id_product),
        ...allData.filter(d => d.item_id).map(d => d.item_id)
      ])].filter(Boolean);
      
      if (allProductIds.length === 0) {
        setDetails(allData.map(detail => ({
          ...detail,
          product_name: '',
          item_name: ''
        })));
        return;
      }
      
      // Batch fetch all product names and branch data
      const [productResult, branchResult] = await Promise.all([
        supabase
          .from('nama_product')
          .select('id_product, product_name')
          .in('id_product', allProductIds),
        supabase
          .from('branches')
          .select('kode_branch, nama_branch')
      ]);
      
      if (productResult.error) {
        console.error('Error fetching product names:', productResult.error);
      }
      
      if (branchResult.error) {
        console.error('Error fetching branches:', branchResult.error);
      }
      
      // Create lookup maps
      const productMap = new Map(productResult.data?.map(p => [p.id_product, p.product_name]) || []);
      const branchMap = new Map(branchResult.data?.map(b => [b.kode_branch, b.nama_branch]) || []);
      
      // Map details with product names and branch names
      const detailsWithNames = allData.map(detail => ({
        ...detail,
        product_name: productMap.get(detail.id_product) || '',
        item_name: productMap.get(detail.item_id) || '',
        branch_name: branchMap.get(detail.branch) || detail.branch || ''
      }));
      
      setDetails(detailsWithNames);
    } catch (error) {
      console.error('Error fetching details:', error);
      setDetails([]);
    } finally {
      setLoading(false);
    }
  };

  const generateProductionDetails = async (produksiId: number) => {
    try {
      console.log('Generating details for produksi ID:', produksiId);
      
      // Get production data
      const { data: produksi, error: produksiError } = await supabase
        .from('produksi')
        .select('*')
        .eq('id', produksiId)
        .single();

      if (produksiError) {
        console.error('Error fetching produksi:', produksiError);
        throw produksiError;
      }
      
      if (!produksi) {
        throw new Error('Production record not found');
      }
      
      console.log('Production data:', produksi);

      // Check if details already exist
      const { data: existingDetails } = await supabase
        .from('produksi_detail')
        .select('id')
        .eq('produksi_id', produksiId);

      if (existingDetails && existingDetails.length > 0) {
        // Delete existing details automatically
        const { error: deleteError } = await supabase
          .from('produksi_detail')
          .delete()
          .eq('produksi_id', produksiId);
        
        if (deleteError) {
          console.error('Error deleting existing details:', deleteError);
          throw deleteError;
        }
      }

      // Get recipe for this product
      const { data: recipes, error: recipeError } = await supabase
        .from('recipes')
        .select('item_id, gramasi')
        .eq('id_product', produksi.id_product);

      if (recipeError) {
        console.error('Error fetching recipes:', recipeError);
        alert('Error accessing recipes table. Please check database schema.');
        return;
      }
      
      if (!recipes || recipes.length === 0) {
        alert(`No recipes found for product ID: ${produksi.id_product}. Please add recipes for this product first.`);
        return;
      }
      
      console.log('Found recipes:', recipes);

      // Calculate details for each recipe item
      const detailsToInsert = recipes.map((recipe: any) => ({
        production_no: produksi.production_no,
        tanggal_input: produksi.tanggal_input,
        item_id: recipe.item_id,
        jumlah_buat: produksi.jumlah_buat,
        gramasi: recipe.gramasi,
        total_pakai: produksi.jumlah_buat * recipe.gramasi,
        id_product: produksi.id_product,
        produksi_id: produksiId,
        branch: produksi.branch
      }));
      
      console.log('Details to insert:', detailsToInsert);

      // Insert details
      const { error: insertError } = await supabase
        .from('produksi_detail')
        .insert(detailsToInsert);

      if (insertError) {
        console.error('Error inserting details:', insertError);
        throw insertError;
      }

      await fetchDetails();
    } catch (error) {
      console.error('Error generating details:', error);
      alert(`Failed to generate production details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };



  const recalculateAllDetails = async () => {
    setIsRecalculating(true);
    setRecalculateProgress(0);
    
    try {
      // Get all production records that have details
      const { data: allProduksi } = await supabase
        .from('produksi')
        .select('id');

      if (!allProduksi) {
        setIsRecalculating(false);
        return;
      }

      const produksiWithDetails = [];
      for (const produksi of allProduksi) {
        const { data: hasDetails } = await supabase
          .from('produksi_detail')
          .select('id')
          .eq('produksi_id', produksi.id)
          .limit(1);

        if (hasDetails && hasDetails.length > 0) {
          produksiWithDetails.push(produksi);
        }
      }

      setRecalculateTotal(produksiWithDetails.length);

      for (let i = 0; i < produksiWithDetails.length; i++) {
        await generateProductionDetails(produksiWithDetails[i].id);
        setRecalculateProgress(i + 1);
      }
      
      // Recalculation completed silently
    } catch (error) {
      console.error('Error recalculating:', error);
      alert('Failed to recalculate details');
    } finally {
      setIsRecalculating(false);
      setRecalculateProgress(0);
      setRecalculateTotal(0);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedDetails = (() => {
    let filtered = details.filter(detail => {
      const matchesSearch = detail.production_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (detail.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (detail.item_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = !dateFilter || detail.tanggal_input.includes(dateFilter);
      const matchesProduct = !productFilter || (detail.product_name || '').toLowerCase().includes(productFilter.toLowerCase());
      const matchesBranch = !branchFilter || detail.branch === branchFilter || (detail.branch_name || '').toLowerCase().includes(branchFilter.toLowerCase());
      
      return matchesSearch && matchesDate && matchesProduct && matchesBranch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key as keyof ProduksiDetail];
        let bValue = b[sortConfig.key as keyof ProduksiDetail];
        
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
  })();

  const totalPages = Math.ceil(filteredAndSortedDetails.length / itemsPerPage);
  const paginatedDetails = filteredAndSortedDetails.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueProducts = [...new Set(details.map(d => d.product_name).filter(Boolean))];

  const handleExport = () => {
    if (details.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(details.map(d => ({
      production_no: d.production_no,
      tanggal_input: d.tanggal_input,
      product_name: d.product_name,
      item_name: d.item_name,
      jumlah_buat: d.jumlah_buat,
      gramasi: d.gramasi,
      total_pakai: d.total_pakai
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Production Details");
    XLSX.writeFile(wb, `production_details_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-2 bg-gray-50 min-h-screen">
          <div className="bg-white p-2 rounded-lg shadow text-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mb-1 mx-auto"></div>
            <p className="text-xs text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageAccessControl pageName="produksi_detail">
        <div className="p-2">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-gray-800">🏭 Production Details</h1>
          <div className="flex gap-2">

            <button 
              onClick={recalculateAllDetails} 
              disabled={isRecalculating}
              className="bg-orange-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
            >
              {isRecalculating ? 'Processing...' : 'Recalculate'}
            </button>
            {(userRole === 'super admin' || userRole === 'admin') && (
              <button onClick={handleExport} className="bg-green-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1">
                <Download size={12} />Export
              </button>
            )}
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="bg-purple-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1"
            >
              <Settings size={12} />
              {showColumnSelector ? 'Hide Columns' : 'Show Columns'}
            </button>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg shadow mb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="border px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Products</option>
              {uniqueProducts.map(product => (
                <option key={product} value={product}>{product}</option>
              ))}
            </select>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="border px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch.kode_branch} value={branch.kode_branch}>{branch.nama_branch}</option>
              ))}
            </select>
          </div>
        </div>

        {isRecalculating && (
          <div className="bg-white p-3 rounded-lg shadow mb-3">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Recalculating production details...</span>
              <span>{recalculateProgress}/{recalculateTotal}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${recalculateTotal > 0 ? (recalculateProgress / recalculateTotal) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Column Selector */}
        {showColumnSelector && paginatedDetails.length > 0 && (
          <div className="bg-white p-3 rounded-lg shadow mb-3">
            <h3 className="font-medium text-gray-800 mb-3 text-sm">Column Visibility Settings</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
              {['production_no', 'tanggal_input', 'product_name', 'branch', 'item_name', 'jumlah_buat', 'gramasi', 'total_pakai'].map(col => (
                <label key={col} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.includes(col)}
                    onChange={() => {
                      setHiddenColumns(prev => 
                        prev.includes(col) 
                          ? prev.filter(c => c !== col)
                          : [...prev, col]
                      );
                    }}
                    className="rounded text-blue-600"
                  />
                  <span className={hiddenColumns.includes(col) ? 'text-gray-500' : 'text-gray-800'}>
                    {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setHiddenColumns([])}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-1"
              >
                <Eye size={14} />
                Show All
              </button>
              <button
                onClick={() => setHiddenColumns(['production_no', 'tanggal_input', 'product_name', 'branch', 'item_name', 'jumlah_buat', 'gramasi', 'total_pakai'])}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1"
              >
                <EyeOff size={14} />
                Hide All
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {!hiddenColumns.includes('production_no') && <th className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('production_no')}>
                    Production No {sortConfig?.key === 'production_no' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('tanggal_input') && <th className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tanggal_input')}>
                    Date {sortConfig?.key === 'tanggal_input' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('product_name') && <th className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('product_name')}>
                    Product {sortConfig?.key === 'product_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('branch') && <th className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('cabang')}>
                    Branch {sortConfig?.key === 'cabang' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('item_name') && <th className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('item_name')}>
                    Item {sortConfig?.key === 'item_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('jumlah_buat') && <th className="px-3 py-2 text-center font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('jumlah_buat')}>
                    Qty {sortConfig?.key === 'jumlah_buat' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('gramasi') && <th className="px-3 py-2 text-center font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('gramasi')}>
                    Gramasi {sortConfig?.key === 'gramasi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('total_pakai') && <th className="px-3 py-2 text-center font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total_pakai')}>
                    Total {sortConfig?.key === 'total_pakai' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedDetails.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                      No data found
                    </td>
                  </tr>
                ) : (
                  paginatedDetails.map((detail) => (
                    <tr key={detail.id} className="hover:bg-gray-50">
                      {!hiddenColumns.includes('production_no') && <td className="px-3 py-2 font-medium text-blue-600">{detail.production_no}</td>}
                      {!hiddenColumns.includes('tanggal_input') && <td className="px-3 py-2 text-gray-700">{detail.tanggal_input}</td>}
                      {!hiddenColumns.includes('product_name') && <td className="px-3 py-2 text-gray-700">{detail.product_name}</td>}
                      {!hiddenColumns.includes('branch') && <td className="px-3 py-2 text-gray-700">{detail.branch_name || detail.branch}</td>}
                      {!hiddenColumns.includes('item_name') && <td className="px-3 py-2 text-gray-700">{detail.item_name}</td>}
                      {!hiddenColumns.includes('jumlah_buat') && <td className="px-3 py-2 text-center text-gray-700">{detail.jumlah_buat}</td>}
                      {!hiddenColumns.includes('gramasi') && <td className="px-3 py-2 text-center text-gray-700">{detail.gramasi}</td>}
                      {!hiddenColumns.includes('total_pakai') && <td className="px-3 py-2 text-center font-medium text-gray-900">{detail.total_pakai}</td>}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="bg-white p-3 rounded-lg shadow mt-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredAndSortedDetails.length)} of {filteredAndSortedDetails.length} records
              </p>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-200 text-sm"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm bg-blue-50 rounded">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </PageAccessControl>
    </Layout>
  );
}