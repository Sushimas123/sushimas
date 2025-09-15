'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabaseClient';
import { ArrowLeft, ShoppingCart, AlertTriangle, AlertCircle, Save, Building2 } from 'lucide-react';
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    po_date: new Date().toISOString().split('T')[0],
    priority: 'tinggi',
    notes: 'Urgent PO from Stock Alert System'
  });

  useEffect(() => {
    fetchStockAlerts();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (stockAlerts.length > 0 && suppliers.length > 0) {
      initializePOItems();
    }
  }, [stockAlerts, suppliers]);

  const fetchStockAlerts = async () => {
    try {
      // Try new function first, fallback to original if it fails
      let { data, error } = await supabase.rpc('get_stock_alerts_with_po_status');
      
      if (error) {
        console.log('New function not available, using original:', error.message);
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

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id_supplier, nama_supplier, termin_tempo')
        .order('nama_supplier');
      
      if (!error && data) {
        setSuppliers(data);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializePOItems = () => {
    const items: POItem[] = stockAlerts.map(alert => ({
      alert,
      supplier_id: suppliers[0]?.id_supplier || 0,
      supplier_name: suppliers[0]?.nama_supplier || '',
      qty: alert.reorder_point,
      notes: `Stock Alert - ${alert.urgency_level}`,
      selected: alert.urgency_level === 'CRITICAL'
    }));
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

  const handleCreatePOs = async () => {
    const selectedItems = poItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      alert('Pilih minimal satu produk untuk dibuat PO');
      return;
    }

    setSaving(true);
    try {
      // Group by supplier and branch
      const groupedItems = selectedItems.reduce((groups, item) => {
        const key = `${item.supplier_id}-${item.alert.id_branch}`;
        if (!groups[key]) {
          groups[key] = {
            supplier_id: item.supplier_id,
            supplier_name: item.supplier_name,
            branch_id: item.alert.id_branch,
            branch_name: item.alert.branch_name,
            items: []
          };
        }
        groups[key].items.push(item);
        return groups;
      }, {} as Record<string, any>);

      let createdPOs = 0;
      
      // Create PO for each group
      for (const group of Object.values(groupedItems)) {
        const poNumber = `PO-ALERT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}-${group.supplier_id}`;
        
        // Create PO
        const { data: poData, error: poError } = await supabase
          .from('purchase_orders')
          .insert({
            po_number: poNumber,
            po_date: formData.po_date,
            cabang_id: group.branch_id,
            supplier_id: group.supplier_id,
            status: 'Pending',
            priority: formData.priority,
            termin_days: suppliers.find(s => s.id_supplier === group.supplier_id)?.termin_tempo || 30
          })
          .select()
          .single();

        if (poError) throw poError;

        // Create PO items
        const poItemsData = group.items.map((item: POItem) => ({
          po_id: poData.id,
          product_id: item.alert.id_product,
          qty: item.qty,
          keterangan: item.notes
        }));

        const { error: itemsError } = await supabase
          .from('po_items')
          .insert(poItemsData);

        if (itemsError) throw itemsError;

        createdPOs++;
      }

      alert(`✅ Berhasil membuat ${createdPOs} PO dari Stock Alert!`);
      router.push('/purchaseorder');
    } catch (error) {
      console.error('Error creating POs:', error);
      alert('❌ Gagal membuat PO. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const criticalAlerts = stockAlerts.filter(a => a.urgency_level === 'CRITICAL');
  const urgentAlerts = stockAlerts.filter(a => a.urgency_level === 'URGENT');
  const selectedCount = poItems.filter(item => item.selected).length;

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
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="text-red-600" size={22} />
            Stock Alert Purchase Orders
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {stockAlerts.length} alerts
            </span>
          </h1>
          <p className="text-gray-600 text-sm">
            Create purchase orders for products with low stock levels
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="text-red-400 mr-2" size={20} />
            <div>
              <p className="text-sm font-medium text-red-800">Critical Alerts</p>
              <p className="text-2xl font-bold text-red-600">{criticalAlerts.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="text-yellow-400 mr-2" size={20} />
            <div>
              <p className="text-sm font-medium text-yellow-800">Urgent Alerts</p>
              <p className="text-2xl font-bold text-yellow-600">{urgentAlerts.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
          <div className="flex items-center">
            <ShoppingCart className="text-blue-400 mr-2" size={20} />
            <div>
              <p className="text-sm font-medium text-blue-800">Selected for PO</p>
              <p className="text-2xl font-bold text-blue-600">{selectedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* PO Settings */}
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
              <option value="tinggi">🚨 Tinggi (Urgent)</option>
              <option value="sedang">⚠️ Sedang</option>
              <option value="biasa">📝 Biasa</option>
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

      {/* Stock Alerts List */}
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

        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {poItems.map((item) => (
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
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Building2 size={14} />
                      {item.alert.branch_name}
                    </div>
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
      </div>

      {/* Action Buttons */}
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
      <PageAccessControl pageName="purchaseorder">
        <StockAlertPOPage />
      </PageAccessControl>
    </Layout>
  );
}