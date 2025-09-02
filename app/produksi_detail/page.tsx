'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Download, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';

interface ProduksiDetail {
  id: number;
  production_no: string;
  tanggal_input: string;
  product_id: number;
  item_id: number;
  jumlah_buat: number;
  gramasi: number;
  total_pakai: number;
  id_product: number;
  produksi_id: number;
  product_name?: string;
  item_name?: string;
}



export default function ProduksiDetailPage() {
  const router = useRouter();
  const [details, setDetails] = useState<ProduksiDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateProgress, setRecalculateProgress] = useState(0);
  const [recalculateTotal, setRecalculateTotal] = useState(0);

  useEffect(() => {
    fetchDetails();
    
    // Check for search parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, []);



  const fetchDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('produksi_detail')
        .select('*')
        .order('tanggal_input', { ascending: false });

      if (error) throw error;
      
      const detailsWithNames = await Promise.all(
        (data || []).map(async (detail: any) => {
          const [productData, itemData] = await Promise.all([
            supabase
              .from('nama_product')
              .select('product_name')
              .eq('id_product', detail.id_product)
              .single(),
            supabase
              .from('nama_product')
              .select('product_name')
              .eq('id_product', detail.item_id)
              .single()
          ]);
          
          return {
            ...detail,
            product_name: productData.data?.product_name || '',
            item_name: itemData.data?.product_name || ''
          };
        })
      );
      
      setDetails(detailsWithNames);
    } catch (error) {
      console.error('Error fetching details:', error);
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
        product_id: produksi.id_product,
        item_id: recipe.item_id,
        jumlah_buat: produksi.jumlah_buat,
        gramasi: recipe.gramasi,
        total_pakai: produksi.jumlah_buat * recipe.gramasi,
        id_product: produksi.id_product,
        produksi_id: produksiId
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
      
      return matchesSearch && matchesDate && matchesProduct;
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
      <div className="p-2 bg-gray-50 min-h-screen">
        <div className="bg-white p-2 rounded-lg shadow text-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mb-1 mx-auto"></div>
          <p className="text-xs text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-1 md:p-2">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-sm font-bold text-gray-800">🏭 Production Details</h1>
      </div>

      <div className="bg-white p-1 rounded-lg shadow mb-1">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-1 mb-2">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border px-2 py-1 rounded-md text-xs"
          />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border px-2 py-1 rounded-md text-xs"
          />
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="border px-2 py-1 rounded-md text-xs"
          >
            <option value="">All Products</option>
            {uniqueProducts.map(product => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <button 
              onClick={recalculateAllDetails} 
              disabled={isRecalculating}
              className="bg-orange-600 text-white px-2 py-1 rounded-md text-xs disabled:opacity-50"
            >
              {isRecalculating ? 'Processing...' : 'Recalculate'}
            </button>
            <button onClick={handleExport} className="bg-green-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
              <Download size={12} />Export
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isRecalculating && (
        <div className="bg-white p-2 rounded-lg shadow mb-1">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
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
          </div>
        </div>
      )}

      {/* Production Details Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('production_no')}>
                  Production No {sortConfig?.key === 'production_no' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal_input')}>
                  Date {sortConfig?.key === 'tanggal_input' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product_name')}>
                  Product {sortConfig?.key === 'product_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('item_name')}>
                  Item {sortConfig?.key === 'item_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('jumlah_buat')}>
                  Qty {sortConfig?.key === 'jumlah_buat' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('gramasi')}>
                  Gramasi {sortConfig?.key === 'gramasi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('total_pakai')}>
                  Total {sortConfig?.key === 'total_pakai' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedDetails.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-1 py-2 text-center text-gray-500 text-xs">
                    No data found
                  </td>
                </tr>
              ) : (
                paginatedDetails.map((detail) => (
                  <tr key={detail.id} className="hover:bg-gray-50">
                    <td className="px-1 py-1 font-medium text-blue-600">{detail.production_no}</td>
                    <td className="px-1 py-1">{detail.tanggal_input}</td>
                    <td className="px-1 py-1">{detail.product_name}</td>
                    <td className="px-1 py-1">{detail.item_name}</td>
                    <td className="px-1 py-1">{detail.jumlah_buat}</td>
                    <td className="px-1 py-1">{detail.gramasi}</td>
                    <td className="px-1 py-1 font-medium">{detail.total_pakai}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white p-1 rounded-lg shadow mt-1">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredAndSortedDetails.length)} of {filteredAndSortedDetails.length} records
            </p>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-200 text-xs"
              >
                Previous
              </button>
              <span className="px-2 py-1 text-xs">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 text-xs"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
}