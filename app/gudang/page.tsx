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
import { insertWithAudit, updateWithAudit, hardDeleteWithAudit } from '@/src/utils/auditTrail';
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
  nama_pengambil_barang: string;
  cabang: string;
  source_type: string;
  source_reference: string;
  created_by: number;
  updated_by: number;
  updated_at?: string;
  product_name?: string;
  branch_name?: string;
  is_locked?: boolean;
  locked_by_so?: string;
  locked_date?: string;
}

interface Product {
  id_product: number;
  product_name: string;
  category: string;
  sub_category?: string;
}

function GudangPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gudang, setGudang] = useState<Gudang[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
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

  useEffect(() => {
    fetchUserInfo();
    
    if (hasAccess === true) {
      fetchCabang();
      fetchGudang();
      fetchProducts();
      fetchStockAlerts();
    }
    
    if (!arePermissionsLoaded()) {
      reloadPermissions();
    }
  }, [hasAccess]);

  // Handle URL parameters from Analysis page
  useEffect(() => {
    const date = searchParams.get('date');
    const branch = searchParams.get('branch');
    const product = searchParams.get('product');
    
    if (date || branch || product) {
      if (date) setDateFilter(date);
      if (branch) setBranchFilter(branch);
      if (product) setSearchTerm(product);
      
      showToast(`Filtered by: ${[date, branch, product].filter(Boolean).join(', ')}`, 'success');
    }
  }, [searchParams]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchStockAlerts = async () => {
    try {
      // Try new function first, fallback to original if it fails
      let { data, error } = await supabase.rpc('get_stock_alerts_with_po_status');
      
      if (error) {
        const result = await supabase.rpc('get_products_needing_po');
        data = result.data;
        error = result.error;
        
        // Add default PO status fields for compatibility
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
    
    // Return enhanced status based on PO status
    if (alert.po_status === 'Pending') return 'PO_PENDING';
    if (alert.po_status === 'Sedang diproses') return 'ON_ORDER';
    return alert.urgency_level;
  };

  const handleCreatePOFromStock = (idProduct: number, cabang: string) => {
    router.push('/purchaseorder/stock-alert');
  };

  useEffect(() => {
    const loadPermittedColumns = async () => {
      if (gudang.length > 0 && userRole && userRole !== 'user') {
        const allColumns = Object.keys(gudang[0])
        const permitted = []
      
        
        // Get raw permissions to debug
        const { getPermissions } = await import('@/src/utils/dbPermissions')
        const rawPermissions = await getPermissions(userRole)

        
        for (const col of allColumns) {
          let hasPermission = false
          
          // Essential columns that should always be visible
          if (col === 'order_no') {
            hasPermission = true // Always allow order_no column
          }
          // Special handling for virtual/mapped columns
          else if (col === 'product_name') {
            // Check permission for id_product instead since product_name is derived from it
            hasPermission = await canViewColumn(userRole, 'gudang', 'id_product')
          } else if (col === 'branch_name') {
            // Check permission for cabang instead since branch_name is derived from it
            hasPermission = await canViewColumn(userRole, 'gudang', 'cabang')
          } else {
            // Regular column permission check
            hasPermission = await canViewColumn(userRole, 'gudang', col)
          }
          
          if (hasPermission) {
            permitted.push(col)
          }
        }
        
        setPermittedColumns(permitted)
      }
    }
    
    loadPermittedColumns()
  }, [gudang, userRole])
  
  // Ensure we always have at least basic columns visible
  const visibleColumns = permittedColumns.length > 0 ? permittedColumns : ['order_no', 'tanggal', 'product_name']

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
        
        await reloadPermissions();
        const pageAccess = await hasPageAccess(userData.role, 'gudang');
        setHasAccess(pageAccess);
        return;
      }
      
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
          
          await reloadPermissions();
          const pageAccess = await hasPageAccess(userData.role, 'gudang');
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
      const [gudangData, productsData, branchesData] = await Promise.all([
        supabase.from('gudang').select('*').order('tanggal', { ascending: false }),
        supabase.from('nama_product').select('id_product, product_name'),
        supabase.from('branches').select('kode_branch, nama_branch')
      ]);

      if (gudangData.error) throw gudangData.error;
      
      const productMap = new Map(productsData.data?.map(p => [p.id_product, p.product_name]) || []);
      const branchMap = new Map(branchesData.data?.map(b => [b.kode_branch, b.nama_branch]) || []);
      
      let gudangWithNames = (gudangData.data || []).map((item: any) => ({
        ...item,
        product_name: productMap.get(item.id_product) || '',
        branch_name: branchMap.get(item.cabang) || item.cabang
      }));
      
      const branchFilter = await getBranchFilter();
      if (branchFilter && branchFilter.length > 0) {
        gudangWithNames = gudangWithNames.filter(item => 
          branchFilter.includes(item.cabang) || branchFilter.includes(item.branch_name)
        );
      }
      
      setGudang(gudangWithNames);
    } catch (error) {
      console.error('Error fetching gudang:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (selectedBranch?: string) => {
    try {
      let query = supabase
        .from('nama_product')
        .select(`
          id_product, 
          product_name, 
          category, 
          sub_category,
          product_branches(branch_code)
        `)
        .order('product_name');
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Filter produk berdasarkan cabang yang dipilih
      let filteredProducts = data || [];
      
      if (selectedBranch) {
        filteredProducts = data?.filter(product => 
          product.product_branches?.some((pb: any) => pb.branch_code === selectedBranch)
        ) || [];
      }
      
      setProducts(filteredProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const getBaselineFromLockedRecord = async (idProduct: number, cabang: string, targetDate: string) => {
    try {
      // Cari record terkunci TERAKHIR sebelum tanggal target
      const { data: lockedRecord, error } = await supabase
        .from('gudang')
        .select('total_gudang, tanggal')
        .eq('id_product', idProduct)
        .eq('cabang', cabang)
        .lte('tanggal', targetDate)
        .eq('is_locked', true)
        .order('tanggal', { ascending: false })
        .order('order_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      return lockedRecord ? {
        baseline: lockedRecord.total_gudang,
        lockedDate: lockedRecord.tanggal
      } : null;
    } catch (error) {
      console.error('Error getting baseline from locked record:', error);
      return null;
    }
  };

  const calculateTotalGudang = async (idProduct: number, tanggal: string, cabang: string) => {
    try {
      // Dapatkan SEMUA record sebelum tanggal yang diberikan dengan urutan kronologis
      const { data: previousRecords, error } = await supabase
        .from('gudang')
        .select('*')
        .eq('id_product', idProduct)
        .eq('cabang', cabang)
        .lt('tanggal', tanggal)
        .order('tanggal', { ascending: true })
        .order('order_no', { ascending: true });

      if (error) throw error;
      if (!previousRecords || previousRecords.length === 0) return 0;

      // Hitung running total dengan checkpoint system
      let runningTotal = 0;
      
      for (const record of previousRecords) {
        if (record.is_locked) {
          runningTotal = record.total_gudang; // Checkpoint
        } else {
          runningTotal = runningTotal + record.jumlah_masuk - record.jumlah_keluar;
        }
      }

      return runningTotal;
    } catch (error) {
      console.error('Error calculating total gudang:', error);
      return 0;
    }
  };

  const recalculateAffectedRecords = async (idProduct: number, fromDate: string, cabang: string) => {
    try {
      // Dapatkan SEMUA record untuk produk+cabang ini dengan urutan KRONOLOGIS
      const { data: allRecords, error } = await supabase
        .from('gudang')
        .select('*')
        .eq('id_product', idProduct)
        .eq('cabang', cabang)
        .order('tanggal', { ascending: true })
        .order('order_no', { ascending: true });

      if (error) throw error;
      if (!allRecords || allRecords.length === 0) return;

      // Gunakan LOGIKA CHECKPOINT yang sama seperti recalculateAllTotals
      let runningTotal = 0;
      let foundStart = false;

      for (const record of allRecords) {
        // Jika kita belum mencapai start date, hitung sampai sana dulu
        if (!foundStart && record.tanggal < fromDate) {
          if (record.is_locked) {
            runningTotal = record.total_gudang; // Checkpoint
          } else {
            runningTotal = runningTotal + record.jumlah_masuk - record.jumlah_keluar;
          }
          continue;
        }

        foundStart = true;

        // Setelah start date, proses dengan checkpoint system
        if (record.is_locked) {
          runningTotal = record.total_gudang; // Checkpoint
          continue;
        }

        // Hitung untuk record tidak terkunci
        runningTotal = runningTotal + record.jumlah_masuk - record.jumlah_keluar;
        
        // Update hanya jika berbeda
        if (runningTotal !== record.total_gudang) {
          const { error: updateError } = await supabase
            .from('gudang')
            .update({ total_gudang: runningTotal })
            .eq('order_no', record.order_no);
          
          if (updateError) throw updateError;
        }
      }
    } catch (error) {
      console.error('Error recalculating affected records:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_product) return;

    setSaving(true);

    const jumlahMasuk = parseFloat(formData.jumlah_masuk as string) || 0;
    const jumlahKeluar = parseFloat(formData.jumlah_keluar as string) || 0;
    
    const timestamp = `${formData.tanggal}T${formData.waktu}:00.000Z`;
    
    // Validasi lock hanya untuk record baru (bukan edit)
    if (!editingId) {
      // Check if input timestamp is BEFORE any locked record
      const { data: lockedRecords, error: lockCheckError } = await supabase
        .from('gudang')
        .select('tanggal, locked_by_so')
        .eq('id_product', formData.id_product)
        .eq('cabang', formData.cabang)
        .gt('tanggal', timestamp)
        .eq('is_locked', true)
        .order('tanggal', { ascending: true })
        .limit(1);

      if (lockCheckError) {
        console.error('Error checking locked records:', lockCheckError);
        setSaving(false);
        return;
      }

      if (lockedRecords && lockedRecords.length > 0) {
        const lockedRecord = lockedRecords[0];
        alert(`❌ Cannot add transaction: Period is locked by ${lockedRecord.locked_by_so} starting from ${lockedRecord.tanggal.split('T')[0]}`);
        setSaving(false);
        return;
      }
    }
    
    if (jumlahMasuk === 0 && jumlahKeluar === 0) {
      alert('Please enter either Jumlah Masuk or Jumlah Keluar');
      setSaving(false);
      return;
    }

    // Get previous balance for this product, branch and timestamp
    const previousBalance = await calculateTotalGudang(formData.id_product, timestamp, formData.cabang);

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
      updated_by: userId ?? null
    };

    try {
      if (editingId) {
        const { error } = await updateWithAudit('gudang', submitData, { order_no: editingId });
        if (error) throw error;
        console.log('Updated gudang record:', editingId);
      } else {
        const { data, error } = await insertWithAudit('gudang', submitData);
        if (error) throw error;
        console.log('Inserted new gudang record:', data);
      }

      // Refresh data first to show the new entry immediately
      await fetchGudang();
      // Then recalculate affected records for this product and branch
      await recalculateAffectedRecords(formData.id_product, timestamp, formData.cabang);
      // Refresh again after recalculation
      await fetchGudang();
      resetForm();
      showToast(editingId ? '✅ Record updated successfully' : '✅ Record added successfully', 'success');
    } catch (error) {
      console.error('Error saving gudang:', error);
      const errorMessage = error instanceof Error ? error.message : 
                          error && typeof error === 'object' && 'message' in error ? (error as any).message :
                          JSON.stringify(error);
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
    
    // Reset product filter to show all products
    fetchProducts();
  };

  const handleEdit = async (item: Gudang) => {
    if (item.is_locked) {
      alert(`❌ Cannot edit: Record is locked by ${item.locked_by_so}`);
      return;
    }
    
    if (item.source_type === 'stock_opname_batch') {
      alert('❌ Cannot edit: This record is from Stock Opname batch');
      return;
    }
    
    if ((item as any).source_reference && (item as any).source_reference.startsWith('TRF-')) {
      alert('❌ Cannot edit: This record is from Transfer Barang');
      return;
    }

    // Check if there are locked records after this timestamp
    const { data: lockedAfter } = await supabase
      .from('gudang')
      .select('tanggal, locked_by_so')
      .eq('id_product', item.id_product)
      .eq('cabang', item.cabang)
      .gt('tanggal', item.tanggal)
      .eq('is_locked', true)
      .order('tanggal', { ascending: true })
      .limit(1);
    
    if (lockedAfter && lockedAfter.length > 0) {
      const lockDate = new Date(lockedAfter[0].tanggal).toLocaleDateString();
      alert(`❌ Cannot edit: Period is locked by ${lockedAfter[0].locked_by_so} starting from ${lockDate}`);
      return;
    }

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
      const { data: gudangData } = await supabase
        .from('gudang')
        .select('source_type, source_reference, is_locked, locked_by_so, id_product, cabang, tanggal')
        .eq('order_no', id)
        .single();
      
      if (!gudangData) {
        alert('❌ Record not found');
        return;
      }
      
      if (gudangData.is_locked) {
        alert(`❌ Cannot delete: Record is locked by ${gudangData.locked_by_so}`);
        return;
      }
      
      if (gudangData.source_type === 'stock_opname_batch') {
        alert('❌ Cannot delete: This record is from Stock Opname batch');
        return;
      }
      
      if (gudangData.source_reference && gudangData.source_reference.startsWith('TRF-')) {
        alert('❌ Cannot delete: This record is from Transfer Barang');
        return;
      }

      // Check if there are locked records after this timestamp
      const { data: lockedAfter } = await supabase
        .from('gudang')
        .select('tanggal, locked_by_so')
        .eq('id_product', gudangData.id_product)
        .eq('cabang', gudangData.cabang)
        .gt('tanggal', gudangData.tanggal)
        .eq('is_locked', true)
        .order('tanggal', { ascending: true })
        .limit(1);
      
      if (lockedAfter && lockedAfter.length > 0) {
        const lockDate = new Date(lockedAfter[0].tanggal).toLocaleDateString();
        alert(`❌ Cannot delete: Period is locked by ${lockedAfter[0].locked_by_so} starting from ${lockDate}`);
        return;
      }
      
      const { error } = await hardDeleteWithAudit('gudang', { order_no: id });
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
      
      const matchesBranch = !branchFilter || 
        (item.branch_name || '').toLowerCase().includes(branchFilter.toLowerCase()) ||
        (item.cabang || '').toLowerCase().includes(branchFilter.toLowerCase());
      
      const product = products.find(p => p.id_product === item.id_product);
      const itemSubCategory = product?.sub_category || '';
      const matchesSubCategory = !subCategoryFilter || itemSubCategory.toLowerCase().includes(subCategoryFilter.toLowerCase());
      
      return matchesSearch && matchesDate && matchesBranch && matchesSubCategory;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        // Handle special sorting cases
        if (sortConfig.key === 'stock_status') {
          aValue = getStockStatus(a.id_product, a.cabang);
          bValue = getStockStatus(b.id_product, b.cabang);
        } else if (sortConfig.key === 'source_type') {
          aValue = (a as any).source_type || 'manual';
          bValue = (b as any).source_type || 'manual';
        } else if (sortConfig.key === 'is_locked') {
          aValue = a.is_locked ? 'locked' : 'open';
          bValue = b.is_locked ? 'locked' : 'open';
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

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedGudang.map(item => item.order_no));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectItem = (id: number) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleBulkDelete = async () => {
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
      
      // Check if there are locked records after this timestamp
      const { data: lockedAfter } = await supabase
        .from('gudang')
        .select('tanggal')
        .eq('id_product', item.id_product)
        .eq('cabang', item.cabang)
        .gt('tanggal', item.tanggal)
        .eq('is_locked', true)
        .limit(1);
      
      if (lockedAfter && lockedAfter.length > 0) {
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
        await hardDeleteWithAudit('gudang', { order_no: id });
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
  };

  const recalculateAllTotals = async () => {
    setLoading(true);
    
    try {
      // Get all records ordered by date and order_no
      const { data: allRecords } = await supabase
        .from('gudang')
        .select('*')
        .order('tanggal', { ascending: true })
        .order('order_no', { ascending: true });

      if (!allRecords) return;

      // Group by product AND branch
      const groupedByProductAndBranch = allRecords.reduce((acc, record: any) => {
        const key = `${record.id_product}_${record.cabang}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(record);
        return acc;
      }, {} as Record<string, any[]>);

      // Recalculate each product-branch combination with checkpoint system
      for (const [key, records] of Object.entries(groupedByProductAndBranch)) {
        let runningTotal = 0;
        
        // Sort records by date and order_no to ensure correct chronological order
        const sortedRecords = (records as any[]).sort((a: any, b: any) => {
          const dateA = new Date(a.tanggal).getTime();
          const dateB = new Date(b.tanggal).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return (a.order_no || 0) - (b.order_no || 0);
        });
        
        for (const record of sortedRecords) {
          // If record is locked, use it as checkpoint
          if (record.is_locked) {
            runningTotal = record.total_gudang;
            continue;
          }

          // Calculate new total for unlocked records
          runningTotal = runningTotal + (record as any).jumlah_masuk - (record as any).jumlah_keluar;
          
          // Only update unlocked records
          await supabase
            .from('gudang')
            .update({ total_gudang: runningTotal })
            .eq('order_no', (record as any).order_no);
        }
      }
      
      await fetchGudang();
      showToast('✅ Recalculation completed (locked records preserved)', 'success');
    } catch (error) {
      console.error('Error recalculating:', error);
      showToast('❌ Recalculation failed', 'error');
    } finally {
      setLoading(false);
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
          
          if (typeof tanggal === 'number') {
            const excelDate = XLSX.SSF.parse_date_code(tanggal);
            if (excelDate) {
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
            const timestamp = tanggal.includes('T') ? tanggal : `${tanggal}T${new Date().toTimeString().slice(0, 8)}.000Z`;
            
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
          for (const data of importData) {
            const { error } = await insertWithAudit('gudang', data);
            if (error) throw error;
          }
          
          fetchGudang();
          showToast(`✅ Imported ${importData.length} transactions successfully`, 'success');
        } else {
          showToast('⚠️ No valid transactions found in the file', 'error');
        }
      } catch (err: any) {
        console.error('Import error:', err.message);
        showToast('❌ Failed to import data', 'error');
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
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 flex items-center shadow-lg transform transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span className="mr-2">{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.message}
        </div>
      )}
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-sm font-bold text-gray-800">Gudang</h1>
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
            disabled={loading}
            className="bg-purple-600 text-white px-2 py-1 rounded-md text-xs disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Recalculate'}
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
                onChange={(e) => {
                  const newBranch = e.target.value;
                  setFormData(prev => ({ ...prev, cabang: newBranch }));
                  
                  // Reset product selection and search
                  setFormData(prev => ({ ...prev, id_product: 0 }));
                  setProductSearch('');
                  
                  // Fetch products filtered by selected branch
                  if (newBranch) {
                    fetchProducts(newBranch);
                    const branchName = cabangList.find(c => c.kode_branch === newBranch)?.nama_branch;
                    showToast(`✅ Cabang ${branchName} dipilih - produk difilter otomatis`, "success");
                  } else {
                    fetchProducts(); // Fetch all products if no branch selected
                  }
                }}
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
                    {formData.cabang && (
                      <div className="px-2 py-1 bg-blue-50 border-b text-xs text-blue-800">
                        📍 {cabangList.find(c => c.kode_branch === formData.cabang)?.nama_branch} - {filteredProducts.length} produk tersedia
                      </div>
                    )}
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
                      <div className="px-2 py-1 text-xs text-gray-500">
                        {formData.cabang 
                          ? (
                            <div>
                              <p>Tidak ada produk yang terdaftar untuk cabang {cabangList.find(c => c.kode_branch === formData.cabang)?.nama_branch}</p>
                              <p className="text-xs mt-1 text-gray-400">Pastikan produk sudah dikonfigurasi di halaman Product Management</p>
                            </div>
                          )
                          : 'No products found'
                        }
                      </div>
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
                {visibleColumns.includes('tanggal') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal')}>
                  Time {sortConfig?.key === 'tanggal' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
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
                <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('stock_status')}>
                  Stock Alert {sortConfig?.key === 'stock_status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                {visibleColumns.includes('nama_pengambil_barang') && <th className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('nama_pengambil_barang')}>
                  Pengambil {sortConfig?.key === 'nama_pengambil_barang' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>}
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
                  <td colSpan={14} className="px-1 py-2 text-center text-gray-500 text-xs">
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
                          onChange={() => handleSelectItem(item.order_no)}
                          className="w-3 h-3"
                        />
                      )}
                    </td>
                    {visibleColumns.includes('order_no') && <td className="px-1 py-1 font-medium">
                      {(item as any).source_type === 'stock_opname_batch' ? (
                        <a 
                          href={`/stock_opname_batch?highlight=${(item as any).source_reference?.replace('BATCH-', '')}`}
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
                    {visibleColumns.includes('product_name') && <td className="px-1 py-1">{sanitizeText(item.product_name)}</td>}
                    {visibleColumns.includes('jumlah_masuk') && <td className="px-1 py-1 text-green-600">{item.jumlah_masuk}</td>}
                    {visibleColumns.includes('jumlah_keluar') && <td className="px-1 py-1 text-red-600">{item.jumlah_keluar}</td>}
                    {visibleColumns.includes('total_gudang') && (
                      <td className="px-1 py-1 font-medium">
                        {item.total_gudang}
                      </td>
                    )}
                    <td className="px-1 py-1">
                      {getStockStatus(item.id_product, item.cabang) !== 'OK' && (
                        <button
                          onClick={() => handleCreatePOFromStock(item.id_product, item.cabang)}
                          className={`px-1 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${
                            getStockStatus(item.id_product, item.cabang) === 'PO_PENDING' 
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' :
                            getStockStatus(item.id_product, item.cabang) === 'ON_ORDER'
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                            getStockStatus(item.id_product, item.cabang) === 'CRITICAL' 
                              ? ' text-red-800 hover:bg-red-200' 
                              : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                          }`}
                          title={`Stock Alert: ${getStockStatus(item.id_product, item.cabang)} - Click to go to Stock Alert PO page`}
                        >
                          {getStockStatus(item.id_product, item.cabang) === 'PO_PENDING' ? '⏳' :
                           getStockStatus(item.id_product, item.cabang) === 'ON_ORDER' ? '🚚' :
                           getStockStatus(item.id_product, item.cabang) === 'CRITICAL' ? '🛒' : '🛒 LOW'}
                        </button>
                      )}
                    </td>
                    {visibleColumns.includes('nama_pengambil_barang') && <td className="px-1 py-1">{sanitizeText(item.nama_pengambil_barang)}</td>}
                    <td className="px-1 py-1">
                      {(item as any).source_type === 'stock_opname_batch' ? (
                        <span className="px-1 py-0.5 text-black-800 rounded text-xs font-semibold">
                          📊 SO
                        </span>
                      ) : (item as any).source_type === 'PO' && (item as any).source_reference ? (
                        <a 
                          href={`/purchaseorder?search=${(item as any).source_reference}`}
                          className="px-1 py-0.5 text-black-800 rounded text-xs font-semibold hover:bg-blue-200 cursor-pointer"
                          title="View Purchase Order"
                        >
                          📋 {(item as any).source_reference}
                        </a>
                      ) : (item as any).source_reference && (item as any).source_reference.startsWith('TRF-') ? (
                        <a 
                          href={`/transfer-barang?search=${(item as any).source_reference}`}
                          className="px-1 py-0.5 text-black-800 rounded text-xs font-semibold hover:bg-purple-200 cursor-pointer"
                          title="View Transfer Barang"
                        >
                          🔄 {(item as any).source_reference}
                        </a>
                      ) : (
                        <span className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      {item.is_locked ? (
                        <span className="px-1 py-0.5 bg-red-100 text-red-800 rounded text-xs font-semibold" title={`Locked by ${item.locked_by_so}`}>
                          🔒 Locked
                        </span>
                      ) : (item as any).source_type === 'stock_opname_batch' ? (
                        <span className="px-1 py-0.5 text-black-800 rounded text-xs font-semibold">
                          🔒
                        </span>
                      ) : (item as any).source_type === 'PO' ? (
                        <span className="px-1 py-0.5 text-black-800 rounded text-xs font-semibold">
                          🔒
                        </span>
                      ) : (item as any).source_reference && (item as any).source_reference.startsWith('TRF-') ? (
                        <span className="px-1 py-0.5 text-purple-800 rounded text-xs font-semibold">
                          🔒
                        </span>
                      ) : (
                        <span className="px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs">
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
        <Suspense fallback={<div className="p-4">Loading...</div>}>
          <GudangPageContent />
        </Suspense>
      </Layout>
    </PageAccessControl>
  );
}