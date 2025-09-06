'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import { getBranchFilter, getAllowedBranches } from '@/src/utils/branchAccess';

interface Gudang {
  uniqueid_gudang: string;
  order_no: number;
  id_product: number;
  tanggal: string;
  jumlah_keluar: number;
  jumlah_masuk: number;
  total_gudang: number;
  nama_pengambil_barang: string;
  cabang: string;
  product_name?: string;
  branch_name?: string;
}

interface Product {
  id_product: number;
  product_name: string;
  category: string;
}

function GudangPageContent() {
  const router = useRouter();
  const [gudang, setGudang] = useState<Gudang[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    id_product: 0,
    tanggal: new Date().toISOString().split('T')[0],
    waktu: new Date().toTimeString().slice(0, 5),
    jumlah_keluar: '',
    jumlah_masuk: '',
    cabang: ''
  });
  const [userCabang, setUserCabang] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('user');
  const [cabangList, setCabangList] = useState<{id_branch: number, kode_branch: string, nama_branch: string}[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUserInfo();
    fetchCabang();
    fetchGudang();
    fetchProducts();
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

  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('cabang, role')
          .eq('id', user.id)
          .single();
        
        if (userData) {
          setUserCabang(userData.cabang || '');
          setUserRole(userData.role || 'user');
        }
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const fetchCabang = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id_branch, kode_branch, nama_branch')
        .eq('is_active', true)
        .order('nama_branch');
      
      if (error) throw error;
      // Filter branches based on user access
      const filteredBranches = getAllowedBranches(data || []);
      setCabangList(filteredBranches);
    } catch (error) {
      console.error('Error fetching cabang:', error);
    }
  };

  const fetchGudang = async () => {
    try {
      // Fetch all data in parallel
      const [gudangData, productsData, branchesData] = await Promise.all([
        supabase.from('gudang').select('*').order('tanggal', { ascending: false }),
        supabase.from('nama_product').select('id_product, product_name'),
        supabase.from('branches').select('kode_branch, nama_branch')
      ]);

      if (gudangData.error) throw gudangData.error;
      
      // Create lookup maps
      const productMap = new Map(productsData.data?.map(p => [p.id_product, p.product_name]) || []);
      const branchMap = new Map(branchesData.data?.map(b => [b.kode_branch, b.nama_branch]) || []);
      
      // Transform data using lookup maps
      let gudangWithNames = (gudangData.data || []).map((item: any) => ({
        ...item,
        product_name: productMap.get(item.id_product) || '',
        branch_name: branchMap.get(item.cabang) || item.cabang
      }));
      
      // Apply branch filter only for display
      const userBranchFilter = getBranchFilter();
      if (userBranchFilter) {
        gudangWithNames = gudangWithNames.filter(item => 
          item.branch_name === userBranchFilter || item.cabang === userBranchFilter
        );
      }
      
      setGudang(gudangWithNames);
    } catch (error) {
      console.error('Error fetching gudang:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('nama_product')
        .select('id_product, product_name, category')
        .order('product_name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const calculateTotalGudang = async (idProduct: number, tanggal: string) => {
    // Get the last total_gudang for this product before the current date
    const { data: lastRecord } = await supabase
      .from('gudang')
      .select('total_gudang')
      .eq('id_product', idProduct)
      .lt('tanggal', tanggal)
      .order('tanggal', { ascending: false })
      .order('order_no', { ascending: false })
      .limit(1);
    
    return lastRecord?.[0]?.total_gudang || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_product) return;

    setSaving(true);

    const jumlahMasuk = parseFloat(formData.jumlah_masuk as string) || 0;
    const jumlahKeluar = parseFloat(formData.jumlah_keluar as string) || 0;
    
    // Combine date and time into timestamp
    const timestamp = `${formData.tanggal}T${formData.waktu}:00.000Z`;
    
    // Get previous balance for this product and timestamp
    const previousBalance = await calculateTotalGudang(formData.id_product, timestamp);
    
    const submitData = {
      id_product: formData.id_product,
      tanggal: timestamp,
      jumlah_keluar: jumlahKeluar,
      jumlah_masuk: jumlahMasuk,
      total_gudang: previousBalance + jumlahMasuk - jumlahKeluar,
      nama_pengambil_barang: 'Current User',
      cabang: formData.cabang
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('gudang')
          .update(submitData)
          .eq('uniqueid_gudang', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('gudang')
          .insert([submitData]);
        if (error) throw error;
      }

      resetForm();
      await recalculateAffectedRecords(formData.id_product, timestamp);
      await fetchGudang();
    } catch (error) {
      console.error('Error saving gudang:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      id_product: 0,
      tanggal: new Date().toISOString().split('T')[0],
      waktu: new Date().toTimeString().slice(0, 5),
      jumlah_keluar: '',
      jumlah_masuk: '',
      cabang: ''
    });
    setProductSearch('');
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleEdit = (item: Gudang) => {

    const [datePart, timePart] = item.tanggal.split('T');
    const timeOnly = timePart ? timePart.split('.')[0].slice(0, 5) : '00:00';
    
    setFormData({
      id_product: item.id_product,
      tanggal: datePart,
      waktu: timeOnly,
      jumlah_keluar: item.jumlah_keluar.toString(),
      jumlah_masuk: item.jumlah_masuk.toString(),
      cabang: item.cabang || userCabang
    });
    setProductSearch(item.product_name || '');
    setEditingId(item.uniqueid_gudang);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus data gudang ini?')) return;
    try {
      // Get the gudang record first to check if it's from SO
      const { data: gudangData } = await supabase
        .from('gudang')
        .select('source_type, source_reference')
        .eq('uniqueid_gudang', id)
        .single();
      
      // Delete the gudang record
      const { error } = await supabase
        .from('gudang')
        .delete()
        .eq('uniqueid_gudang', id);
      if (error) throw error;
      
      // If it's from stock opname, reset the SO status to pending
      if (gudangData?.source_type === 'stock_opname' && gudangData?.source_reference) {
        const soId = gudangData.source_reference.replace('SO-', '');
        await supabase
          .from('stock_opname')
          .update({ status: 'pending' })
          .eq('id_opname', parseInt(soId));
      }
      
      await fetchGudang();
    } catch (error) {
      console.error('Error deleting gudang:', error);
    }
  };

  const handleProductSelect = (product: Product) => {
    setFormData(prev => ({ ...prev, id_product: product.id_product }));
    setProductSearch(product.product_name);
    setShowProductDropdown(false);
  };

  const filteredProducts = products.filter(p => 
    p.product_name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedGudang = (() => {
    let filtered = gudang.filter(item => {
      const matchesSearch = (item.order_no || '').toString().includes(searchTerm) ||
        (item.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.nama_pengambil_barang || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = !dateFilter || item.tanggal.includes(dateFilter);
      const matchesProduct = !productFilter || (item.product_name || '').toLowerCase().includes(productFilter.toLowerCase());
      
      return matchesSearch && matchesDate && matchesProduct;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key as keyof Gudang];
        let bValue = b[sortConfig.key as keyof Gudang];
        
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

  const totalPages = Math.ceil(filteredAndSortedGudang.length / itemsPerPage);
  const paginatedGudang = filteredAndSortedGudang.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueProducts = [...new Set(gudang.map(g => g.product_name).filter(Boolean))];

  const handleExport = () => {
    if (gudang.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(gudang.map(g => ({
      order_no: g.order_no,
      tanggal: g.tanggal.split('T')[0],
      product_name: g.product_name,
      cabang: g.branch_name || g.cabang,
      jumlah_masuk: g.jumlah_masuk,
      jumlah_keluar: g.jumlah_keluar,
      total_gudang: g.total_gudang,
      nama_pengambil_barang: g.nama_pengambil_barang
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gudang");
    XLSX.writeFile(wb, `gudang_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const recalculateAffectedRecords = async (idProduct: number, fromDate: string) => {
    try {
      // Get all records for this product from the affected date onwards
      const { data: affectedRecords } = await supabase
        .from('gudang')
        .select('*')
        .eq('id_product', idProduct)
        .gte('tanggal', fromDate)
        .order('tanggal', { ascending: true })
        .order('order_no', { ascending: true });

      if (!affectedRecords || affectedRecords.length === 0) return;

      // Get the starting balance (last record before the affected date)
      const { data: lastRecord } = await supabase
        .from('gudang')
        .select('total_gudang')
        .eq('id_product', idProduct)
        .lt('tanggal', fromDate)
        .order('tanggal', { ascending: false })
        .order('order_no', { ascending: false })
        .limit(1);

      let runningTotal = lastRecord?.[0]?.total_gudang || 0;

      // Recalculate all affected records
      for (const record of affectedRecords) {
        runningTotal = runningTotal + record.jumlah_masuk - record.jumlah_keluar;
        
        await supabase
          .from('gudang')
          .update({ total_gudang: runningTotal })
          .eq('uniqueid_gudang', record.uniqueid_gudang);
      }
    } catch (error) {
      console.error('Error recalculating affected records:', error);
    }
  };

  const recalculateAllTotals = async () => {
    setIsRecalculating(true);
    
    try {
      // Get all records ordered by date and order_no
      const { data: allRecords } = await supabase
        .from('gudang')
        .select('*')
        .order('tanggal', { ascending: true })
        .order('order_no', { ascending: true });

      if (!allRecords) return;

      // Group by product
      const groupedByProduct = allRecords.reduce((acc, record: any) => {
        if (!acc[record.id_product]) acc[record.id_product] = [];
        acc[record.id_product].push(record);
        return acc;
      }, {} as Record<number, any[]>);

      // Recalculate each product's running total
      for (const [productId, records] of Object.entries(groupedByProduct)) {
        let runningTotal = 0;
        
        // Sort records by date and order_no to ensure correct chronological order
        const sortedRecords = (records as any[]).sort((a: any, b: any) => {
          const dateA = new Date(a.tanggal).getTime();
          const dateB = new Date(b.tanggal).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return (a.order_no || 0) - (b.order_no || 0);
        });
        
        for (const record of sortedRecords) {
          runningTotal = runningTotal + (record as any).jumlah_masuk - (record as any).jumlah_keluar;
          
          await supabase
            .from('gudang')
            .update({ total_gudang: runningTotal })
            .eq('uniqueid_gudang', (record as any).uniqueid_gudang);
        }
      }
      
      await fetchGudang();
    } catch (error) {
      console.error('Error recalculating:', error);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedGudang.map(item => item.uniqueid_gudang));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedItems.length} selected items?`)) return;
    
    try {
      for (const id of selectedItems) {
        // Get the gudang record first to check if it's from SO
        const { data: gudangData } = await supabase
          .from('gudang')
          .select('source_type, source_reference')
          .eq('uniqueid_gudang', id)
          .single();
        
        // Delete the gudang record
        await supabase
          .from('gudang')
          .delete()
          .eq('uniqueid_gudang', id);
        
        // If it's from stock opname, reset the SO status to pending
        if (gudangData?.source_type === 'stock_opname' && gudangData?.source_reference) {
          const soId = gudangData.source_reference.replace('SO-', '');
          await supabase
            .from('stock_opname')
            .update({ status: 'pending' })
            .eq('id_opname', parseInt(soId));
        }
      }
      
      setSelectedItems([]);
      setSelectAll(false);
      await fetchGudang();
    } catch (error) {
      console.error('Error bulk deleting:', error);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const importData = [];
        for (const row of jsonData as any[]) {
          const productName = row['product_name']?.toString().trim();
          let tanggal = row['tanggal'];
          const jumlahMasuk = parseFloat(row['jumlah_masuk']) || 0;
          const jumlahKeluar = parseFloat(row['jumlah_keluar']) || 0;
          const namaPengambil = row['nama_pengambil_barang']?.toString().trim() || 'Imported';
          
          // Convert Excel date serial number to proper date
          if (typeof tanggal === 'number') {
            // Use XLSX library's built-in date conversion
            const excelDate = XLSX.SSF.parse_date_code(tanggal);
            if (excelDate) {
              // Format date as YYYY-MM-DD directly from components
              const year = excelDate.y;
              const month = String(excelDate.m).padStart(2, '0');
              const day = String(excelDate.d).padStart(2, '0');
              tanggal = `${year}-${month}-${day}`;
            } else {
              tanggal = tanggal.toString().trim();
            }
          } else if (tanggal) {
            tanggal = tanggal.toString().trim();
          }
          
          const product = products.find(p => 
            p.product_name.toLowerCase() === productName?.toLowerCase()
          );
          
          if (product && tanggal) {
            // Convert date-only format to timestamp with current time
            const timestamp = tanggal.includes('T') ? tanggal : `${tanggal}T${new Date().toTimeString().slice(0, 8)}.000Z`;
            
            importData.push({
              id_product: product.id_product,
              tanggal: timestamp,
              jumlah_masuk: jumlahMasuk,
              jumlah_keluar: jumlahKeluar,
              total_gudang: 0,
              nama_pengambil_barang: namaPengambil,
              cabang: row['cabang'] || formData.cabang || 'DEFAULT'
            });
          }
        }
        
        if (importData.length > 0) {
          const { error } = await supabase
            .from('gudang')
            .insert(importData);
          
          if (error) throw error;
          fetchGudang();
        }
      } catch (err: any) {
        console.error('Import error:', err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="p-2">
        <div className="bg-white p-2 rounded-lg shadow text-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mb-1 mx-auto"></div>
          <p className="text-xs text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 md:p-2">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-sm font-bold text-gray-800">📦 Warehouse</h1>
      </div>

      <div className="bg-white p-1 rounded-lg shadow mb-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1 mb-2">
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
        </div>
        <div className="flex flex-wrap gap-1">
          <button 
            onClick={recalculateAllTotals} 
            disabled={isRecalculating}
            className="bg-purple-600 text-white px-2 py-1 rounded-md text-xs disabled:opacity-50"
          >
            {isRecalculating ? 'Processing...' : 'Recalculate'}
          </button>
          <button onClick={handleExport} className="bg-green-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
            <Download size={12} />Export
          </button>
          <label className="bg-orange-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1 cursor-pointer hover:bg-orange-700">
            <Upload size={12} />Import
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1"
          >
            <Plus size={12} />Add
          </button>
          {selectedItems.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-600 text-white px-2 py-1 rounded-md text-xs"
            >
              Delete ({selectedItems.length})
            </button>
          )}
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white p-1 rounded-lg shadow mb-1">
          <h3 className="font-medium text-gray-800 mb-2 text-xs">{editingId ? 'Edit' : 'Add'} Warehouse Entry</h3>
          <form onSubmit={handleSubmit} className="space-y-1">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-1">
              <input
                type="date"
                value={formData.tanggal}
                onChange={(e) => setFormData(prev => ({ ...prev, tanggal: e.target.value }))}
                className="border px-2 py-1 rounded-md text-xs"
                required
              />
              <input
                type="time"
                value={formData.waktu}
                onChange={(e) => setFormData(prev => ({ ...prev, waktu: e.target.value }))}
                className="border px-2 py-1 rounded-md text-xs"
                required
              />
              <select
                value={formData.cabang}
                onChange={(e) => setFormData(prev => ({ ...prev, cabang: e.target.value }))}
                className="border px-2 py-1 rounded-md text-xs"
                required
              >
                <option value="">Select Branch</option>
                {cabangList.map(cabang => (
                  <option key={cabang.id_branch} value={cabang.kode_branch}>
                    {cabang.nama_branch}
                  </option>
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
                  placeholder="Search Product *"
                  required
                />
                {showProductDropdown && (
                  <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg max-h-32 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((product) => (
                        <div
                          key={product.id_product}
                          onClick={() => handleProductSelect(product)}
                          className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs"
                        >
                          {product.product_name} ({product.category})
                        </div>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-xs text-gray-500">No products found</div>
                    )}
                  </div>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                value={formData.jumlah_masuk}
                onChange={(e) => setFormData(prev => ({ ...prev, jumlah_masuk: e.target.value }))}
                className="border px-2 py-1 rounded-md text-xs"
                placeholder="Jumlah Masuk"
              />
              <input
                type="number"
                step="0.01"
                value={formData.jumlah_keluar}
                onChange={(e) => setFormData(prev => ({ ...prev, jumlah_keluar: e.target.value }))}
                className="border px-2 py-1 rounded-md text-xs"
                placeholder="Jumlah Keluar"
              />
            </div>
            <div className="flex gap-1">
              <button type="submit" disabled={saving} className="bg-green-600 text-white px-3 py-1 rounded-md text-xs disabled:opacity-50">
                {saving ? 'Saving...' : (editingId ? 'Update' : 'Save')}
              </button>
              <button type="button" onClick={resetForm} className="bg-gray-600 text-white px-3 py-1 rounded-md text-xs">
                Cancel
              </button>
            </div>
          </form>
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
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="w-3 h-3"
                  />
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('order_no')}>
                  Order No {sortConfig?.key === 'order_no' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal')}>
                  Date {sortConfig?.key === 'tanggal' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">
                  Time
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('branch_name')}>
                  Branch {sortConfig?.key === 'branch_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product_name')}>
                  Product {sortConfig?.key === 'product_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('jumlah_masuk')}>
                  In {sortConfig?.key === 'jumlah_masuk' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('jumlah_keluar')}>
                  Out {sortConfig?.key === 'jumlah_keluar' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('total_gudang')}>
                  Total {sortConfig?.key === 'total_gudang' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Pengambil</th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Source</th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedGudang.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-1 py-2 text-center text-gray-500 text-xs">
                    No data found
                  </td>
                </tr>
              ) : (
                paginatedGudang.map((item) => (
                  <tr key={item.uniqueid_gudang} className="hover:bg-gray-50">
                    <td className="px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.uniqueid_gudang)}
                        onChange={() => handleSelectItem(item.uniqueid_gudang)}
                        className="w-3 h-3"
                      />
                    </td>
                    <td className="px-1 py-1 font-medium">
                      {(item as any).source_type === 'stock_opname' ? (
                        <a 
                          href={`/stock_opname?highlight=${(item as any).source_reference?.replace('SO-', '')}`}
                          className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          title="View related Stock Opname"
                        >
                          {item.order_no}
                        </a>
                      ) : (
                        <span className="text-blue-600">{item.order_no}</span>
                      )}
                    </td>
                    <td className="px-1 py-1">{item.tanggal.split('T')[0]}</td>
                    <td className="px-1 py-1">{new Date(item.tanggal).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-1 py-1">{item.branch_name || item.cabang}</td>
                    <td className="px-1 py-1">{item.product_name}</td>
                    <td className="px-1 py-1 text-green-600">{item.jumlah_masuk}</td>
                    <td className="px-1 py-1 text-red-600">{item.jumlah_keluar}</td>
                    <td className="px-1 py-1 font-medium">{item.total_gudang}</td>
                    <td className="px-1 py-1">{item.nama_pengambil_barang}</td>
                    <td className="px-1 py-1">
                      {(item as any).source_type === 'stock_opname' ? (
                        <span className="px-1 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-semibold">
                          📊 SO
                        </span>
                      ) : (
                        <span className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.uniqueid_gudang)}
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                        >
                          <Trash2 size={12} />
                        </button>
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
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredAndSortedGudang.length)} of {filteredAndSortedGudang.length} records
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
  );
}

export default function GudangPage() {
  return (
    <Layout>
      <GudangPageContent />
    </Layout>
  );
}