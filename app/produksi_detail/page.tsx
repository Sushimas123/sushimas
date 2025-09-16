'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Download } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
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



function ProduksiDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const [userRole, setUserRole] = useState<string>('guest');
  const [allowedBranches, setAllowedBranches] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const init = async () => {
      await initializeUserData();
    };
    init();
    
    // Check for search parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchBranches();
      fetchDetails();
    }
  }, [userRole, allowedBranches]);

  // Handle URL parameters from Analysis page
  useEffect(() => {
    const date = searchParams.get('date');
    const branch = searchParams.get('branch');
    const product = searchParams.get('product');
    
    if (date || branch || product) {
      if (date) setDateFilter(date);
      if (branch) setBranchFilter(branch);
      if (product) setProductFilter(product);
      
      showToast(`Filtered by: ${[date, branch, product].filter(Boolean).join(', ')}`, 'success');
    }
  }, [searchParams]);

  const initializeUserData = async () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role || 'guest');
      
      if (user.role === 'super admin' || user.role === 'admin') {
        setAllowedBranches([]);
      } else {
        if (user.id_user) {
          const { data: userBranches, error } = await supabase
            .from('user_branches')
            .select('kode_branch')
            .eq('id_user', user.id_user)
            .eq('is_active', true);
          
          if (error) {
            console.error('Error fetching user branches:', error);
          }
          
          if (userBranches && userBranches.length > 0) {
            const branchCodes = userBranches.map(ub => ub.kode_branch);
            setAllowedBranches(branchCodes);
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
      let branchQuery = supabase
        .from('branches')
        .select('kode_branch, nama_branch')
        .order('nama_branch');
      
      // Filter branches for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranches.length > 0) {
        // Convert branch codes to branch names for dropdown filtering
        const { data: allowedBranchNames } = await supabase
          .from('branches')
          .select('nama_branch')
          .in('kode_branch', allowedBranches);
        
        if (allowedBranchNames && allowedBranchNames.length > 0) {
          const namaBranches = allowedBranchNames.map(b => b.nama_branch);
          branchQuery = branchQuery.in('nama_branch', namaBranches);
        }
      }
      
      const { data, error } = await branchQuery;
      
      if (error) throw error;
      
      // Remove duplicates based on kode_branch
      const uniqueBranches = (data || []).filter((branch, index, self) => 
        index === self.findIndex(b => b.kode_branch === branch.kode_branch)
      );
      
      setBranches(uniqueBranches);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };



  const fetchDetails = async () => {
    try {
      // Fetch limited data to prevent memory leak
      let query = supabase
        .from('produksi_detail')
        .select('*')
        .order('tanggal_input', { ascending: false })
        .limit(5000); // Reasonable limit to prevent memory issues
      
      // Filter by user's allowed branches for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranches.length > 0) {
        // Convert branch codes to branch names for filtering
        const { data: branchNames } = await supabase
          .from('branches')
          .select('nama_branch')
          .in('kode_branch', allowedBranches);
        
        if (branchNames && branchNames.length > 0) {
          const namaBranches = branchNames.map(b => b.nama_branch);
          query = query.in('branch', namaBranches);
        }
      }
      
      const { data: allData, error } = await query;

      if (error) throw error;
      
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
      
      // Create lookup maps with proper fallbacks
      const productMap = new Map(productResult.data?.map(p => [p.id_product, p.product_name]) || []);
      const branchMap = new Map(branchResult.data?.map(b => [b.kode_branch, b.nama_branch]) || []);
      
      // Map details with product names and branch names
      const detailsWithNames = allData.map(detail => ({
        ...detail,
        product_name: productMap.get(detail.id_product) || 'Unknown Product',
        item_name: productMap.get(detail.item_id) || 'Unknown Item',
        branch_name: branchMap.get(detail.branch) || detail.branch || 'Unknown Branch'
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
        showToast('❌ Error accessing recipes table', 'error');
        return;
      }
      
      if (!recipes || recipes.length === 0) {
        showToast(`❌ No recipes found for product ID: ${produksi.id_product}`, 'error');
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
      showToast('✅ Production details generated successfully', 'success');
    } catch (error) {
      console.error('Error generating details:', error);
      showToast(`❌ Failed to generate production details: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
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
      
      showToast('✅ All production details recalculated successfully', 'success');
    } catch (error) {
      console.error('Error recalculating:', error);
      showToast('❌ Failed to recalculate details', 'error');
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
      const matchesProduct = !productFilter || (detail.product_name || '').toLowerCase().includes(productFilter.toLowerCase()) || (detail.item_name || '').toLowerCase().includes(productFilter.toLowerCase());
      const matchesBranch = !branchFilter || detail.branch === branchFilter || (detail.branch_name || '').toLowerCase().includes(branchFilter.toLowerCase()) || (detail.branch_name || '') === branchFilter;
      
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
        <div className="p-2">
        {toast && (
          <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {toast.message}
          </div>
        )}
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
              <option value="">{userRole === 'super admin' || userRole === 'admin' ? 'All Branches' : 'All My Branches'}</option>
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



        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 max-w-[80px]" onClick={() => handleSort('production_no')}>
                    Prod No {sortConfig?.key === 'production_no' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 w-16" onClick={() => handleSort('tanggal_input')}>
                    Date {sortConfig?.key === 'tanggal_input' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 max-w-[100px]" onClick={() => handleSort('product_name')}>
                    Product {sortConfig?.key === 'product_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 max-w-[60px]" onClick={() => handleSort('cabang')}>
                    Branch {sortConfig?.key === 'cabang' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 max-w-[100px]" onClick={() => handleSort('item_name')}>
                    Item {sortConfig?.key === 'item_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-1 py-1 text-center font-medium text-gray-700 cursor-pointer hover:bg-gray-100 w-12" onClick={() => handleSort('jumlah_buat')}>
                    Qty {sortConfig?.key === 'jumlah_buat' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-1 py-1 text-center font-medium text-gray-700 cursor-pointer hover:bg-gray-100 w-12" onClick={() => handleSort('gramasi')}>
                    Gram {sortConfig?.key === 'gramasi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-1 py-1 text-center font-medium text-gray-700 cursor-pointer hover:bg-gray-100 w-16" onClick={() => handleSort('total_pakai')}>
                    Total {sortConfig?.key === 'total_pakai' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedDetails.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-1 py-2 text-center text-gray-500 text-xs">
                      No data found
                    </td>
                  </tr>
                ) : (
                  paginatedDetails.map((detail) => (
                    <tr key={detail.id} className="hover:bg-gray-50">
                      <td className="px-1 py-1 font-medium text-blue-600 text-xs truncate max-w-[80px]">{detail.production_no}</td>
                      <td className="px-3 py-2 text-gray-700">{detail.tanggal_input}</td>
                      <td className="px-1 py-1 text-gray-700 text-xs truncate max-w-[100px]">{detail.product_name}</td>
                      <td className="px-1 py-1 text-gray-700 text-xs truncate max-w-[60px]">{detail.branch_name || detail.branch}</td>
                      <td className="px-1 py-1 text-gray-700 text-xs truncate max-w-[100px]">{detail.item_name}</td>
                      <td className="px-1 py-1 text-center text-gray-700 text-xs">{detail.jumlah_buat}</td>
                      <td className="px-1 py-1 text-center text-gray-700 text-xs">{detail.gramasi}</td>
                      <td className="px-1 py-1 text-center font-medium text-gray-900 text-xs">{detail.total_pakai}</td>
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
  );
}

export default function ProduksiDetailPage() {
  return (
    <Layout>
      <Suspense fallback={<div className="p-4">Loading...</div>}>
        <ProduksiDetailPageContent />
      </Suspense>
    </Layout>
  );
}