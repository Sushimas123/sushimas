'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import PageAccessControl from '../../components/PageAccessControl';
import { getBranchFilter } from '@/src/utils/branchAccess';
import { canPerformActionSync, arePermissionsLoaded, reloadPermissions } from '@/src/utils/rolePermissions';
import { hasPageAccess } from '@/src/utils/permissionChecker';
import { canViewColumn } from '@/src/utils/dbPermissions';

// XSS protection utility
const sanitizeText = (text: any): string => {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[<>"'&]/g, (match) => {
    const entities: { [key: string]: string } = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '&': '&amp;'
    };
    return entities[match] || match;
  });
};

interface Gudang {
  order_no: number;
  id_product: number;
  tanggal: string;
  jumlah_keluar: number;
  jumlah_masuk: number;
  total_gudang: number;
  running_total: number;
  nama_pengambil_barang: string;
  cabang: string;
  source_type: string;
  source_reference: string;
  created_by: number;
  updated_by: number;
  updated_at?: string;
  product_name?: string;
  branch_name?: string;
  supplier_name?: string;
  is_locked?: boolean;
  locked_by_so?: string;
  locked_date?: string;
  minimum_stock?: number;
}

interface Product {
  id_product: number;
  product_name: string;
  category: string;
  sub_category?: string;
  suppliers?: { nama_supplier: string }[];
}

function GudangFinalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gudang, setGudang] = useState<Gudang[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, branchFilter, categoryFilter, subCategoryFilter]);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    id_product: 0,
    tanggal: new Date().toISOString().split('T')[0],
    waktu: new Date().toTimeString().slice(0, 5),
    jumlah_keluar: '',
    jumlah_masuk: '',
    nama_pengambil_barang: '',
    cabang: '',
    source_type: 'manual',
    source_reference: ''
  });
  const [userCabang, setUserCabang] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('user');
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [cabangList, setCabangList] = useState<{id_branch: number, kode_branch: string, nama_branch: string}[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permittedColumns, setPermittedColumns] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);

  const fetchGudang = async () => {
    try {
      let allGudangData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      
      // Fetch all data using pagination
      while (true) {
        const { data: batchData, error: batchError } = await supabase
          .from('gudang_final_view')
          .select('*')
          .order('tanggal', { ascending: false })
          .order('order_no', { ascending: false })
          .range(from, from + batchSize - 1);
        
        if (batchError) throw batchError;
        if (!batchData || batchData.length === 0) break;
        
        allGudangData = [...allGudangData, ...batchData];
        
        if (batchData.length < batchSize) break;
        from += batchSize;
      }
      
      // Fetch related data
      const [productsData, branchesData, stockSettingsData] = await Promise.all([
        supabase.from('nama_product').select('id_product, product_name, supplier_id, suppliers!supplier_id(nama_supplier)'),
        supabase.from('branches').select('kode_branch, nama_branch'),
        supabase.from('product_branch_settings').select(`
          id_product,
          safety_stock,
          branches!inner(kode_branch)
        `)
      ]);
      
      console.log('Products with suppliers:', productsData.data?.slice(0, 3));
      
      const productMap = new Map(productsData.data?.map(p => [p.id_product, p.product_name]) || []);
      const supplierMap = new Map(productsData.data?.map(p => {
        const supplierName = (p.suppliers as any)?.nama_supplier || '';
        return [p.id_product, supplierName];
      }) || []);
      const branchMap = new Map(branchesData.data?.map(b => [b.kode_branch, b.nama_branch]) || []);
      const stockSettingsMap = new Map(stockSettingsData.data?.map(s => [`${s.id_product}-${(s.branches as any).kode_branch}`, s.safety_stock]) || []);
      
      console.log('Supplier map sample:', Array.from(supplierMap.entries()).slice(0, 5));
      
      let gudangWithNames = allGudangData.map((item: any) => ({
        ...item,
        product_name: productMap.get(item.id_product) || item.product_name || '',
        supplier_name: supplierMap.get(item.id_product) || '',
        branch_name: branchMap.get(item.cabang) || item.branch_name || item.cabang,
        minimum_stock: stockSettingsMap.get(`${item.id_product}-${item.cabang}`) || 0
      }));
      
      // Only apply branch filter for non-super admin users
      if (userRole !== 'super admin' && userRole !== 'admin') {
        const branchFilter = await getBranchFilter();
        if (branchFilter && branchFilter.length > 0) {
          gudangWithNames = gudangWithNames.filter(item => 
            branchFilter.includes(item.cabang) || branchFilter.includes(item.branch_name)
          );
        }
      }
      
      setGudang(gudangWithNames);
    } catch (error) {
      console.error('Error fetching gudang:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    
    // Handle URL parameters from analysis page
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    const branchParam = urlParams.get('branch');
    const productParam = urlParams.get('product');
    
    if (dateParam) {
      setDateFilter(dateParam);
    }
    if (branchParam) {
      setBranchFilter(branchParam);
    }
    if (productParam) {
      setSearchTerm(productParam);
    }
  }, []);

  useEffect(() => {
    if (hasAccess === true) {
      fetchCabang();
      fetchGudang();
      fetchProducts();
      fetchStockAlerts();
    }
  }, [hasAccess]);

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
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUserCabang(userData.cabang || '');
        setUserRole(userData.role || 'user');
        setUserId(userData.id_user || null);
        setUserName(userData.nama_lengkap || 'Current User');
        setHasAccess(true);
        return;
      }
      setHasAccess(false);
    } catch (error) {
      console.error('Error fetching user info:', error);
      setHasAccess(false);
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
      
      let filteredBranches = data || [];
      const branchFilter = await getBranchFilter();
      if (branchFilter && branchFilter.length > 0) {
        filteredBranches = data?.filter(branch => branchFilter.includes(branch.kode_branch)) || [];
      }
      setCabangList(filteredBranches);
    } catch (error) {
      console.error('Error fetching cabang:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      // Fetch products with supplier info
      const { data, error } = await supabase
        .from('nama_product')
        .select(`
          id_product, 
          product_name, 
          category, 
          sub_category,
          suppliers!supplier_id(nama_supplier)
        `)
        .eq('is_active', true)
        .order('product_name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchStockAlerts = async () => {
    try {
      let { data, error } = await supabase.rpc('get_stock_alerts_with_po_status');
      
      if (error) {
        const result = await supabase.rpc('get_products_needing_po');
        data = result.data;
        error = result.error;
        
        if (data) {
          data = data.map((alert: any) => ({
            ...alert,
            po_status: 'NONE',
            po_number: null,
            po_created_at: null
          }));
        }
      }
      
      if (!error && data) {
        setStockAlerts(data);
      }
    } catch (error) {
      console.error('Error fetching stock alerts:', error);
    }
  };

  const getStockStatus = (idProduct: number, cabang: string) => {
    const alert = stockAlerts.find(a => a.id_product === idProduct && a.branch_code === cabang);
    if (!alert) return 'OK';
    
    if (alert.po_status === 'Pending') return 'PO_PENDING';
    if (alert.po_status === 'Sedang diproses') return 'ON_ORDER';
    return alert.urgency_level;
  };

  const handleCreatePOFromStock = (idProduct: number, cabang: string) => {
    router.push('/purchaseorder/stock-alert');
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleExport = () => {
    if (filteredAndSortedGudang.length === 0) {
      showToast("No data to export", 'error')
      return
    }
    
    try {
      const exportData = filteredAndSortedGudang.map(item => ({
        'Order No': item.order_no,
        'Date': item.tanggal.split('T')[0],
        'Time': new Date(item.tanggal).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        'Branch': item.branch_name,
        'Product': item.product_name,
        'In': item.jumlah_masuk,
        'Out': item.jumlah_keluar,
        'Total': item.running_total || item.total_gudang || 0,
        'Stock Alert': (() => {
          const currentStock = item.running_total || item.total_gudang || 0;
          const minStock = item.minimum_stock || 0;
          
          if (currentStock <= 0) {
            return 'Out of Stock';
          } else if (currentStock <= minStock) {
            return 'Low Stock';
          } else {
            return 'OK';
          }
        })(),
        'Person': item.nama_pengambil_barang,
        'Source': (item as any).source_type === 'stock_opname_batch' ? 'SO' : 
                 (item as any).source_type === 'PO' ? 'PO' : 
                 (item as any).source_reference && (item as any).source_reference.startsWith('TRF-') ? 'TRF' : 'Manual',
        'Status': item.is_locked ? `Locked by ${item.locked_by_so}` : 
                 (item as any).source_type === 'stock_opname_batch' ? 'Locked (SO)' : 
                 (item as any).source_type === 'PO' ? 'Locked (PO)' : 
                 (item as any).source_reference && (item as any).source_reference.startsWith('TRF-') ? 'Locked (TRF)' : 'Open'
      }));
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gudang Final');
      XLSX.writeFile(wb, `gudang_final_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      showToast(`✅ Exported ${exportData.length} records successfully`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast("❌ Failed to export data", 'error');
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_product) return;

    setSaving(true);

    const jumlahMasuk = parseFloat(formData.jumlah_masuk as string) || 0;
    const jumlahKeluar = parseFloat(formData.jumlah_keluar as string) || 0;
    
    const timestamp = `${formData.tanggal}T${formData.waktu}:00.000Z`;
    
    if (jumlahMasuk === 0 && jumlahKeluar === 0) {
      alert('Please enter either Jumlah Masuk or Jumlah Keluar');
      setSaving(false);
      return;
    }

    // Check if there are locked records after this timestamp
    const { data: lockedAfter, error: lockError } = await supabase
      .from('gudang')
      .select('tanggal, locked_by_so')
      .eq('id_product', formData.id_product)
      .eq('cabang', formData.cabang)
      .gt('tanggal', timestamp)
      .eq('is_locked', true)
      .order('tanggal', { ascending: true })
      .limit(1);
    
    if (lockError) {
      console.error('Error checking locked records:', lockError);
      setSaving(false);
      return;
    }

    if (lockedAfter && lockedAfter.length > 0) {
      const lockDate = new Date(lockedAfter[0].tanggal).toLocaleDateString();
      alert(`❌ Cannot add transaction: Period is locked by ${lockedAfter[0].locked_by_so} starting from ${lockDate}`);
      setSaving(false);
      return;
    }

    const submitData = {
      id_product: formData.id_product,
      tanggal: timestamp,
      jumlah_keluar: jumlahKeluar,
      jumlah_masuk: jumlahMasuk,
      total_gudang: 0, // Will be calculated by trigger
      nama_pengambil_barang: formData.nama_pengambil_barang || userName,
      cabang: formData.cabang,
      source_type: formData.source_type || 'manual',
      source_reference: formData.source_reference || null,
      created_by: userId ?? null,
      updated_by: userId ?? null
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('gudang')
          .update(submitData)
          .eq('order_no', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('gudang')
          .insert(submitData);
        if (error) throw error;
      }

      await fetchGudang();
      resetForm();
      showToast(editingId ? '✅ Record updated successfully' : '✅ Record added successfully', 'success');
    } catch (error) {
      console.error('Error saving gudang:', error);
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      showToast(`❌ Failed to save: ${errorMessage}`, 'error');
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
      nama_pengambil_barang: userName,
      cabang: userCabang || '',
      source_type: 'manual',
      source_reference: ''
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
      nama_pengambil_barang: item.nama_pengambil_barang || '',
      cabang: item.cabang || userCabang,
      source_type: item.source_type || 'manual',
      source_reference: item.source_reference || ''
    });
    setProductSearch(item.product_name || '');
    setEditingId(item.order_no);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus data gudang ini?')) return;
    try {
      const { error } = await supabase
        .from('gudang')
        .delete()
        .eq('order_no', id);
      if (error) throw error;
      
      await fetchGudang();
      showToast('✅ Record deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting gudang:', error);
      showToast('❌ Failed to delete record', 'error');
    }
  };

  const handleProductSelect = (product: Product) => {
    setFormData(prev => ({ ...prev, id_product: product.id_product }));
    setProductSearch(product.product_name);
    setShowProductDropdown(false);
  };

  const filteredProducts = products.filter(p => 
    p.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
    ((p.suppliers as any)?.nama_supplier && (p.suppliers as any).nama_supplier.toLowerCase().includes(productSearch.toLowerCase()))
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
        (item.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.nama_pengambil_barang || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = !dateFilter || item.tanggal.includes(dateFilter);
      
      const matchesBranch = !branchFilter || 
        (item.branch_name || '').toLowerCase().includes(branchFilter.toLowerCase()) ||
        (item.cabang || '').toLowerCase().includes(branchFilter.toLowerCase());
      
      const product = products.find(p => p.id_product === item.id_product);
      const itemCategory = product?.category || '';
      const itemSubCategory = product?.sub_category || '';
      const matchesCategory = !categoryFilter || itemCategory.toLowerCase().includes(categoryFilter.toLowerCase());
      const matchesSubCategory = !subCategoryFilter || itemSubCategory.toLowerCase().includes(subCategoryFilter.toLowerCase());
      
      return matchesSearch && matchesDate && matchesBranch && matchesCategory && matchesSubCategory;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        if (sortConfig.key === 'stock_alert') {
          aValue = getStockStatus(a.id_product, a.cabang);
          bValue = getStockStatus(b.id_product, b.cabang);
        } else {
          aValue = a[sortConfig.key as keyof Gudang];
          bValue = b[sortConfig.key as keyof Gudang];
        }
        
        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';
        
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

  if (loading || hasAccess === null) {
    return (
      <div className="p-2">
        <div className="bg-white p-2 rounded-lg shadow text-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mb-1 mx-auto"></div>
          <p className="text-xs text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (hasAccess === false) {
    return (
      <div className="p-2">
        <div className="bg-white p-4 rounded-lg shadow text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600 mb-4">
            You don't have permission to access the Warehouse page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 md:p-2">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 flex items-center shadow-lg transform transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span className="mr-2">{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.message}
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-gray-800">🚀 Gudang</h1>
        </div>
        <div className="text-xs text-gray-500">
          Total: {filteredAndSortedGudang.length} records | Role: {userRole}
        </div>
      </div>

      <div className="bg-white p-1 rounded-lg shadow mb-1">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-1 mb-2">
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
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="border px-2 py-1 rounded-md text-xs"
          >
            <option value="">All Branches</option>
            {cabangList.map(cabang => (
              <option key={cabang.kode_branch} value={cabang.nama_branch}>
                {cabang.nama_branch}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border px-2 py-1 rounded-md text-xs"
          >
            <option value="">All Categories</option>
            {[...new Set(
              gudang.map(g => {
                const product = products.find(p => p.id_product === g.id_product);
                return product?.category || '';
              }).filter(Boolean)
            )].sort().map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={subCategoryFilter}
            onChange={(e) => setSubCategoryFilter(e.target.value)}
            className="border px-2 py-1 rounded-md text-xs"
          >
            <option value="">All Sub Categories</option>
            {[...new Set(
              gudang.map(g => {
                const product = products.find(p => p.id_product === g.id_product);
                return product?.sub_category || '';
              }).filter(Boolean)
            )].sort().map(subCategory => (
              <option key={subCategory} value={subCategory}>{subCategory}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (!showAddForm) {
                setFormData(prev => ({ 
                  ...prev, 
                  nama_pengambil_barang: userName,
                  cabang: userCabang || '' 
                }));
              }
            }}
            className="bg-blue-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1"
            title={`Role: ${userRole} - Create permission: ${canPerformActionSync(userRole, 'gudang-final', 'create')}`}
          >
            <Plus size={12} />Add
          </button>
          
          <button 
            onClick={fetchGudang}
            disabled={loading}
            className="bg-purple-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1 disabled:opacity-50"
          >
            🔄 Refresh
          </button>

          {(userRole === 'super admin' || userRole === 'admin') && (
            <button 
              onClick={handleExport}
              className="bg-green-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-green-700"
            >
              <Download size={12} />Export
            </button>
          )}
          
          {(userRole === 'super admin' || userRole === 'admin') && (
            <label className="bg-orange-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1 cursor-pointer hover:bg-orange-700">
              <Upload size={12} />Import
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
              />
            </label>
          )}

          {selectedItems.length > 0 && canPerformActionSync(userRole, 'gudang-final', 'delete') && (
            <button
              onClick={async () => {
                // Filter out locked/protected items before deletion
                const deletableItems = [];
                const lockedItems = [];
                
                for (const id of selectedItems) {
                  const item = gudang.find(g => g.order_no === id);
                  if (!item) continue;
                  
                  if (item.is_locked || 
                      (item as any).source_type === 'stock_opname_batch' || 
                      (item as any).source_type === 'PO' || 
                      ((item as any).source_reference && (item as any).source_reference.startsWith('TRF-'))) {
                    lockedItems.push(id);
                    continue;
                  }
                  
                  deletableItems.push(id);
                }
                
                if (deletableItems.length === 0) {
                  alert('❌ No deletable records selected. All selected records are locked or protected.');
                  return;
                }
                
                if (lockedItems.length > 0) {
                  if (!confirm(`${lockedItems.length} locked/protected records will be skipped. Continue deleting ${deletableItems.length} records?`)) {
                    return;
                  }
                } else {
                  if (!confirm(`Delete ${deletableItems.length} selected items?`)) return;
                }
                
                try {
                  let deletedCount = 0;
                  
                  for (const id of deletableItems) {
                    const { error } = await supabase.from('gudang').delete().eq('order_no', id);
                    if (error) throw error;
                    deletedCount++;
                  }
                  
                  // Remove deleted items from selection, keep locked ones selected for user awareness
                  setSelectedItems(lockedItems);
                  setSelectAll(false);
                  await fetchGudang();
                  
                  if (lockedItems.length > 0) {
                    showToast(`✅ Deleted ${deletedCount} records, ${lockedItems.length} locked/protected records remain selected`, 'success');
                  } else {
                    showToast(`✅ Deleted ${deletedCount} records successfully`, 'success');
                  }
                } catch (error) {
                  console.error('Error bulk deleting:', error);
                  showToast('❌ Failed to delete records', 'error');
                }
              }}
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
            <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-1 mb-2">
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
                          className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{product.product_name}</div>
                          {(product.suppliers as any)?.nama_supplier && (
                            <div className="text-xs text-blue-600 mt-0.5">Supplier: {(product.suppliers as any).nama_supplier}</div>
                          )}
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
                value={userRole === 'admin' || userRole === 'super admin' ? formData.jumlah_masuk : '0'}
                onChange={userRole === 'admin' || userRole === 'super admin' ? (e) => setFormData(prev => ({ ...prev, jumlah_masuk: e.target.value })) : undefined}
                readOnly={userRole !== 'admin' && userRole !== 'super admin'}
                className={`border px-2 py-1 rounded-md text-xs ${userRole !== 'admin' && userRole !== 'super admin' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder={userRole === 'admin' || userRole === 'super admin' ? 'Jumlah Masuk' : 'Jumlah Masuk (Admin Only)'}
                title={userRole !== 'admin' && userRole !== 'super admin' ? 'Only Admin and Super Admin can input incoming stock' : ''}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1">
              <input
                type="text"
                value={formData.nama_pengambil_barang}
                readOnly
                className="border px-2 py-1 rounded-md text-xs bg-gray-100 cursor-not-allowed"
                placeholder="Nama Pengambil Barang"
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
                    checked={selectedItems.length === paginatedGudang.filter(item => 
                      !item.is_locked && 
                      (item as any).source_type !== 'stock_opname_batch' && 
                      (item as any).source_type !== 'PO' && 
                      !((item as any).source_reference && (item as any).source_reference.startsWith('TRF-'))
                    ).length && paginatedGudang.filter(item => 
                      !item.is_locked && 
                      (item as any).source_type !== 'stock_opname_batch' && 
                      (item as any).source_type !== 'PO' && 
                      !((item as any).source_reference && (item as any).source_reference.startsWith('TRF-'))
                    ).length > 0}
                    onChange={() => {
                      const selectableItems = paginatedGudang.filter(item => 
                        !item.is_locked && 
                        (item as any).source_type !== 'stock_opname_batch' && 
                        (item as any).source_type !== 'PO' && 
                        !((item as any).source_reference && (item as any).source_reference.startsWith('TRF-'))
                      );
                      
                      if (selectedItems.length === selectableItems.length) {
                        setSelectedItems([]);
                      } else {
                        setSelectedItems(selectableItems.map(item => item.order_no));
                      }
                      setSelectAll(!selectAll);
                    }}
                    className="w-3 h-3"
                  />
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('order_no')}>
                  Order No {sortConfig?.key === 'order_no' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal')}>
                  Date {sortConfig?.key === 'tanggal' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal')}>
                  Time {sortConfig?.key === 'tanggal' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('branch_name')}>
                  Branch {sortConfig?.key === 'branch_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product_name')}>
                  Product {sortConfig?.key === 'product_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('supplier_name')}>
                  Supplier {sortConfig?.key === 'supplier_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('jumlah_masuk')}>
                  In {sortConfig?.key === 'jumlah_masuk' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('jumlah_keluar')}>
                  Out {sortConfig?.key === 'jumlah_keluar' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('running_total')}>
                  Total {sortConfig?.key === 'running_total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('stock_alert')}>
                  Stock Alert {sortConfig?.key === 'stock_alert' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('nama_pengambil_barang')}>
                  Person {sortConfig?.key === 'nama_pengambil_barang' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('source_type')}>
                  Source {sortConfig?.key === 'source_type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('is_locked')}>
                  Status {sortConfig?.key === 'is_locked' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedGudang.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-1 py-2 text-center text-gray-500 text-xs">
                    No data found
                  </td>
                </tr>
              ) : (
                paginatedGudang.map((item) => (
                  <tr key={item.order_no} className="hover:bg-gray-50">
                    <td className="px-1 py-1 text-center">
                      {item.is_locked || (item as any).source_type === 'stock_opname_batch' || (item as any).source_type === 'PO' || ((item as any).source_reference && (item as any).source_reference.startsWith('TRF-')) ? (
                        <span className="text-gray-400 text-xs" title={item.is_locked ? `Locked by ${item.locked_by_so}` : (item as any).source_type === 'PO' ? 'PO Protected' : (item as any).source_reference && (item as any).source_reference.startsWith('TRF-') ? 'Transfer Protected' : 'SO Protected'}>🔒</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.order_no)}
                          onChange={() => {
                            if (selectedItems.includes(item.order_no)) {
                              setSelectedItems(selectedItems.filter(id => id !== item.order_no));
                            } else {
                              setSelectedItems([...selectedItems, item.order_no]);
                            }
                          }}
                          className="w-3 h-3"
                        />
                      )}
                    </td>
                    <td className="px-1 py-1 font-medium text-blue-600">{item.order_no}</td>
                    <td className="px-1 py-1">{item.tanggal.split('T')[0]}</td>
                    <td className="px-1 py-1">{new Date(item.tanggal).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-1 py-1">{item.branch_name}</td>
                    <td className="px-1 py-1">{sanitizeText(item.product_name)}</td>
                    <td className="px-1 py-1 text-xs text-gray-600">{sanitizeText(item.supplier_name)}</td>
                    <td className="px-1 py-1 text-green-600">{item.jumlah_masuk}</td>
                    <td className="px-1 py-1 text-red-600">{item.jumlah_keluar}</td>
                    <td className="px-1 py-1 font-medium">{item.running_total || item.total_gudang || 0}</td>
                    <td className="px-1 py-1">
                      {getStockStatus(item.id_product, item.cabang) !== 'OK' ? (
                        <button
                          onClick={() => handleCreatePOFromStock(item.id_product, item.cabang)}
                          className={`px-1 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${
                            getStockStatus(item.id_product, item.cabang) === 'PO_PENDING' 
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' :
                            getStockStatus(item.id_product, item.cabang) === 'ON_ORDER'
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                            getStockStatus(item.id_product, item.cabang) === 'CRITICAL' 
                              ? 'text-red-800 hover:bg-red-200' 
                              : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                          }`}
                          title={`Stock Alert: ${getStockStatus(item.id_product, item.cabang)} - Click to go to Stock Alert PO page`}
                        >
                          {getStockStatus(item.id_product, item.cabang) === 'PO_PENDING' ? '⏳' :
                           getStockStatus(item.id_product, item.cabang) === 'ON_ORDER' ? '🚚' :
                           getStockStatus(item.id_product, item.cabang) === 'CRITICAL' ? '🛒' : '🛒 LOW'}
                        </button>
                      ) : (
                        <span className="text-green-600 text-xs">✓ OK</span>
                      )}
                    </td>
                    <td className="px-1 py-1 text-xs">{sanitizeText(item.nama_pengambil_barang)}</td>
                    <td className="px-1 py-1">
                      {(item as any).source_type === 'stock_opname_batch' ? (
                        <span className="px-1 py-0.5 text-black-800 rounded text-xs font-semibold">
                          📊 SO
                        </span>
                      ) : (item as any).source_type === 'PO' && (item as any).source_reference ? (
                        <span className="px-1 py-0.5 text-black-800 rounded text-xs font-semibold">
                          📋 PO
                        </span>
                      ) : (item as any).source_reference && (item as any).source_reference.startsWith('TRF-') ? (
                        <span className="px-1 py-0.5 text-black-800 rounded text-xs font-semibold">
                          🔄 TRF
                        </span>
                      ) : (
                        <span className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1 text-xs">
                      {item.is_locked ? (
                        <span className="text-red-600" title={`Locked by ${item.locked_by_so}`}>
                          🔒 Locked
                        </span>
                      ) : (item as any).source_type === 'stock_opname_batch' ? (
                        <span className="text-blue-600">
                          🔒 SO
                        </span>
                      ) : (item as any).source_type === 'PO' ? (
                        <span className="text-orange-600">
                          🔒 PO
                        </span>
                      ) : (item as any).source_reference && (item as any).source_reference.startsWith('TRF-') ? (
                        <span className="text-purple-600">
                          🔒 TRF
                        </span>
                      ) : (
                        <span className="text-green-600">
                          ✓ Open
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex gap-1">
                        {item.is_locked || (item as any).source_type === 'stock_opname_batch' || (item as any).source_type === 'PO' || ((item as any).source_reference && (item as any).source_reference.startsWith('TRF-')) ? (
                          <span className="text-xs text-gray-500 italic px-2 py-1" title={item.is_locked ? `Locked by ${item.locked_by_so}` : (item as any).source_type === 'PO' ? 'PO Protected' : (item as any).source_reference && (item as any).source_reference.startsWith('TRF-') ? 'Transfer Protected' : 'SO Protected'}>
                            {item.is_locked ? '🔒 Locked' : (item as any).source_type === 'PO' ? '🔒 Locked' : (item as any).source_reference && (item as any).source_reference.startsWith('TRF-') ? '🔒 Locked' : '🔒 Locked'}
                          </span>
                        ) : (
                          <>
                            {canPerformActionSync(userRole, 'gudang-final', 'edit') && (
                              <button
                                onClick={() => handleEdit(item)}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                                title="Edit"
                              >
                                <Edit size={12} />
                              </button>
                            )}
                            {canPerformActionSync(userRole, 'gudang-final', 'delete') && (
                              <button
                                onClick={() => handleDelete(item.order_no)}
                                className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </>
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

      <div className="bg-white p-1 rounded-lg shadow mt-1">
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-600">
            Showing {filteredAndSortedGudang.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredAndSortedGudang.length)} of {filteredAndSortedGudang.length} records
          </p>
          <div className="flex gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-200 text-xs"
            >
              First
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-200 text-xs"
            >
              Previous
            </button>
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 text-xs"
            >
              Next
            </button>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(totalPages)}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-200 text-xs"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GudangFinalPage() {
  return (
    <PageAccessControl pageName="gudang-final">
      <Layout>
        <Suspense fallback={<div className="p-4">Loading...</div>}>
          <GudangFinalContent />
        </Suspense>
      </Layout>
    </PageAccessControl>
  );
}