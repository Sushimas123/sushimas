'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2, Download, Upload, RefreshCw, Settings, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import { canPerformActionSync, getUserRole } from '@/src/utils/rolePermissions';
import { insertWithAudit, updateWithAudit, deleteWithAudit } from '@/src/utils/auditTrail';
import PageAccessControl from '../../components/PageAccessControl';

interface Produksi {
  id: number;
  production_no: string;
  tanggal_input: string;
  id_product: number;
  divisi: string;
  branch: string;
  jumlah_buat: number;
  konversi: number;
  total_konversi: number;
  product_name?: string;
}

interface Product {
  id_product: number;
  product_name: string;
  sub_category: string;
  satuan_besar: number | null;
}

export default function ProduksiPage() {
  const router = useRouter();
  const [produksi, setProduksi] = useState<Produksi[]>([]);
  const [wipProducts, setWipProducts] = useState<Product[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [divisiFilter, setDivisiFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    production_no: '',
    tanggal_input: new Date().toISOString().split('T')[0],
    id_product: 0,
    divisi: '',
    branch: '',
    jumlah_buat: '',
    konversi: ''
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>('guest');

  useEffect(() => {
    fetchProduksi();
    fetchWipProducts();
    fetchSubCategories();
    fetchBranches();
    
    // Get user role
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role || 'guest');
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateProductionNo = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const time = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PRD${year}${month}${day}${time}${random}`;
  };

  const fetchProduksi = async () => {
    try {
      const [produksiData, productsData] = await Promise.all([
        supabase.from('produksi').select('*').order('tanggal_input', { ascending: false }),
        supabase.from('nama_product').select('id_product, product_name')
      ]);

      if (produksiData.error) throw produksiData.error;
      
      const productMap = new Map(productsData.data?.map(p => [p.id_product, p.product_name]) || []);
      
      const produksiWithNames = (produksiData.data || []).map((item: any) => ({
        ...item,
        product_name: productMap.get(item.id_product) || ''
      }));
      
      setProduksi(produksiWithNames);
    } catch (error) {
      console.error('Error fetching produksi:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWipProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('nama_product')
        .select('id_product, product_name, sub_category, satuan_besar')
        .eq('category', 'WIP')
        .order('product_name');
      
      if (error) throw error;
      setWipProducts(data || []);
    } catch (error) {
      console.error('Error fetching WIP products:', error);
    }
  };

  const fetchSubCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('nama_product')
        .select('sub_category')
        .eq('category', 'WIP')
        .not('sub_category', 'is', null);
      
      if (error) throw error;
      
      const uniqueSubCategories = [...new Set(data?.map(item => item.sub_category).filter(Boolean))] as string[];
      setSubCategories(uniqueSubCategories);
    } catch (error) {
      console.error('Error fetching sub categories:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('nama_branch')
        .eq('is_active', true)
        .order('nama_branch');
      
      if (error) throw error;
      setBranches(data?.map(b => b.nama_branch) || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.production_no.trim() || !formData.divisi.trim() || !formData.branch.trim()) {
      alert('Production No, Divisi, dan Branch wajib diisi');
      return;
    }

    const jumlahBuat = parseFloat(formData.jumlah_buat as string) || 0;
    const konversi = parseFloat(formData.konversi as string) || 0;
    
    const submitData = {
      production_no: formData.production_no,
      tanggal_input: formData.tanggal_input,
      id_product: formData.id_product,
      divisi: formData.divisi,
      branch: formData.branch,
      jumlah_buat: jumlahBuat,
      konversi: konversi,
    };

    try {
      if (editingId) {
        await updateWithAudit('produksi', submitData, { id: editingId });
        alert('Produksi berhasil diupdate!');
      } else {
        await insertWithAudit('produksi', submitData);
        alert('Produksi berhasil ditambahkan!');
      }

      resetForm();
      await fetchProduksi();
    } catch (error) {
      console.error('Error saving produksi:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Gagal menyimpan produksi: ${errorMessage}`);
    }
  };

  const resetForm = () => {
    setFormData({
      production_no: '',
      tanggal_input: new Date().toISOString().split('T')[0],
      id_product: 0,
      divisi: '',
      branch: '',
      jumlah_buat: '',
      konversi: ''
    });
    setProductSearch('');
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleEdit = (item: Produksi) => {
    setFormData({
      production_no: item.production_no,
      tanggal_input: item.tanggal_input,
      id_product: item.id_product,
      divisi: item.divisi,
      branch: item.branch,
      jumlah_buat: item.jumlah_buat.toString(),
      konversi: item.konversi.toString()
    });
    setProductSearch(item.product_name || '');
    setEditingId(item.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus produksi ini?')) return;
    try {
      await deleteWithAudit('produksi', { id });
      await fetchProduksi();
      alert('Produksi berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting produksi:', error);
      alert('Gagal menghapus produksi');
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === paginatedProduksi.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedProduksi.map(item => item.id));
    }
  };

  const handleSelectItem = (id: number) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!confirm(`Hapus ${selectedItems.length} produksi yang dipilih?`)) return;
    
    try {
      for (const id of selectedItems) {
        await deleteWithAudit('produksi', { id });
      }
      
      setSelectedItems([]);
      await fetchProduksi();
      alert(`${selectedItems.length} produksi berhasil dihapus!`);
    } catch (error) {
      console.error('Error bulk deleting:', error);
      alert('Gagal menghapus produksi');
    }
  };

  const handleDivisiChange = (divisi: string) => {
    setFormData(prev => ({ ...prev, divisi, id_product: 0, konversi: '' }));
    setProductSearch('');
  };

  const handleProductSelect = (product: Product) => {
    setFormData(prev => ({ 
      ...prev, 
      id_product: product.id_product,
      konversi: product.satuan_besar ? product.satuan_besar.toString() : '1'
    }));
    setProductSearch(product.product_name);
    setShowProductDropdown(false);
  };

  const filteredProducts = wipProducts.filter(p => {
    const matchesDivisi = !formData.divisi || p.sub_category === formData.divisi;
    const matchesSearch = p.product_name.toLowerCase().includes(productSearch.toLowerCase());
    return matchesDivisi && matchesSearch;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedProduksi = (() => {
    let filtered = produksi.filter(item => {
      const matchesSearch = item.production_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.divisi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.product_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = !dateFilter || item.tanggal_input.includes(dateFilter);
      const matchesDivisi = !divisiFilter || item.divisi.toLowerCase().includes(divisiFilter.toLowerCase());
      const matchesBranch = !branchFilter || item.branch === branchFilter;
      
      return matchesSearch && matchesDate && matchesDivisi && matchesBranch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key as keyof Produksi];
        let bValue = b[sortConfig.key as keyof Produksi];
        
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

  const totalPages = Math.ceil(filteredAndSortedProduksi.length / itemsPerPage);
  const paginatedProduksi = filteredAndSortedProduksi.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueDivisi = [...new Set(produksi.map(p => p.divisi).filter(Boolean))];

  const handleExport = () => {
    if (produksi.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(produksi.map(p => ({
      production_no: p.production_no,
      tanggal_input: p.tanggal_input,
      product_name: p.product_name,
      divisi: p.divisi,
      branch: p.branch,
      jumlah_buat: p.jumlah_buat,
      konversi: p.konversi,
      total_konversi: p.total_konversi
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produksi");
    XLSX.writeFile(wb, `produksi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      let importCount = 0;
      let duplicateCount = 0;
      
      for (const row of jsonData as any[]) {
        const productName = row['product_name']?.toString().trim();
        const divisi = row['divisi']?.toString().trim();
        const branch = row['branch']?.toString().trim() || '';
        const jumlahBuat = parseFloat(row['jumlah_buat']) || 0;
        let tanggalInput = row['tanggal_input'];
        
        // Convert Excel date if needed
        if (typeof tanggalInput === 'number') {
          const excelEpoch = new Date(1900, 0, 1);
          const date = new Date(excelEpoch.getTime() + (tanggalInput - 2) * 24 * 60 * 60 * 1000);
          tanggalInput = date.toISOString().split('T')[0];
        } else if (tanggalInput) {
          tanggalInput = tanggalInput.toString().trim();
        }
        
        if (!productName || !divisi || !tanggalInput || jumlahBuat <= 0 || !branch) continue;
        
        // Find product
        const product = wipProducts.find(p => 
          p.product_name.toLowerCase() === productName.toLowerCase() && 
          p.sub_category === divisi
        );
        
        if (!product) continue;
        
        // Check for duplicates
        const { data: existing } = await supabase
          .from('produksi')
          .select('id')
          .eq('id_product', product.id_product)
          .eq('tanggal_input', tanggalInput)
          .eq('divisi', divisi)
          .eq('branch', branch)
          .eq('jumlah_buat', jumlahBuat)
          .single();
        
        if (existing) {
          duplicateCount++;
          continue;
        }
        
        // Insert new record
        await insertWithAudit('produksi', {
          production_no: generateProductionNo(),
          tanggal_input: tanggalInput,
          id_product: product.id_product,
          divisi: divisi,
          branch: branch,
          jumlah_buat: jumlahBuat,
          konversi: product.satuan_besar || 1,
          total_konversi: jumlahBuat * (product.satuan_besar || 1)
        });
        
        importCount++;
      }
      
      let message = `✅ Imported ${importCount} production records`;
      if (duplicateCount > 0) {
        message += ` (${duplicateCount} duplicates skipped)`;
      }
      alert(message);
      
      if (importCount > 0) {
        await fetchProduksi();
      }
      
    } catch (error) {
      console.error('Import error:', error);
      alert('❌ Failed to import Excel file');
    }
    
    e.target.value = '';
  };

  const recalculateAllTotals = async () => {
    try {
      // Get all production records
      const { data: allRecords, error } = await supabase
        .from('produksi')
        .select('id, jumlah_buat, konversi');
      
      if (error) throw error;
      
      // Update total_konversi for each record
      for (const record of allRecords || []) {
        const totalKonversi = record.jumlah_buat * record.konversi;
        
        await supabase
          .from('produksi')
          .update({ total_konversi: totalKonversi })
          .eq('id', record.id);
      }
      
      alert('✅ All totals recalculated successfully');
      await fetchProduksi();
      
    } catch (error) {
      console.error('Recalculate error:', error);
      alert('❌ Failed to recalculate totals');
    }
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
      <PageAccessControl pageName="produksi">
        <div className="p-1 md:p-2">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-sm font-bold text-gray-800">🏭 Production</h1>
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
              value={divisiFilter}
              onChange={(e) => setDivisiFilter(e.target.value)}
              className="border px-2 py-1 rounded-md text-xs"
            >
              <option value="">All Divisi</option>
              {uniqueDivisi.map(divisi => (
                <option key={divisi} value={divisi}>{divisi}</option>
              ))}
            </select>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="border px-2 py-1 rounded-md text-xs"
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1">
            <button onClick={recalculateAllTotals} className="bg-purple-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
              <RefreshCw size={12} />Recalculate
            </button>
            <button onClick={handleExport} className="bg-green-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
              <Download size={12} />Export
            </button>
            {canPerformActionSync(userRole, 'produksi', 'create') && (
              <label className="bg-orange-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1 cursor-pointer hover:bg-orange-700">
                <Upload size={12} />Import
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            )}
            {selectedItems.length > 0 && canPerformActionSync(userRole, 'produksi', 'delete') && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1"
              >
                <Trash2 size={12} />Delete ({selectedItems.length})
              </button>
            )}
            {canPerformActionSync(userRole, 'produksi', 'create') && (
              <button
                onClick={() => {
                  if (!showAddForm) {
                    setFormData(prev => ({ ...prev, production_no: generateProductionNo() }));
                  }
                  setShowAddForm(!showAddForm);
                }}
                className="bg-blue-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1"
              >
                <Plus size={12} />Add
              </button>
            )}
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="bg-purple-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Settings size={12} />
              {showColumnSelector ? 'Hide Columns' : 'Show Columns'}
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="bg-white p-1 rounded-lg shadow mb-1">
            <h3 className="font-medium text-gray-800 mb-2 text-xs">{editingId ? 'Edit' : 'Add'} Produksi</h3>
            <form onSubmit={handleSubmit} className="space-y-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                <input
                  type="text"
                  value={formData.production_no}
                  className="border px-2 py-1 rounded-md text-xs bg-gray-100"
                  placeholder="Production No *"
                  readOnly
                  required
                />
                <input
                  type="date"
                  value={formData.tanggal_input}
                  onChange={(e) => setFormData(prev => ({ ...prev, tanggal_input: e.target.value }))}
                  className="border px-2 py-1 rounded-md text-xs"
                  required
                />
                <select
                  value={formData.divisi}
                  onChange={(e) => handleDivisiChange(e.target.value)}
                  className="border px-2 py-1 rounded-md text-xs"
                  required
                >
                  <option value="">Select Divisi *</option>
                  {subCategories.map((subCat) => (
                    <option key={subCat} value={subCat}>{subCat}</option>
                  ))}
                </select>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}
                  className="border px-2 py-1 rounded-md text-xs"
                  required
                >
                  <option value="">Select Branch *</option>
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
                <div className="relative" ref={productDropdownRef}>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    className="border px-2 py-1 rounded-md text-xs w-full"
                    placeholder={formData.divisi ? `Search Product *` : "Select Divisi first"}
                    disabled={!formData.divisi}
                    required
                  />
                  {showProductDropdown && formData.divisi && (
                    <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg max-h-32 overflow-y-auto">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => (
                          <div
                            key={product.id_product}
                            onClick={() => handleProductSelect(product)}
                            className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs"
                          >
                            {product.product_name}
                          </div>
                        ))
                      ) : (
                        <div className="px-2 py-1 text-xs text-gray-500">
                          No products found for {formData.divisi}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.jumlah_buat}
                  onChange={(e) => setFormData(prev => ({ ...prev, jumlah_buat: e.target.value }))}
                  className="border px-2 py-1 rounded-md text-xs"
                  placeholder="Qty *"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  value={formData.konversi}
                  className="border px-2 py-1 rounded-md text-xs bg-gray-100"
                  placeholder="Konversi"
                  readOnly
                />
              </div>
              <div className="flex gap-1">
                <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded-md text-xs">
                  {editingId ? 'Update' : 'Save'}
                </button>
                <button type="button" onClick={resetForm} className="bg-gray-600 text-white px-3 py-1 rounded-md text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Column Selector */}
        {showColumnSelector && paginatedProduksi.length > 0 && (
          <div className="bg-white p-2 rounded-lg shadow mb-1">
            <h3 className="font-medium text-gray-800 mb-2 text-xs">Column Visibility Settings</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 mb-2">
              {Object.keys(paginatedProduksi[0]).filter(col => col !== 'id').map(col => (
                <label key={col} className="flex items-center gap-1 text-xs">
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
                    className="rounded text-blue-600 w-3 h-3"
                  />
                  <span className={hiddenColumns.includes(col) ? 'text-gray-500' : 'text-gray-800'}>
                    {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setHiddenColumns([])}
                className="px-2 py-1 bg-green-600 text-white rounded-md text-xs hover:bg-green-700 flex items-center gap-1"
              >
                <Eye size={10} />
                Show All
              </button>
              <button
                onClick={() => setHiddenColumns(Object.keys(paginatedProduksi[0]).filter(col => col !== 'id'))}
                className="px-2 py-1 bg-red-600 text-white rounded-md text-xs hover:bg-red-700 flex items-center gap-1"
              >
                <EyeOff size={10} />
                Hide All
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-1 py-1 text-center font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === paginatedProduksi.length && paginatedProduksi.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  {!hiddenColumns.includes('production_no') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('production_no')}>
                    Production No {sortConfig?.key === 'production_no' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('tanggal_input') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal_input')}>
                    Date {sortConfig?.key === 'tanggal_input' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('divisi') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('divisi')}>
                    Divisi {sortConfig?.key === 'divisi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('branch') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('branch')}>
                    Branch {sortConfig?.key === 'branch' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('product_name') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product_name')}>
                    Product {sortConfig?.key === 'product_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('jumlah_buat') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('jumlah_buat')}>
                    Qty {sortConfig?.key === 'jumlah_buat' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('konversi') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('konversi')}>
                    Konversi {sortConfig?.key === 'konversi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {!hiddenColumns.includes('total_konversi') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('total_konversi')}>
                    Total {sortConfig?.key === 'total_konversi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  <th className="px-1 py-1 text-left font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedProduksi.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-1 py-2 text-center text-gray-500 text-xs">
                      No data found
                    </td>
                  </tr>
                ) : (
                  paginatedProduksi.map((item) => (
                    <tr key={item.id} className={`hover:bg-gray-50 ${selectedItems.includes(item.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                          className="rounded"
                        />
                      </td>
                      {!hiddenColumns.includes('production_no') && <td className="px-1 py-1 font-medium">
                        <button
                          onClick={() => router.push(`/produksi_detail?search=${item.production_no}`)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {item.production_no}
                        </button>
                      </td>}
                      {!hiddenColumns.includes('tanggal_input') && <td className="px-1 py-1">{item.tanggal_input}</td>}
                      {!hiddenColumns.includes('divisi') && <td className="px-1 py-1">{item.divisi}</td>}
                      {!hiddenColumns.includes('branch') && <td className="px-1 py-1">{item.branch}</td>}
                      {!hiddenColumns.includes('product_name') && <td className="px-1 py-1">{item.product_name}</td>}
                      {!hiddenColumns.includes('jumlah_buat') && <td className="px-1 py-1">{item.jumlah_buat}</td>}
                      {!hiddenColumns.includes('konversi') && <td className="px-1 py-1">{item.konversi}</td>}
                      {!hiddenColumns.includes('total_konversi') && <td className="px-1 py-1 font-medium">{item.total_konversi}</td>}
                      <td className="px-1 py-1">
                        <div className="flex gap-1">
                          {canPerformActionSync(userRole, 'produksi', 'edit') && (
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                              title="Edit"
                            >
                              <Edit size={12} />
                            </button>
                          )}
                          {canPerformActionSync(userRole, 'produksi', 'delete') && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
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
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredAndSortedProduksi.length)} of {filteredAndSortedProduksi.length} records
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
      </PageAccessControl>
    </Layout>
  );
}