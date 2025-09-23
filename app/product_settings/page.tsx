'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2, Download, Upload, RefreshCw, Filter, X, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import PageAccessControl from '../../components/PageAccessControl';

// Helper function to convert text to Title Case
const toTitleCase = (str: any) => {
  if (str === null || str === undefined) return ""
  return String(str)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

interface ProductSetting {
  id_product: number;
  product_name: string;
  category: string;
  tolerance_percentage: number;
  branch_settings: BranchSetting[];
}

interface BranchSetting {
  id_setting?: number;
  id_branch: number;
  branch_name: string;
  safety_stock: number;
  reorder_point: number;
}

interface Product {
  id_product: number;
  product_name: string;
  category: string;
}

interface Branch {
  id_branch: number;
  nama_branch: string;
}

export default function ProductSettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<ProductSetting[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    id_product: 0,
    tolerance_percentage: 5,
    branch_settings: [] as BranchSetting[]
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: number | null}>({show: false, id: null});
  const [saving, setSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mobile specific states
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Check if mobile on mount and on resize
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  useEffect(() => {
    fetchData();
    fetchProducts();
    fetchBranches();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('nama_product')
        .select('id_product, product_name, category')
        .order('product_name');

      if (productsError) throw productsError;

      // Fetch branch settings with tolerance
      const { data: branchSettingsData, error: branchSettingsError } = await supabase
        .from('product_branch_settings')
        .select(`
          id_setting,
          id_product,
          id_branch,
          safety_stock,
          reorder_point,
          tolerance_percentage,
          branches(nama_branch)
        `);

      if (branchSettingsError) throw branchSettingsError;

      
      const formattedData = productsData?.map(product => {
        const branchSettings = branchSettingsData?.filter(bs => bs.id_product === product.id_product) || [];
        
        // Get tolerance from first branch setting or default to 5
        const toleranceValue = branchSettings.length > 0 ? branchSettings[0].tolerance_percentage : 5;
        
        
        return {
          id_product: product.id_product,
          product_name: product.product_name,
          category: product.category,
          tolerance_percentage: toleranceValue !== null && toleranceValue !== undefined ? Number(toleranceValue) : 5,
          branch_settings: branchSettings.map((setting: any) => ({
            id_setting: setting.id_setting,
            id_branch: setting.id_branch,
            branch_name: setting.branches.nama_branch,
            safety_stock: setting.safety_stock,
            reorder_point: setting.reorder_point
          }))
        };
      }) || [];
      
      setData(formattedData);
    } catch (error) {
      showToast('Failed to fetch data', 'error');
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
          product_branches(branch_code)
        `)
        .order('product_name');
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Filter produk berdasarkan cabang yang dipilih
      let filteredProducts = data || [];
      
      if (selectedBranch) {
        // Convert branch ID to branch code for filtering
        const selectedBranchData = branches.find(b => b.id_branch.toString() === selectedBranch);
        if (selectedBranchData) {
          // Get branch code from branches table
          const { data: branchData } = await supabase
            .from('branches')
            .select('kode_branch')
            .eq('id_branch', selectedBranchData.id_branch)
            .single();
          
          if (branchData) {
            filteredProducts = data?.filter(product => 
              product.product_branches?.some((pb: any) => pb.branch_code === branchData.kode_branch)
            ) || [];
          }
        }
      }
      
      setProducts(filteredProducts);
    } catch (error) {
      // Error fetching products
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id_branch, nama_branch')
        .eq('is_active', true)
        .order('nama_branch');
      
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      // Error fetching branches
    }
  };

  const handleProductSelect = (productId: number) => {
    const product = products.find(p => p.id_product === productId);
    if (!product) return;

    const existingData = data.find(d => d.id_product === productId);
    
    setFormData({
      id_product: productId,
      tolerance_percentage: existingData?.tolerance_percentage || 5,
      branch_settings: branches.map(branch => {
        const existingSetting = existingData?.branch_settings.find(bs => bs.id_branch === branch.id_branch);
        return {
          id_setting: existingSetting?.id_setting,
          id_branch: branch.id_branch,
          branch_name: branch.nama_branch,
          safety_stock: existingSetting?.safety_stock || 10,
          reorder_point: existingSetting?.reorder_point || 20
        };
      })
    });
  };

  const handleBranchSettingChange = (branchId: number, field: 'safety_stock' | 'reorder_point', value: string) => {
    setFormData(prev => ({
      ...prev,
      branch_settings: prev.branch_settings.map(bs =>
        bs.id_branch === branchId
          ? { ...bs, [field]: parseFloat(value) || 0 }
          : bs
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_product) {
      showToast('Please select a product', 'error');
      return;
    }

    if (formData.tolerance_percentage < 0 || formData.tolerance_percentage > 100) {
      showToast('Tolerance percentage must be between 0 and 100', 'error');
      return;
    }

    setSaving(true);
    try {
      
      // Save branch settings with tolerance
      for (const branchSetting of formData.branch_settings) {
        const { data: existingSetting } = await supabase
          .from('product_branch_settings')
          .select('id_setting')
          .eq('id_product', formData.id_product)
          .eq('id_branch', branchSetting.id_branch)
          .single();
        
        const settingData = {
          id_product: formData.id_product,
          id_branch: branchSetting.id_branch,
          safety_stock: branchSetting.safety_stock,
          reorder_point: branchSetting.reorder_point,
          tolerance_percentage: formData.tolerance_percentage,
          updated_at: new Date().toISOString()
        };
        
        if (existingSetting) {
          await supabase.from('product_branch_settings').update(settingData).eq('id_setting', existingSetting.id_setting);
        } else {
          await supabase.from('product_branch_settings').insert(settingData);
        }
      }

      showToast('Settings saved successfully', 'success');
      
      // Force refresh data to show updated values
      await fetchData();
      
      setShowAddForm(false);
      setEditingId(null);
      setFormData({
        id_product: 0,
        tolerance_percentage: 5,
        branch_settings: []
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.details || 'Unknown error occurred';
      showToast(`Failed to save settings: ${errorMessage}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: ProductSetting) => {
    setFormData({
      id_product: item.id_product,
      tolerance_percentage: item.tolerance_percentage,
      branch_settings: branches.map(branch => {
        const existingSetting = item.branch_settings.find(bs => bs.id_branch === branch.id_branch);
        return {
          id_setting: existingSetting?.id_setting,
          id_branch: branch.id_branch,
          branch_name: branch.nama_branch,
          safety_stock: existingSetting?.safety_stock || 10,
          reorder_point: existingSetting?.reorder_point || 20
        };
      })
    });
    setEditingId(item.id_product);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      // Delete branch settings (which now includes tolerance)
      const { data: branchSettings } = await supabase
        .from('product_branch_settings')
        .select('id_setting')
        .eq('id_product', id);
      
      for (const setting of branchSettings || []) {
        await supabase.from('product_branch_settings').delete().eq('id_setting', setting.id_setting);
      }

      showToast('Settings deleted successfully', 'success');
      await fetchData();
    } catch (error) {
      showToast('Failed to delete settings', 'error');
    } finally {
      setDeleteConfirm({show: false, id: null});
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    if (data.length === 0) {
      showToast('No data to export', 'error');
      return;
    }

    const exportData = [];
    for (const product of data) {
      for (const branchSetting of product.branch_settings) {
        exportData.push({
          'Product Name': product.product_name,
          'Category': product.category,
          'Tolerance %': product.tolerance_percentage,
          'Branch': branchSetting.branch_name,
          'Safety Stock': branchSetting.safety_stock,
          'Reorder Point': branchSetting.reorder_point
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product Settings');
    XLSX.writeFile(wb, `product_settings_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Data exported successfully', 'success');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress({ current: 0, total: 0 });
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      setImportProgress({ current: 0, total: jsonData.length });
      let processed = 0;

      for (const row of jsonData) {
        const product = products.find(p => p.product_name.toLowerCase() === row['Product Name']?.toLowerCase());
        const branch = branches.find(b => b.nama_branch.toLowerCase() === row['Branch']?.toLowerCase());
        
        if (product && branch) {
          // Save tolerance
          const { data: existingTolerance } = await supabase
          .from('product_branch_settings')
            .select('id_product')
            .eq('id_product', product.id_product)
            .single();
          
          // Save branch setting with tolerance
          const { data: existingSetting } = await supabase
            .from('product_branch_settings')
            .select('id_setting')
            .eq('id_product', product.id_product)
            .eq('id_branch', branch.id_branch)
            .single();
          
          const settingData = {
            id_product: product.id_product,
            id_branch: branch.id_branch,
            safety_stock: parseFloat(row['Safety Stock']) || 10,
            reorder_point: parseFloat(row['Reorder Point']) || 20,
            tolerance_percentage: parseFloat(row['Tolerance %']) || 5
          };
          
          if (existingSetting) {
            await supabase.from('product_branch_settings').update(settingData).eq('id_setting', existingSetting.id_setting);
          } else {
            await supabase.from('product_branch_settings').insert(settingData);
          }
        }
        
        processed++;
        setImportProgress({ current: processed, total: jsonData.length });
      }

      await fetchData();
      showToast(`Imported ${jsonData.length} records successfully`, 'success');
    } catch (error) {
      showToast('Failed to import data', 'error');
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === paginatedData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedData.map(item => item.id_product));
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

    try {
      for (const id of selectedItems) {
        // Delete branch settings (which includes tolerance)
        const { data: branchSettings } = await supabase
          .from('product_branch_settings')
          .select('id_setting')
          .eq('id_product', id);
        
        for (const setting of branchSettings || []) {
          await supabase.from('product_branch_settings').delete().eq('id_setting', setting.id_setting);
        }
      }
      
      showToast(`Deleted ${selectedItems.length} items successfully`, 'success');
      setSelectedItems([]);
      await fetchData();
    } catch (error) {
      showToast('Failed to delete selected items', 'error');
    }
  };

  const filteredAndSortedData = React.useMemo(() => {
    let filtered = data.filter(item => {
      const matchesSearch = item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      const matchesBranch = !branchFilter || item.branch_settings.some(bs => bs.id_branch.toString() === branchFilter);
      return matchesSearch && matchesCategory && matchesBranch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key as keyof ProductSetting];
        let bValue = b[sortConfig.key as keyof ProductSetting];
        
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
  }, [data, searchTerm, categoryFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueCategories = [...new Set(data.map(item => item.category))];

  // Mobile filter component
  const MobileFilters = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="bg-white w-4/5 h-full p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Filters</h3>
          <button onClick={() => setShowMobileFilters(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Search products or categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border px-3 py-2 rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border px-3 py-2 rounded-md"
            >
              <option value="">All Categories</option>
              {uniqueCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Branch</label>
            <select
              value={branchFilter}
              onChange={(e) => {
                const newBranch = e.target.value;
                setBranchFilter(newBranch);
                if (showAddForm) {
                  fetchProducts(newBranch);
                }
              }}
              className="w-full border px-3 py-2 rounded-md"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id_branch} value={branch.id_branch}>
                  {branch.nama_branch}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setCategoryFilter('');
                setBranchFilter('');
                setSearchTerm('');
                fetchProducts();
              }}
              className="px-4 py-2 bg-gray-200 rounded-md flex-1"
            >
              Reset
            </button>
            <button 
              onClick={() => setShowMobileFilters(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md flex-1"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <PageAccessControl pageName="product_settings">
        <div className="p-4 md:p-6">
        {/* Mobile Filters */}
        {showMobileFilters && <MobileFilters />}
        
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Import Progress */}
        {importing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h3 className="font-bold text-lg mb-4">Importing Data...</h3>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {importProgress.total > 0 ? `${Math.round((importProgress.current / importProgress.total) * 100)}%` : '0%'} completed
                </div>
              </div>
              <p className="text-sm text-gray-600">Please wait while we import your data...</p>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirm.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h3 className="font-bold text-lg mb-4">Confirm Delete</h3>
              <p>Are you sure you want to delete these product settings?</p>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setDeleteConfirm({show: false, id: null})}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(deleteConfirm.id!)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-800">⚙️ Product Settings</h1>
          {isMobile && (
            <button 
              onClick={() => setShowMobileFilters(true)}
              className="ml-auto p-2 bg-gray-200 rounded-md"
            >
              <Filter size={20} />
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-3 mb-4">
          {!isMobile ? (
            <input
              type="text"
              placeholder="🔍 Search products or categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 px-3 py-2 rounded-md text-sm w-full sm:w-96 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          ) : (
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search products or categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border pl-8 pr-2 py-2 rounded-md w-full"
              />
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                // If branch filter is active, apply it to products when opening form
                if (!showAddForm && branchFilter) {
                  fetchProducts(branchFilter);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Plus size={16} />
              Add/Edit Settings
            </button>
            {!isMobile && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1 rounded-md text-xs flex items-center gap-1 ${
                  showFilters ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'
                }`}
              >
                <Filter size={16} />
                Filters
              </button>
            )}
            <button
              onClick={handleExport}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Download size={16} />
              Export Excel
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Upload size={16} />
              {importing ? 'Importing...' : 'Import Excel'}
            </button>
            {selectedItems.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
              >
                <Trash2 size={16} />
                Delete Selected ({selectedItems.length})
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => {
                fetchData();
                fetchProducts();
                fetchBranches();
                showToast('Data refreshed', 'success');
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Desktop Filters */}
        {showFilters && !isMobile && (
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border border-gray-300 px-3 py-2 rounded-md text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700">Branch</label>
                <select
                  value={branchFilter}
                  onChange={(e) => {
                    const newBranch = e.target.value;
                    setBranchFilter(newBranch);
                    
                    // Also filter products in the form
                    if (showAddForm) {
                      fetchProducts(newBranch);
                      if (newBranch) {
                        const branchName = branches.find(b => b.id_branch.toString() === newBranch)?.nama_branch;
                        showToast(`✅ Filter aktif untuk cabang ${branchName}`, "success");
                      }
                    }
                  }}
                  className="border border-gray-300 px-3 py-2 rounded-md text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Branches</option>
                  {branches.map(branch => (
                    <option key={branch.id_branch} value={branch.id_branch}>
                      {branch.nama_branch}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setCategoryFilter('');
                    setBranchFilter('');
                    setSearchTerm('');
                    fetchProducts(); // Reset to all products
                    showToast('Filters cleared', 'success');
                  }}
                  className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1 px-3 py-2 rounded hover:bg-red-50 border border-red-200"
                >
                  <X size={16} />
                  Clear All
                </button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
              <div className="flex justify-between items-center">
                <div>
                  Showing <span className="font-medium">{filteredAndSortedData.length}</span> of <span className="font-medium">{data.length}</span> products
                  {branchFilter && (
                    <span className="ml-2 text-blue-600">
                      (filtered by {branches.find(b => b.id_branch.toString() === branchFilter)?.nama_branch})
                    </span>
                  )}
                </div>
                {branchFilter && (
                  <div className="text-xs text-blue-600">
                    📍 {products.length} produk tersedia untuk cabang ini
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <h3 className="font-medium text-gray-800 mb-3 text-sm">
              {editingId ? 'Edit Product Settings' : 'Add Product Settings'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700">
                    Product * 
                    {branchFilter && (
                      <span className="text-blue-600 font-normal">
                        - {products.length} produk untuk {branches.find(b => b.id_branch.toString() === branchFilter)?.nama_branch}
                      </span>
                    )}
                  </label>
                  <select
                    value={formData.id_product}
                    onChange={(e) => handleProductSelect(parseInt(e.target.value))}
                    className="border px-2 py-1 rounded-md text-xs w-full"
                    required
                  >
                    <option value="">
                      {branchFilter 
                        ? `Select Product (${products.length} available for this branch)`
                        : 'Select Product'
                      }
                    </option>
                    {products.length === 0 && branchFilter ? (
                      <option value="" disabled>
                        No products available for {branches.find(b => b.id_branch.toString() === branchFilter)?.nama_branch}
                      </option>
                    ) : (
                      products.map(product => (
                        <option key={product.id_product} value={product.id_product}>
                          {product.product_name} ({product.category})
                        </option>
                      ))
                    )}
                  </select>
                  {branchFilter && products.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Tidak ada produk yang terdaftar untuk cabang ini. Konfigurasi produk di halaman Product Management.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700">Tolerance % *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.tolerance_percentage}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        tolerance_percentage: value === '' ? 0 : parseFloat(value)
                      }));
                    }}
                    className="border px-2 py-1 rounded-md text-xs w-full"
                    required
                  />
                </div>
              </div>

              {formData.branch_settings.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-sm mb-2">Branch Settings</h4>
                  <div className="overflow-x-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-2 py-1 text-left">Branch</th>
                          <th className="border px-2 py-1 text-center">Safety Stock</th>
                          <th className="border px-2 py-1 text-center">Reorder Point</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.branch_settings.map((branchSetting, idx) => (
                          <tr key={branchSetting.id_branch} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="border px-2 py-1">{branchSetting.branch_name}</td>
                            <td className="border px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={branchSetting.safety_stock}
                                onChange={(e) => handleBranchSettingChange(branchSetting.id_branch, 'safety_stock', e.target.value)}
                                className="w-full text-center border-0 bg-transparent focus:bg-white focus:border focus:rounded px-1"
                              />
                            </td>
                            <td className="border px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={branchSetting.reorder_point}
                                onChange={(e) => handleBranchSettingChange(branchSetting.id_branch, 'reorder_point', e.target.value)}
                                className="w-full text-center border-0 bg-transparent focus:bg-white focus:border focus:rounded px-1"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1 rounded-md text-xs"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingId(null);
                    setFormData({
                      id_product: 0,
                      tolerance_percentage: 5,
                      branch_settings: []
                    });
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Desktop Table */}
        {!isMobile ? (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full text-xs border border-gray-200">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border px-2 py-1 text-center font-medium">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === paginatedData.length && paginatedData.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product_name')}>
                    Product Name
                  </th>
                  <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('category')}>
                    Category
                  </th>
                  <th className="border px-2 py-1 text-center font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tolerance_percentage')}>
                    Tolerance %
                  </th>
                  <th className="border px-2 py-1 text-center font-medium">
                    Branch Settings
                  </th>
                  <th className="border px-2 py-1 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: itemsPerPage }).map((_, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      {Array.from({ length: 6 }).map((_, cellIdx) => (
                        <td key={cellIdx} className="border px-2 py-1">
                          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-2 text-gray-500 text-xs">
                      No product settings found
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, idx) => (
                    <tr key={item.id_product} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${selectedItems.includes(item.id_product) ? 'bg-blue-50' : ''}`}>
                      <td className="border px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id_product)}
                          onChange={() => handleSelectItem(item.id_product)}
                          className="rounded"
                        />
                      </td>
                      <td className="border px-2 py-1 font-medium">
                        {toTitleCase(item.product_name)}
                        {branchFilter && !item.branch_settings.some(bs => bs.id_branch.toString() === branchFilter) && (
                          <span className="ml-2 text-xs text-gray-400">(not in filtered branch)</span>
                        )}
                      </td>
                      <td className="border px-2 py-1">
                        <span className={`px-1 py-0.5 rounded text-xs font-semibold ${
                          item.category === 'Menu' ? 'bg-blue-100 text-blue-800' :
                          item.category === 'WIP' ? 'bg-yellow-100 text-yellow-800' :
                          item.category === 'Bahan Baku' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="border px-2 py-1 text-center">{Number(item.tolerance_percentage).toFixed(2)}%</td>
                      <td className="border px-2 py-1">
                        <div className="flex flex-wrap gap-1">
                          {item.branch_settings.map(bs => (
                            <div key={bs.id_branch} className="bg-gray-100 px-2 py-1 rounded text-xs">
                              <div className="font-medium text-gray-700">{bs.branch_name}</div>
                              <div className="flex gap-2 text-xs">
                                <span className="text-green-600">S:{bs.safety_stock}</span>
                                <span className="text-orange-600">R:{bs.reorder_point}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="border px-2 py-1">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({show: true, id: item.id_product})}
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
        ) : (
          /* Mobile List View */
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="p-3 border-b border-gray-200">
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-2 w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
                </div>
              ))
            ) : paginatedData.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No product settings found
              </div>
            ) : (
              paginatedData.map((item) => (
                <div key={item.id_product} className="p-3 border-b border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{toTitleCase(item.product_name)}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          item.category === 'Menu' ? 'bg-blue-100 text-blue-800' :
                          item.category === 'WIP' ? 'bg-yellow-100 text-yellow-800' :
                          item.category === 'Bahan Baku' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.category}
                        </span>
                        <span className="text-xs text-gray-600">
                          Tolerance: {Number(item.tolerance_percentage).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id_product)}
                        onChange={() => handleSelectItem(item.id_product)}
                        className="rounded"
                      />
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({show: true, id: item.id_product})}
                        className="text-red-600 hover:text-red-800 p-1 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <h4 className="text-xs font-medium text-gray-700 mb-1">Branch Settings:</h4>
                    <div className="grid grid-cols-2 gap-1">
                      {item.branch_settings.map(bs => (
                        <div key={bs.id_branch} className="bg-gray-100 px-2 py-1 rounded text-xs">
                          <div className="font-medium text-gray-700 truncate">{bs.branch_name}</div>
                          <div className="flex gap-2 text-xs">
                            <span className="text-green-600">S:{bs.safety_stock}</span>
                            <span className="text-orange-600">R:{bs.reorder_point}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
          <p className="text-xs text-gray-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} entries
          </p>
          <div className="flex gap-1">
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(1)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              First
            </button>
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              Prev
            </button>
            <div className="flex items-center gap-1">
              <span className="text-xs">Page</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const newPage = Math.max(1, Math.min(totalPages, Number(e.target.value)))
                  setCurrentPage(newPage)
                }}
                className="w-12 px-1 py-0.5 border rounded text-xs text-center"
              />
              <span className="text-xs">of {totalPages || 1}</span>
            </div>
            <button 
              disabled={currentPage === totalPages || totalPages === 0} 
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              Next
            </button>
            <button 
              disabled={currentPage === totalPages || totalPages === 0} 
              onClick={() => setCurrentPage(totalPages)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              Last
            </button>
          </div>
        </div>
        </div>
      </PageAccessControl>
    </Layout>
  );
}