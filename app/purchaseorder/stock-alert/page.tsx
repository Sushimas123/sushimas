'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabaseClient';
import { ArrowLeft, ShoppingCart, AlertTriangle, AlertCircle, Save, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import PageAccessControl from '../../../components/PageAccessControl';

interface StockAlert {
  id_product: number;
  product_name: string;
  category: string;
  sub_category: string;
  branch_code: string;
  branch_name: string;
  id_branch: number;
  current_stock: number;
  safety_stock: number;
  reorder_point: number;
  urgency_level: string;
  shortage_qty: number;
  last_updated: string;
  po_status: string;
  po_number: string;
  po_created_at: string;
}

interface Supplier {
  id_supplier: number;
  nama_supplier: string;
  termin_tempo?: number;
}

interface POItem {
  alert: StockAlert;
  supplier_id: number;
  supplier_name: string;
  qty: number;
  notes: string;
  selected: boolean;
}

function StockAlertPOPage() {
  const router = useRouter();
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [filteredStockAlerts, setFilteredStockAlerts] = useState<StockAlert[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [userRole, setUserRole] = useState('');
  const [userBranch, setUserBranch] = useState('');
  const [allowedBranches, setAllowedBranches] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    po_date: new Date().toISOString().split('T')[0],
    priority: 'tinggi',
    notes: 'Urgent PO from Stock Alert System'
  });

  useEffect(() => {
    const init = async () => {
      await initializeUserData();
      fetchSuppliers();
    };
    init();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchStockAlerts();
    }
  }, [userRole, allowedBranches]);

  const initializeUserData = async () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role);
      
      if (user.role === 'super admin' || user.role === 'admin') {
        setAllowedBranches([]);
      } else {
        // For non-admin users, get branches from user_branches table
        if (user.id_user) {
          const { data: userBranches } = await supabase
            .from('user_branches')
            .select('kode_branch, branches!inner(nama_branch)')
            .eq('id_user', user.id_user)
            .eq('is_active', true);
          
          if (userBranches && userBranches.length > 0) {
            const branchNames = userBranches.map(ub => (ub.branches as any).nama_branch);
            setAllowedBranches(branchNames);
            setUserBranch(branchNames[0]);
            setSelectedBranch(branchNames[0]);
          } else {
            // Fallback to user.cabang if no user_branches found
            const fallbackBranch = user.cabang || '';
            setAllowedBranches([fallbackBranch].filter(Boolean));
            setUserBranch(fallbackBranch);
            setSelectedBranch(fallbackBranch);
          }
        }
      }
    }
  };

  useEffect(() => {
    if (filteredStockAlerts.length > 0 && suppliers.length > 0) {
      initializePOItems();
    }
  }, [filteredStockAlerts, suppliers]);

  const handleBranchFilter = (branch: string) => {
    if (allowedBranches.length > 0 && branch !== '' && !allowedBranches.includes(branch)) {
      return;
    }
    setSelectedBranch(branch);
    applyFilters(branch, selectedSubCategory);
  };

  const handleSubCategoryFilter = (subCategory: string) => {
    setSelectedSubCategory(subCategory);
    applyFilters(selectedBranch, subCategory);
  };

  const applyFilters = (branch: string, subCategory: string) => {
    let filtered = stockAlerts;
    
    if (branch !== '') {
      filtered = filtered.filter(alert => alert.branch_name === branch);
    }
    
    if (subCategory !== '') {
      filtered = filtered.filter(alert => alert.sub_category === subCategory);
    }
    
    setFilteredStockAlerts(filtered);
    setCurrentPage(1);
  };

  const fetchStockAlerts = async () => {
    try {
      let { data, error } = await supabase.rpc('get_stock_alerts_with_po_status');
      
      if (error) {
        console.log('New function not available, using original:', error.message);
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
        let filteredData = data;
        
        // Filter by allowed branches for non-admin users
        if (allowedBranches.length > 0) {
          filteredData = data.filter((alert: StockAlert) => 
            allowedBranches.includes(alert.branch_name)
          );
          console.log('Filtered stock alerts by branches:', allowedBranches, 'Result count:', filteredData.length);
        }
        
        setStockAlerts(filteredData);
        setFilteredStockAlerts(filteredData);
      }
    } catch (error) {
      console.error('Error fetching stock alerts:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      let { data, error } = await supabase
        .from('suppliers')
        .select('id_supplier, nama_supplier, termin_tempo')
        .order('nama_supplier');
      
      if (error) {
        const result = await supabase
          .from('supplier')
          .select('id, nama_supplier, termin_tempo')
          .order('nama_supplier');
        
        if (!result.error && result.data) {
          data = result.data.map((supplier: any) => ({
            id_supplier: supplier.id,
            nama_supplier: supplier.nama_supplier,
            termin_tempo: supplier.termin_tempo
          }));
          error = null;
        } else {
          data = null;
          error = result.error;
        }
      }
      
      if (!error && data) {
        setSuppliers(data);
      } else {
        setSuppliers([{ id_supplier: 1, nama_supplier: 'Default Supplier', termin_tempo: 30 }]);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([{ id_supplier: 1, nama_supplier: 'Default Supplier', termin_tempo: 30 }]);
    } finally {
      setLoading(false);
    }
  };

  const initializePOItems = async () => {
    // Get product supplier information
    const { data: productSuppliers, error } = await supabase
      .from('nama_product')
      .select(`
        id_product,
        supplier_id,
        suppliers!inner(
          id_supplier,
          nama_supplier
        )
      `);
    
    if (error) {
      console.error('Error fetching product suppliers:', error);
    }
    
    const items: POItem[] = filteredStockAlerts.map(alert => {
      // Find the correct supplier for this product
      const productSupplier = productSuppliers?.find(ps => ps.id_product === alert.id_product);
      
      return {
        alert,
        supplier_id: productSupplier?.supplier_id || suppliers[0]?.id_supplier || 0,
        supplier_name: (productSupplier?.suppliers as any)?.nama_supplier || suppliers[0]?.nama_supplier || '',
        qty: alert.reorder_point,
        notes: `Stock Alert - ${alert.urgency_level}`,
        selected: false
      };
    });
    setPOItems(items);
  };

  const updatePOItem = (productId: number, branchCode: string, field: keyof POItem, value: any) => {
    setPOItems(items => items.map(item => {
      if (item.alert.id_product === productId && item.alert.branch_code === branchCode) {
        if (field === 'supplier_id') {
          const supplier = suppliers.find(s => s.id_supplier === value);
          return {
            ...item,
            supplier_id: value,
            supplier_name: supplier?.nama_supplier || ''
          };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const toggleSelectAll = () => {
    const allSelected = poItems.every(item => item.selected);
    setPOItems(items => items.map(item => ({ ...item, selected: !allSelected })));
  };

  // Debug database schema
  const debugDatabaseSchema = async () => {
    try {
      const tableNames = ['purchaseorder', 'purchase_orders', 'po', 'purchase_order'];
      
      for (const tableName of tableNames) {
        try {
          const { data: columns, error: columnsError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable')
            .eq('table_name', tableName);
          
          if (!columnsError && columns && columns.length > 0) {
            console.log(`Columns in ${tableName}:`, columns);
          }
        } catch (e) {
          console.log(`Table ${tableName} doesn't exist or can't be accessed`);
        }
      }
    } catch (error) {
      console.error('Schema debug error:', error);
    }
  };

  const handleCreatePOs = async () => {
    const selectedItems = poItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      alert('Pilih minimal satu produk untuk dibuat PO');
      return;
    }

    setSaving(true);
    try {
      // Debug schema first
      await debugDatabaseSchema();
      
      // Create purchase_orders table if it doesn't exist
      const workingTable = 'purchase_orders';
      
      try {
        const { error: createError } = await supabase.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS purchase_orders (
              id BIGSERIAL PRIMARY KEY,
              po_number TEXT NOT NULL UNIQUE,
              po_date DATE NOT NULL,
              cabang_id BIGINT NOT NULL REFERENCES branches(id_branch),
              supplier_id BIGINT NOT NULL REFERENCES suppliers(id_supplier),
              status TEXT NOT NULL DEFAULT 'Pending',
              priority TEXT DEFAULT 'Normal',
              termin_days INTEGER DEFAULT 30,
              notes TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
          `
        });
        
        if (createError) {
          console.log('Table might already exist or RPC not available:', createError);
        }
      } catch (e) {
        console.log('Could not create table, proceeding with existing table');
      }
      
      // Debug selected items structure
      console.log('Selected items structure:', selectedItems.map(item => ({
        alert: {
          id_branch: item.alert.id_branch,
          branch_code: item.alert.branch_code,
          product_name: item.alert.product_name
        },
        supplier_id: item.supplier_id,
        supplier_name: item.supplier_name,
        selected: item.selected
      })));

      // Filter valid items with more lenient validation
      const validItems = selectedItems.filter(item => {
        const hasBranch = item.alert.id_branch || item.alert.branch_code;
        const hasSupplier = item.supplier_id && item.supplier_id > 0;
        
        console.log('Validating item:', {
          product: item.alert.product_name,
          id_branch: item.alert.id_branch,
          branch_code: item.alert.branch_code,
          supplier_id: item.supplier_id,
          hasBranch,
          hasSupplier,
          valid: hasBranch && hasSupplier
        });
        
        return hasBranch && hasSupplier;
      });

      if (validItems.length === 0) {
        console.error('No valid items found. Check data structure above.');
        alert('❌ Tidak ada item dengan data branch dan supplier yang valid. Periksa console untuk detail.');
        return;
      }

      console.log('Valid items for grouping:', validItems.map(item => ({
        product: item.alert.product_name,
        branch_id: item.alert.id_branch,
        supplier_id: item.supplier_id,
        supplier_name: item.supplier_name
      })));
      
      // Group by supplier and branch - FIXED VERSION
      const groupedItems = validItems.reduce((groups, item) => {
        // Use id_branch if available, otherwise use branch_code
        const branchId = item.alert.id_branch || item.alert.branch_code;
        const key = `${item.supplier_id}-${branchId}`;
        
        console.log('Processing item:', {
          key,
          branch_id: branchId,
          supplier_id: item.supplier_id
        });
        
        if (!groups[key]) {
          groups[key] = {
            supplier_id: parseInt(item.supplier_id.toString()),
            supplier_name: item.supplier_name,
            branch_id: branchId,
            branch_name: item.alert.branch_name || item.alert.branch_code,
            items: []
          };
          console.log('Created new group:', groups[key]);
        }
        groups[key].items.push(item);
        return groups;
      }, {} as Record<string, any>);

      console.log('Final grouped items:', groupedItems);

      let createdPOs = 0;
      
      // Create PO for each group
      for (const [key, group] of Object.entries(groupedItems)) {
        try {
          const poNumber = `PO-ALERT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}-${group.supplier_id}`;
          
          // Add validation before PO creation
          if (!group.branch_id || !group.supplier_id) {
            console.error('Missing required fields for PO creation:', {
              group_key: key,
              branch_id: group.branch_id,
              supplier_id: group.supplier_id
            });
            continue;
          }

          // Validate and parse data types
          let branchId = group.branch_id;
          const supplierId = parseInt(group.supplier_id.toString());

          // If branch_id is not a number, look it up from branches table
          if (isNaN(parseInt(branchId.toString()))) {
            console.log('Branch ID is not numeric, looking up branch_code:', branchId);
            
            const { data: branchData, error: branchError } = await supabase
              .from('branches')
              .select('id_branch')
              .eq('kode_branch', branchId)
              .single();
            
            if (!branchError && branchData) {
              branchId = branchData.id_branch;
              console.log('Found branch ID:', branchId);
            } else {
              console.error('Could not find branch for code:', branchId);
              branchId = 1; // Default fallback
            }
          } else {
            branchId = parseInt(branchId.toString());
          }

          if (isNaN(supplierId)) {
            console.error('Invalid supplier ID:', {
              supplier_id: group.supplier_id,
              parsed_supplier: supplierId
            });
            continue;
          }
          
          console.log('Creating PO with validated data:', {
            po_number: poNumber,
            po_date: formData.po_date,
            cabang_id: branchId,
            supplier_id: supplierId,
            status: 'Pending',
            priority: formData.priority,
            branch_name: group.branch_name,
            supplier_name: group.supplier_name,
            items_count: group.items.length
          });
          
          // Create PO data with proper field names
          const poData = {
            po_number: poNumber,
            po_date: formData.po_date,
            cabang_id: branchId,
            supplier_id: supplierId,
            status: 'Pending',
            priority: formData.priority,
            termin_days: suppliers.find(s => s.id_supplier === supplierId)?.termin_tempo || 30,
            notes: `${formData.notes} - ${group.items.length} items`
          };

          console.log('Attempting PO insertion with data:', poData);
          
          const { data: createdPO, error: poError } = await supabase
            .from(workingTable)
            .insert(poData)
            .select()
            .single();
          
          if (poError) {
            console.error('PO creation failed:', {
              message: poError.message,
              details: poError.details,
              hint: poError.hint,
              code: poError.code,
              data: poData
            });
            alert(`❌ Failed to create PO for ${group.supplier_name}: ${poError.message}`);
            continue;
          }
          
          console.log('PO created successfully:', createdPO);
          
          // Create PO items table if needed and insert items
          if (createdPO?.id) {
            try {
              // Try to create po_items table if it doesn't exist
              await supabase.rpc('exec_sql', {
                sql: `
                  CREATE TABLE IF NOT EXISTS po_items (
                    id BIGSERIAL PRIMARY KEY,
                    po_id BIGINT NOT NULL REFERENCES purchase_orders(id),
                    product_id BIGINT NOT NULL REFERENCES nama_product(id_product),
                    qty NUMERIC NOT NULL,
                    keterangan TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                  );
                `
              });
            } catch (e) {
              console.log('Could not create po_items table, proceeding');
            }
            
            const poItemsData = group.items.map((item: POItem) => ({
              po_id: createdPO.id,
              product_id: item.alert.id_product,
              qty: item.qty,
              keterangan: item.notes
            }));

            console.log('Creating PO items:', poItemsData);

            const { error: itemsError } = await supabase.from('po_items').insert(poItemsData);

            if (itemsError) {
              console.error('PO items creation error:', itemsError);
              alert(`⚠️ PO created but failed to add items: ${itemsError.message}`);
            }
          }
          
          createdPOs++;
        } catch (groupError) {
          console.error(`Error creating PO for group ${group.supplier_name}:`, groupError);
          alert(`❌ Error creating PO for ${group.supplier_name}: ${groupError instanceof Error ? groupError.message : 'Unknown error'}`);
        }
      }
      
      if (createdPOs > 0) {
        alert(`✅ Berhasil membuat ${createdPOs} PO dari Stock Alert!`);
        router.push('/purchaseorder');
      } else {
        alert('❌ Tidak ada PO yang berhasil dibuat. Periksa console untuk detail error.');
      }
      
    } catch (error) {
      console.error('Error creating POs:', error);
      alert(`❌ Gagal membuat PO: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const criticalAlerts = filteredStockAlerts.filter(a => a.urgency_level === 'CRITICAL');
  const urgentAlerts = filteredStockAlerts.filter(a => a.urgency_level === 'URGENT');
  const selectedCount = poItems.filter(item => item.selected).length;

  const totalItems = poItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = poItems.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading stock alerts...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-gray-50 min-h-screen">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={22} />
              Stock Alert Purchase Orders
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {filteredStockAlerts.length} alerts
                {selectedBranch && ` (${selectedBranch})`}
                {selectedSubCategory && ` - ${selectedSubCategory}`}
              </span>
            </h1>
            <div className="flex items-center gap-2">
              {(userRole === 'super admin' || userRole === 'admin') && (
                <select
                  value={selectedBranch}
                  onChange={(e) => handleBranchFilter(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">All Branches</option>
                  {[...new Set(stockAlerts.map(alert => alert.branch_name))].map(branchName => (
                    <option key={branchName} value={branchName}>{branchName}</option>
                  ))}
                </select>
              )}
              <select
                value={selectedSubCategory}
                onChange={(e) => handleSubCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">All Sub Categories</option>
                {[...new Set(stockAlerts.map(alert => alert.sub_category).filter(Boolean))].map(subCategory => (
                  <option key={subCategory} value={subCategory}>{subCategory}</option>
                ))}
              </select>
            </div>
            {userRole !== 'super admin' && userRole !== 'admin' && (
              <div className="flex items-center gap-2">
                {allowedBranches.length > 1 ? (
                  <select
                    value={selectedBranch}
                    onChange={(e) => handleBranchFilter(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm bg-blue-50"
                  >
                    {allowedBranches.map(branchName => (
                      <option key={branchName} value={branchName}>{branchName}</option>
                    ))}
                  </select>
                ) : (
                  <span className="bg-blue-100 text-blue-800 px-3 py-2 rounded text-sm font-medium">
                    {allowedBranches[0] || userBranch}
                  </span>
                )}
                <select
                  value={selectedSubCategory}
                  onChange={(e) => handleSubCategoryFilter(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">All Sub Categories</option>
                  {[...new Set(stockAlerts.map(alert => alert.sub_category).filter(Boolean))].map(subCategory => (
                    <option key={subCategory} value={subCategory}>{subCategory}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="text-gray-600 text-sm mt-1">
            Create purchase orders for products with low stock levels
          </p>
        </div>
      </div>


      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3">PO Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PO Date</label>
            <input
              type="date"
              value={formData.po_date}
              onChange={(e) => setFormData({...formData, po_date: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({...formData, priority: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="tinggi">Tinggi (Urgent)</option>
              <option value="sedang">Sedang</option>
              <option value="biasa">Biasa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="PO notes..."
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Products Needing Purchase Orders</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {poItems.every(item => item.selected) ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-sm text-gray-500">
              ({selectedCount} selected)
            </span>
          </div>
        </div>

        <div className="px-4 py-2 bg-gray-50 border-b text-sm text-gray-600">
          Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} items
        </div>

        <div className="divide-y divide-gray-200">
          {currentItems.map((item) => (
            <div key={`${item.alert.id_product}-${item.alert.branch_code}`} className="p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={(e) => updatePOItem(item.alert.id_product, item.alert.branch_code, 'selected', e.target.checked)}
                  className="mt-1"
                />
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">{item.alert.product_name}</h4>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      item.alert.po_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      item.alert.po_status === 'Sedang diproses' ? 'bg-blue-100 text-blue-800' :
                      item.alert.urgency_level === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {item.alert.po_status === 'Pending' ? 'PO PENDING' :
                       item.alert.po_status === 'Sedang diproses' ? 'ON ORDER' :
                       item.alert.urgency_level}
                    </span>
                    {item.alert.po_number && (
                      <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
                        {item.alert.po_number}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Building2 size={14} />
                      {item.alert.branch_name}
                    </div>
                    <div>Category: <span className="text-gray-600">{item.alert.sub_category}</span></div>
                    <div>Current: <span className="text-red-600 font-medium">{item.alert.current_stock}</span></div>
                    <div>Safety: <span className="text-gray-600">{item.alert.safety_stock}</span></div>
                    <div>Shortage: <span className="text-orange-600 font-medium">{item.alert.shortage_qty}</span></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Supplier</label>
                      <select
                        value={item.supplier_id}
                        onChange={(e) => updatePOItem(item.alert.id_product, item.alert.branch_code, 'supplier_id', parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        {suppliers.map(supplier => (
                          <option key={supplier.id_supplier} value={supplier.id_supplier}>
                            {supplier.nama_supplier}
                          </option>                        
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Order Quantity</label>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updatePOItem(item.alert.id_product, item.alert.branch_code, 'qty', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        min="1"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Notes</label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updatePOItem(item.alert.id_product, item.alert.branch_code, 'notes', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="Item notes..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`px-3 py-1 text-sm border rounded-md ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-gray-50 p-2 border-t">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleCreatePOs}
          disabled={selectedCount === 0 || saving}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Creating POs...' : `Create ${selectedCount} PO(s)`}
        </button>
      </div>
    </div>
  );
}

export default function StockAlertPOPageWrapper() {
  return (
    <Layout>
      <PageAccessControl pageName="stock-alert">
        <StockAlertPOPage />
      </PageAccessControl>
    </Layout>
  );
}