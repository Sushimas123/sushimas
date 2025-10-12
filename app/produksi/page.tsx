'use client';

import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import { canPerformActionSync, getUserRole } from '@/src/utils/rolePermissions';
import PageAccessControl from '../../components/PageAccessControl';
import { canViewColumn } from '@/src/utils/dbPermissions';
import { getBranchFilter } from '@/src/utils/branchAccess';

interface Produksi {
  id: number;
  production_no: string;
  tanggal_input: string;
  id_product: number;
  divisi: string;
  branch: string;
  jumlah_buat: number;
  konversi: number;
  total_konversi: number; // Generated column
  created_at?: number;    // integer di database
  created_by?: number;
  created_by_name?: string; // Virtual field dari JOIN
  updated_by?: number;
  product_name?: string;  // Virtual field dari JOIN
}

interface Product {
  id_product: number;
  product_name: string;
  sub_category: string;
  satuan_besar: number | null;
}

function ProduksiPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [produksi, setProduksi] = useState<Produksi[]>([]);
  const [wipProducts, setWipProducts] = useState<Product[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    searchTerm: '',
    dateFilter: '',
    divisiFilter: '',
    branchFilter: ''
  });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
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
  const [userRole, setUserRole] = useState<string>('guest');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [permittedColumns, setPermittedColumns] = useState<string[]>([]);

  // Debounced filter update
  const updateFilters = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

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

  // Load permitted columns based on user role and data
  useEffect(() => {
    const loadPermittedColumns = async () => {
      if (produksi.length > 0 && userRole) {
        const allColumns = Object.keys(produksi[0])
        const permitted = []
        
        
        for (const col of allColumns) {
          let hasPermission = false
          
          // Special handling for virtual/mapped columns
          if (col === 'product_name') {
            // Check permission for id_product instead since product_name is derived from it
            hasPermission = await canViewColumn(userRole, 'produksi', 'id_product')
          } else {
            // Regular column permission check
            hasPermission = await canViewColumn(userRole, 'produksi', col)
          }
          
          if (hasPermission) {
            permitted.push(col)
          }
        }
        
        setPermittedColumns(permitted)
      }
    }
    
    loadPermittedColumns()
  }, [produksi, userRole])
  
  const visibleColumns = permittedColumns

  // Memoized filtering and sorting
  const filteredData = useMemo(() => {
    let filtered = produksi.filter(item => {
      const matchesSearch = !filters.searchTerm || 
        item.production_no.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.product_name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.divisi.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.branch.toLowerCase().includes(filters.searchTerm.toLowerCase());
      
      const matchesDate = !filters.dateFilter || item.tanggal_input === filters.dateFilter;
      const matchesDivisi = !filters.divisiFilter || item.divisi === filters.divisiFilter;
      const matchesBranch = !filters.branchFilter || item.branch === filters.branchFilter;
      
      return matchesSearch && matchesDate && matchesDivisi && matchesBranch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof Produksi];
        const bVal = b[sortConfig.key as keyof Produksi];
        
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortConfig.direction === 'asc' ? -1 : 1;
        if (bVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [produksi, filters, sortConfig]);

  // Handle URL parameters from Analysis page
  useEffect(() => {
    const date = searchParams?.get('date');
    const branch = searchParams?.get('branch');
    const product = searchParams?.get('product');
    
    if (date || branch || product) {
      setFilters(prev => ({
        ...prev,
        ...(date && { dateFilter: date }),
        ...(branch && { branchFilter: branch }),
        ...(product && { searchTerm: product })
      }));
      
      showToast(`Filtered by: ${[date, branch, product].filter(Boolean).join(', ')}`, 'success');
    }
  }, [searchParams]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Skeleton loading component
  const TableSkeleton = () => (
    <div className="animate-pulse">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex space-x-4 py-3 border-b">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
      ))}
    </div>
  );



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

  const fetchProduksi = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      let produksiQuery = supabase.from('produksi').select('*, users!created_by(nama_lengkap)').order('tanggal_input', { ascending: false });
      
      // Parallel queries for better performance
      const queries = [
        supabase.from('nama_product').select('id_product, product_name')
      ];
      
      // Apply branch filter for non-admin users
      if (user.role !== 'super admin' && user.role !== 'admin') {
        const userBranchesQuery = supabase
          .from('user_branches')
          .select('kode_branch')
          .eq('id_user', user.id_user)
          .eq('is_active', true);
        
        const { data: userBranches } = await userBranchesQuery;
        
        if (userBranches && userBranches.length > 0) {
          const allowedBranchCodes = userBranches.map(b => b.kode_branch);
          const { data: branchNames } = await supabase
            .from('branches')
            .select('nama_branch')
            .in('kode_branch', allowedBranchCodes);
          
          if (branchNames && branchNames.length > 0) {
            const namaBranches = branchNames.map(b => b.nama_branch);
            produksiQuery = produksiQuery.in('branch', namaBranches);
          }
        }
      }
      
      queries.unshift(produksiQuery);
      const [produksiData, productsData] = await Promise.all(queries);

      if (produksiData.error) throw produksiData.error;
      if (productsData.error) throw productsData.error;
      
      const productMap = new Map(productsData.data?.map(p => [p.id_product, p.product_name]) || []);
      
      const produksiWithNames = (produksiData.data || []).map((item: any) => ({
        ...item,
        product_name: productMap.get(item.id_product) || '',
        created_by_name: item.users?.nama_lengkap || '-'
      }));
      
      setProduksi(produksiWithNames);
    } catch (error) {
      console.error('Error fetching produksi:', error);
      showToast('❌ Gagal memuat data produksi', 'error');
      setProduksi([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWipProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('nama_product')
        .select('id_product, product_name, sub_category, satuan_besar')
        .eq('category', 'WIP')
        .order('product_name');
      
      if (error) {
        console.error('Error fetching WIP products:', error);
        showToast('❌ Gagal memuat data produk', 'error');
        throw error;
      }
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
      
      if (error) {
        console.error('Error fetching sub categories:', error);
        showToast('❌ Gagal memuat data sub kategori', 'error');
        throw error;
      }
      
      const uniqueSubCategories = [...new Set(data?.map(item => item.sub_category).filter(Boolean))] as string[];
      setSubCategories(uniqueSubCategories);
    } catch (error) {
      console.error('Error fetching sub categories:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      let query = supabase
        .from('branches')
        .select('nama_branch, kode_branch')
        .eq('is_active', true)
        .order('nama_branch');
      
      // Apply branch filter for non-admin users
      if (user.role !== 'super admin' && user.role !== 'admin') {
        const { data: userBranches } = await supabase
          .from('user_branches')
          .select('kode_branch')
          .eq('id_user', user.id_user)
          .eq('is_active', true);
        
        const allowedBranches = userBranches?.map(b => b.kode_branch) || [];
        if (allowedBranches.length > 0) {
          query = query.in('kode_branch', allowedBranches);
        }
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching branches:', error);
        showToast('❌ Gagal memuat data cabang', 'error');
        throw error;
      }
      setBranches(data?.map(b => b.nama_branch) || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.production_no.trim() || !formData.divisi.trim() || !formData.branch.trim()) {
      showToast('❌ Production No, Divisi, dan Branch wajib diisi', 'error');
      return;
    }

    if (formData.id_product === 0) {
      showToast('❌ Product harus dipilih', 'error');
      return;
    }

    const jumlahBuat = parseFloat(formData.jumlah_buat as string) || 0;
    if (jumlahBuat <= 0) {
      showToast('❌ Jumlah buat harus lebih dari 0', 'error');
      return;
    }

    if (submitting) return; // Prevent double submission
    setSubmitting(true);

    const konversi = parseFloat(formData.konversi as string) || 0;
    
    const submitData = {
      production_no: formData.production_no,
      tanggal_input: formData.tanggal_input,
      id_product: formData.id_product,
      divisi: formData.divisi,
      branch: formData.branch,
      jumlah_buat: jumlahBuat,
      konversi: konversi
      // total_konversi removed - likely computed column
    };

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (editingId) {
        // Sanitize log data to prevent log injection
        const sanitizedData = {
          ...submitData,
          production_no: String(submitData.production_no).replace(/[\r\n\t]/g, ' '),
          divisi: String(submitData.divisi).replace(/[\r\n\t]/g, ' '),
          branch: String(submitData.branch).replace(/[\r\n\t]/g, ' ')
        };
        console.log('Updating produksi with ID:', editingId, 'Data:', sanitizedData);
        
        const { error } = await supabase
          .from('produksi')
          .update({
            ...submitData,
            updated_by: user.id_user
          })
          .eq('id', editingId);
        
        if (error) {
          throw new Error(error.message);
        }
        
        
        showToast('✅ Produksi berhasil diupdate!', 'success');
      } else {
        console.log('Inserting new produksi:', submitData);
        const { error } = await supabase
          .from('produksi')
          .insert({
            ...submitData,
            created_by: user.id_user,
            created_at: Math.floor(Date.now() / 1000)
          });
        
        if (error) {
          throw new Error(error.message);
        }
        
        showToast('✅ Produksi berhasil ditambahkan!', 'success');
      }

      // Reset form first
      resetForm();
      
      // Force refresh data
      console.log('Refreshing data...');
      await fetchProduksi();
      
      // Clear any filters that might hide the updated record
      if (editingId) {
        setFilters({
          searchTerm: '',
          dateFilter: '',
          divisiFilter: '',
          branchFilter: ''
        });
        setCurrentPage(1);
      }
      
    } catch (error) {
      console.error('Error saving produksi:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(`❌ Gagal menyimpan produksi: ${errorMessage}`, 'error');
    } finally {
      setSubmitting(false);
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
      await supabase.from('produksi').delete().eq('id', id);
      await fetchProduksi();
      showToast('✅ Produksi berhasil dihapus!', 'success');
    } catch (error) {
      console.error('Error deleting produksi:', error);
      showToast('❌ Gagal menghapus produksi', 'error');
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
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('produksi')
        .delete()
        .in('id', selectedItems);
      
      if (error) throw error;
      
      // Audit trail untuk bulk delete
      const { error: auditError } = await supabase
        .from('produksi_bulk_delete')
        .insert({
          deleted_ids: selectedItems,
          deleted_count: selectedItems.length
        });
      
      if (auditError) console.error('Audit error:', auditError);
      
      setSelectedItems([]);
      await fetchProduksi();
      showToast(`✅ ${selectedItems.length} produksi berhasil dihapus!`, 'success');
    } catch (error) {
      console.error('Error bulk deleting:', error);
      showToast('❌ Gagal menghapus produksi', 'error');
    } finally {
      setDeleting(false);
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

  // Use the memoized filtered data
  const filteredAndSortedProduksi = filteredData;

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
    
    setImporting(true);
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
          // Convert Excel serial date to JS Date (Excel uses 1900 date system with known bug)
          const excelEpoch = new Date(1900, 0, 1);
          // Adjust for Excel's incorrect leap year assumption (1900 was not a leap year)
          const days = tanggalInput - (tanggalInput > 59 ? 1 : 0); // Adjust for Excel's 1900 leap year bug
          const date = new Date(excelEpoch.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
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
        const { error: insertError } = await supabase
          .from('produksi')
          .insert({
            production_no: generateProductionNo(),
            tanggal_input: tanggalInput,
            id_product: product.id_product,
            divisi: divisi,
            branch: branch,
            jumlah_buat: jumlahBuat,
            konversi: product.satuan_besar || 1,
            total_konversi: jumlahBuat * (product.satuan_besar || 1)
          });
        
        if (insertError) {
          console.error('Insert error:', insertError);
          continue;
        }
        
        importCount++;
      }
      
      let message = `✅ Imported ${importCount} production records`;
      if (duplicateCount > 0) {
        message += ` (${duplicateCount} duplicates skipped)`;
      }
      showToast(message, 'success');
      
      if (importCount > 0) {
        await fetchProduksi();
      }
      
    } catch (error) {
      console.error('Import error:', error);
      showToast('❌ Failed to import Excel file', 'error');
    } finally {
      setImporting(false);
    }
    
    e.target.value = '';
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
        <div className="p-1 md:p-2">
        {toast && (
          <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {toast.message}
          </div>
        )}
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-sm font-bold text-gray-800">Production</h1>
        </div>

        <div className="bg-white p-1 rounded-lg shadow mb-1">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-2">
            <input
              type="text"
              placeholder="Search..."
              value={filters.searchTerm}
              onChange={(e) => updateFilters('searchTerm', e.target.value)}
              className="border px-2 py-1 rounded-md text-xs"
            />
            <input
              type="date"
              value={filters.dateFilter}
              onChange={(e) => updateFilters('dateFilter', e.target.value)}
              className="border px-2 py-1 rounded-md text-xs"
            />
            <select
              value={filters.divisiFilter}
              onChange={(e) => updateFilters('divisiFilter', e.target.value)}
              className="border px-2 py-1 rounded-md text-xs"
            >
              <option value="">All Divisi</option>
              {uniqueDivisi.map(divisi => (
                <option key={divisi} value={divisi}>{divisi}</option>
              ))}
            </select>
            <select
              value={filters.branchFilter}
              onChange={(e) => updateFilters('branchFilter', e.target.value)}
              className="border px-2 py-1 rounded-md text-xs"
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1">
            {(userRole === 'super admin' || userRole === 'admin') && (
              <button onClick={handleExport} className="bg-green-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
                <Download size={12} />Export
              </button>
            )}
            {(userRole === 'super admin' || userRole === 'admin') && (
              <label className={`bg-orange-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1 cursor-pointer hover:bg-orange-700 ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Upload size={12} />{importing ? 'Importing...' : 'Import'}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                  disabled={importing}
                  className="hidden"
                />
              </label>
            )}
            {selectedItems.length > 0 && canPerformActionSync(userRole, 'produksi', 'delete') && (
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="bg-red-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={12} />{deleting ? 'Deleting...' : `Delete (${selectedItems.length})`}
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
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="bg-green-600 text-white px-3 py-1 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : (editingId ? 'Update' : 'Save')}
                </button>
                <button type="button" onClick={resetForm} className="bg-gray-600 text-white px-3 py-1 rounded-md text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}



        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 sticky top-0 z-20">
                <tr>
                  <th className="px-1 py-1 text-center font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === paginatedProduksi.length && paginatedProduksi.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  {visibleColumns.includes('production_no') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('production_no')}>
                    Production No {sortConfig?.key === 'production_no' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {visibleColumns.includes('tanggal_input') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal_input')}>
                    Date {sortConfig?.key === 'tanggal_input' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {visibleColumns.includes('divisi') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('divisi')}>
                    Divisi {sortConfig?.key === 'divisi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {visibleColumns.includes('branch') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('branch')}>
                    Branch {sortConfig?.key === 'branch' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {visibleColumns.includes('product_name') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product_name')}>
                    Product {sortConfig?.key === 'product_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {visibleColumns.includes('jumlah_buat') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('jumlah_buat')}>
                    Qty {sortConfig?.key === 'jumlah_buat' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {visibleColumns.includes('konversi') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('konversi')}>
                    Konversi {sortConfig?.key === 'konversi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {visibleColumns.includes('total_konversi') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('total_konversi')}>
                    Total {sortConfig?.key === 'total_konversi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  {visibleColumns.includes('created_by_name') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('created_by_name')}>
                    Created By {sortConfig?.key === 'created_by_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>}
                  <th className="px-1 py-1 text-left font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedProduksi.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 2} className="px-1 py-2 text-center text-gray-500 text-xs">
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
                      {visibleColumns.includes('production_no') && <td className="px-1 py-1 font-medium">
                        <button
                          onClick={() => router.push(`/produksi_detail?search=${item.production_no}`)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {item.production_no}
                        </button>
                      </td>}
                      {visibleColumns.includes('tanggal_input') && <td className="px-1 py-1">{item.tanggal_input}</td>}
                      {visibleColumns.includes('divisi') && <td className="px-1 py-1">{item.divisi}</td>}
                      {visibleColumns.includes('branch') && <td className="px-1 py-1">{item.branch}</td>}
                      {visibleColumns.includes('product_name') && <td className="px-1 py-1">{item.product_name}</td>}
                      {visibleColumns.includes('jumlah_buat') && <td className="px-1 py-1">{item.jumlah_buat}</td>}
                      {visibleColumns.includes('konversi') && <td className="px-1 py-1">{item.konversi}</td>}
                      {visibleColumns.includes('total_konversi') && <td className="px-1 py-1 font-medium">{item.total_konversi}</td>}
                      {visibleColumns.includes('created_by_name') && <td className="px-1 py-1">{item.created_by_name}</td>}
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
  );
}

export default function ProduksiPage() {
  return (
    <Layout>
      <PageAccessControl pageName="produksi">
        <Suspense fallback={<div className="p-4">Loading...</div>}>
          <ProduksiPageContent />
        </Suspense>
      </PageAccessControl>
    </Layout>
  );
}