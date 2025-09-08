'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2, Download, Upload, ArrowRightLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import PageAccessControl from '../../components/PageAccessControl';
import { getBranchFilter, applyBranchFilter } from '@/src/utils/branchAccess';
import { canPerformActionSync, getUserRole, arePermissionsLoaded, reloadPermissions } from '@/src/utils/rolePermissions';
import { hasPageAccess } from '@/src/utils/permissionChecker';
import { insertWithAudit, updateWithAudit, deleteWithAudit } from '@/src/utils/auditTrail';
import { canViewColumn } from '@/src/utils/dbPermissions';

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
  source_type: string;
  source_reference: string;
  created_by: number;
  updated_by: number;
  updated_at?: string;
  transfer_id?: number;
  from_cabang?: string;
  to_cabang?: string;
  product_name?: string;
  branch_name?: string;
}

interface Product {
  id_product: number;
  product_name: string;
  category: string;
  sub_category?: string;
}

function GudangPageContent() {
  const router = useRouter();
  const [gudang, setGudang] = useState<Gudang[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
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
    source_reference: '',
    from_cabang: '',
    to_cabang: ''
  });
  const [userCabang, setUserCabang] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('user');
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [cabangList, setCabangList] = useState<{id_branch: number, kode_branch: string, nama_branch: string}[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permittedColumns, setPermittedColumns] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchUserInfo();
    
    // Only fetch data if user has access
    if (hasAccess === true) {
      fetchCabang();
      fetchGudang();
      fetchProducts();
    }
    
    // Force reload permissions if not loaded
    if (!arePermissionsLoaded()) {
      console.log('Permissions not loaded, reloading...');
      reloadPermissions();
    }
  }, [hasAccess]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Get columns based on permissions
  useEffect(() => {
    const loadPermittedColumns = async () => {
      if (gudang.length > 0) {
        const allColumns = Object.keys(gudang[0])
        const permitted = []
        
        for (const col of allColumns) {
          const hasPermission = await canViewColumn(userRole, 'gudang', col)
          if (hasPermission) {
            permitted.push(col)
          }
        }
        
        setPermittedColumns(permitted)
      }
    }
    
    loadPermittedColumns()
  }, [gudang, userRole])
  
  const visibleColumns = permittedColumns



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
      // Try to get user from localStorage first (for direct DB login)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUserCabang(userData.cabang || '');
        setUserRole(userData.role || 'user');
        setUserId(userData.id_user || null);
        setUserName(userData.nama_lengkap || 'Current User');
        
        // Force reload permissions after user info is set
        console.log('Forcing permission reload for role:', userData.role);
        await reloadPermissions();
        
        // Force clear permission cache and reload
        await reloadPermissions();
        
        // Check if user has any access to gudang page from database
        const pageAccess = await hasPageAccess(userData.role, 'gudang');
        console.log(`Database permission check for ${userData.role} on gudang:`, pageAccess);
        
        // Always set the access based on database result
        setHasAccess(pageAccess);
        return;
      }
      
      // Fallback to Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('cabang, role, nama_lengkap')
          .eq('id', user.id)
          .single();
        
        if (userData) {
          setUserCabang(userData.cabang || '');
          setUserRole(userData.role || 'user');
          setUserName(userData.nama_lengkap || 'Current User');
          
          // Force reload permissions after user info is set
          console.log('Forcing permission reload for role:', userData.role);
          await reloadPermissions();
          
          // Force clear permission cache and reload
          await reloadPermissions();
          
          // Check if user has any access to gudang page from database
          const pageAccess = await hasPageAccess(userData.role, 'gudang');
          console.log(`Database permission check for ${userData.role} on gudang:`, pageAccess);
          
          // Always set the access based on database result
          // Always set the access based on database result
          setHasAccess(pageAccess);
        }
      }
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
      
      // Apply branch filtering based on user role
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
      
      // Apply branch filter based on user access
      const branchFilter = await getBranchFilter();
      console.log('Branch filter applied:', branchFilter);
      console.log('Total records before filter:', gudangWithNames.length);
      
      if (branchFilter && branchFilter.length > 0) {
        gudangWithNames = gudangWithNames.filter(item => 
          branchFilter.includes(item.cabang) || branchFilter.includes(item.branch_name)
        );
        console.log('Records after branch filter:', gudangWithNames.length);
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
        .select('id_product, product_name, category, sub_category')
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
    
    // Only proceed if there's an actual transaction (either in or out)
    if (jumlahMasuk === 0 && jumlahKeluar === 0) {
      alert('Please enter either Jumlah Masuk or Jumlah Keluar');
      setSaving(false);
      return;
    }

    const submitData = {
      id_product: formData.id_product,
      tanggal: timestamp,
      jumlah_keluar: jumlahKeluar,
      jumlah_masuk: jumlahMasuk,
      total_gudang: previousBalance + jumlahMasuk - jumlahKeluar,
      nama_pengambil_barang: formData.nama_pengambil_barang || userName,
      cabang: formData.cabang,
      source_type: formData.source_type || 'manual',
      source_reference: formData.source_reference || null,
      created_by: userId ?? null,
      updated_by: userId ?? null,
      from_cabang: formData.from_cabang || null,
      to_cabang: formData.to_cabang || null
    };

    try {
      if (editingId) {
        // Use direct Supabase update instead of audit function to avoid schema issues
        const { error } = await supabase
          .from('gudang')
          .update(submitData)
          .eq('uniqueid_gudang', editingId);
        if (error) throw error;
        console.log('Updated gudang record:', editingId);
      } else {
        // Use direct Supabase insert instead of audit function to avoid schema issues
        const { data, error } = await supabase
          .from('gudang')
          .insert([submitData])
          .select();
        if (error) throw error;
        console.log('Inserted new gudang record:', data);
      }

      // Refresh data first to show the new entry immediately
      await fetchGudang();
      // Then recalculate affected records
      await recalculateAffectedRecords(formData.id_product, timestamp);
      // Refresh again after recalculation
      await fetchGudang();
      resetForm();
    } catch (error) {
      console.error('Error saving gudang:', error);
      const errorMessage = error instanceof Error ? error.message : 
                          error && typeof error === 'object' && 'message' in error ? (error as any).message :
                          JSON.stringify(error);
      alert(`Failed to save: ${errorMessage}`);
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
      source_reference: '',
      from_cabang: '',
      to_cabang: ''
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
      source_reference: item.source_reference || '',
      from_cabang: item.from_cabang || '',
      to_cabang: item.to_cabang || ''
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
      
      // Delete the gudang record using direct Supabase call
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
      
      // Get sub_category from products array
      const product = products.find(p => p.id_product === item.id_product);
      const itemSubCategory = product?.sub_category || '';
      const matchesSubCategory = !subCategoryFilter || itemSubCategory.toLowerCase().includes(subCategoryFilter.toLowerCase());
      
      return matchesSearch && matchesDate && matchesSubCategory;
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

  const uniqueSubCategories = [...new Set(
    gudang.map(g => {
      const product = products.find(p => p.id_product === g.id_product);
      return product?.sub_category || '';
    }).filter(Boolean)
  )];

  const handleExport = () => {
    if (gudang.length === 0) {
      showToast("No data to export", 'error')
      return
    }
    
    try {
      const header = visibleColumns.map(col => col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(",")
      const rows = gudang.map(row =>
        visibleColumns.map(col => `"${row[col as keyof Gudang] ?? ""}"`).join(",")
      )
      const csvContent = [header, ...rows].join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `gudang_export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast("CSV exported successfully", 'success')
    } catch (err) {
      showToast("Failed to export CSV", 'error')
    }
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
            
            // Only import if there's an actual transaction
            if (jumlahMasuk > 0 || jumlahKeluar > 0) {
              importData.push({
                id_product: product.id_product,
                tanggal: timestamp,
                jumlah_masuk: jumlahMasuk,
                jumlah_keluar: jumlahKeluar,
                total_gudang: 0,
                nama_pengambil_barang: namaPengambil,
                cabang: row['cabang'] || formData.cabang || 'DEFAULT',
                source_type: 'manual',
                source_reference: 'IMPORT',
                created_by: userId || null,
                updated_by: userId || null
              });
            }
          }
        }
        
        if (importData.length > 0) {
          const { error } = await supabase
            .from('gudang')
            .insert(importData);
          
          if (error) throw error;
          
          fetchGudang();
          alert(`✅ Imported ${importData.length} transactions successfully`);
        } else {
          alert('⚠️ No valid transactions found in the file');
        }
      } catch (err: any) {
        console.error('Import error:', err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

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

  // Block access if user doesn't have permission
  if (hasAccess === false) {
    return (
      <div className="p-2">
        <div className="bg-white p-4 rounded-lg shadow text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600 mb-4">
            You don't have permission to access the Warehouse page.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Current role: <span className="font-semibold">{userRole}</span>
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => router.back()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
            >
              Go Back
            </button>
            <button
              onClick={async () => {
                await reloadPermissions();
                window.location.reload();
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700"
            >
              Refresh Permissions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 md:p-2">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 flex items-center shadow-lg transform transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span className="mr-2">{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.message}
        </div>
      )}
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
            value={subCategoryFilter}
            onChange={(e) => setSubCategoryFilter(e.target.value)}
            className="border px-2 py-1 rounded-md text-xs"
          >
            <option value="">All Sub Categories</option>
            {uniqueSubCategories.map(subCategory => (
              <option key={subCategory} value={subCategory}>{subCategory}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1">
        {canPerformActionSync(userRole, 'gudang', 'create') && (
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  // Auto-fill user's name and branch when opening add form
                  setFormData(prev => ({ 
                    ...prev, 
                    nama_pengambil_barang: userName,
                    cabang: userCabang || '' 
                  }));
                }
              }}
              className="bg-blue-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Plus size={12} />Add
            </button>
          )}

          <button 
            onClick={recalculateAllTotals} 
            disabled={isRecalculating}
            className="bg-purple-600 text-white px-2 py-1 rounded-md text-xs disabled:opacity-50"
          >
            {isRecalculating ? 'Processing...' : 'Recalculate'}
          </button>

          {(userRole === 'super admin' || userRole === 'admin') && (
            <button onClick={handleExport} className="bg-green-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
              <Download size={12} />Export
            </button>
          )}
          
          {(userRole === 'super admin' || userRole === 'admin') && (
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


          {selectedItems.length > 0 && canPerformActionSync(userRole, 'gudang', 'delete') && (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 mb-2">
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
                          {product.product_name} ({product.sub_category || product.category})
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1">
              <input
                type="text"
                value={formData.nama_pengambil_barang}
                onChange={(e) => setFormData(prev => ({ ...prev, nama_pengambil_barang: e.target.value }))}
                className="border px-2 py-1 rounded-md text-xs"
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
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="w-3 h-3"
                  />
                </th>
                {visibleColumns.includes('order_no') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('order_no')}>
                  Order No {sortConfig?.key === 'order_no' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>}
                {visibleColumns.includes('tanggal') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal')}>
                  Date {sortConfig?.key === 'tanggal' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>}
                {visibleColumns.includes('tanggal') && <th className="px-1 py-1 text-left font-medium text-gray-700">
                  Time
                </th>}
                {visibleColumns.includes('branch_name') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('branch_name')}>
                  Branch {sortConfig?.key === 'branch_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>}
                {visibleColumns.includes('product_name') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product_name')}>
                  Product {sortConfig?.key === 'product_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>}
                {visibleColumns.includes('jumlah_masuk') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('jumlah_masuk')}>
                  In {sortConfig?.key === 'jumlah_masuk' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>}
                {visibleColumns.includes('jumlah_keluar') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('jumlah_keluar')}>
                  Out {sortConfig?.key === 'jumlah_keluar' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>}
                {visibleColumns.includes('total_gudang') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('total_gudang')}>
                  Total {sortConfig?.key === 'total_gudang' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>}
                {visibleColumns.includes('nama_pengambil_barang') && <th className="px-1 py-1 text-left font-medium text-gray-700">Pengambil</th>}
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
                    {visibleColumns.includes('order_no') && <td className="px-1 py-1 font-medium">
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
                    </td>}
                    {visibleColumns.includes('tanggal') && <td className="px-1 py-1">{item.tanggal.split('T')[0]}</td>}
                    {visibleColumns.includes('tanggal') && <td className="px-1 py-1">{new Date(item.tanggal).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</td>}
                    {visibleColumns.includes('branch_name') && <td className="px-1 py-1">{item.branch_name}</td>}
                    {visibleColumns.includes('product_name') && <td className="px-1 py-1">{item.product_name}</td>}
                    {visibleColumns.includes('jumlah_masuk') && <td className="px-1 py-1 text-green-600">{item.jumlah_masuk}</td>}
                    {visibleColumns.includes('jumlah_keluar') && <td className="px-1 py-1 text-red-600">{item.jumlah_keluar}</td>}
                    {visibleColumns.includes('total_gudang') && <td className="px-1 py-1 font-medium">{item.total_gudang}</td>}
                    {visibleColumns.includes('nama_pengambil_barang') && <td className="px-1 py-1">{item.nama_pengambil_barang}</td>}
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
                        {canPerformActionSync(userRole, 'gudang', 'edit', userId ?? undefined) && (
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit size={12} />
                          </button>
                        )}
                        {canPerformActionSync(userRole, 'gudang', 'delete', userId ?? undefined) && (
                          <button
                            onClick={() => handleDelete(item.uniqueid_gudang)}
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
    <PageAccessControl pageName="gudang">
      <Layout>
        <GudangPageContent />
      </Layout>
    </PageAccessControl>
  );
}