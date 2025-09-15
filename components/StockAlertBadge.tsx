'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { ShoppingCart, AlertTriangle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

export default function StockAlertBadge() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchStockAlerts();
    
    // Real-time subscription
    const channel = supabase
      .channel('stock-alerts')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'gudang' }, 
        () => fetchStockAlerts()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'product_branch_settings' }, 
        () => fetchStockAlerts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error fetching stock alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = (alert: StockAlert) => {
    router.push('/purchaseorder/stock-alert');
    setShowDropdown(false);
  };

  if (loading) return null;
  if (alerts.length === 0) return null;

  const criticalAlerts = alerts.filter(a => a.urgency_level === 'CRITICAL');
  const urgentAlerts = alerts.filter(a => a.urgency_level === 'URGENT');

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
        title={`${alerts.length} stock alerts`}
      >
        <ShoppingCart size={20} />
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center animate-pulse">
            {alerts.length}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50 border max-h-96 overflow-hidden">
            <div className="p-3 border-b bg-red-50">
              <h3 className="font-semibold text-red-800 flex items-center">
                🚨 Stock Alerts
              </h3>
              <p className="text-xs text-red-600">{alerts.length} products need attention</p>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {criticalAlerts.length > 0 && (
                <div>
                  <div className="bg-red-100 px-3 py-2 border-b">
                    <h4 className="text-sm font-medium text-red-800 flex items-center gap-1">
                      <AlertCircle size={16} /> Critical ({criticalAlerts.length})
                    </h4>
                  </div>
                  {criticalAlerts.map(alert => (
                    <div key={`${alert.id_product}-${alert.branch_code}`} className="p-3 border-b hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate" title={alert.product_name}>
                              {alert.product_name}
                            </p>
                            {alert.po_status !== 'NONE' && (
                              <span className={`px-1 py-0.5 text-xs font-semibold rounded ${
                                alert.po_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                alert.po_status === 'Sedang diproses' ? 'bg-blue-100 text-blue-800' : ''
                              }`}>
                                {alert.po_status === 'Pending' ? 'PO PENDING' :
                                 alert.po_status === 'Sedang diproses' ? 'ON ORDER' : alert.po_status}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 truncate">
                            {alert.branch_name} • {alert.sub_category}
                            {alert.po_number && (
                              <span className="ml-2 text-blue-600 font-medium">{alert.po_number}</span>
                            )}
                          </p>
                          <p className="text-xs text-red-600 mt-1">
                            Stock: {alert.current_stock} / Safety: {alert.safety_stock}
                          </p>
                          <p className="text-xs text-gray-500">
                            Shortage: {alert.shortage_qty} units
                          </p>
                        </div>
                        <button
                          onClick={() => handleCreatePO(alert)}
                          className="ml-2 bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 flex items-center gap-1 whitespace-nowrap"
                          title={`Order ${alert.reorder_point} units`}
                        >
                          <ShoppingCart size={12} />
                          PO {alert.reorder_point}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {urgentAlerts.length > 0 && (
                <div>
                  <div className="bg-orange-100 px-3 py-2 border-b">
                    <h4 className="text-sm font-medium text-orange-800 flex items-center gap-1">
                      <AlertTriangle size={16} /> Urgent ({urgentAlerts.length})
                    </h4>
                  </div>
                  {urgentAlerts.map(alert => (
                    <div key={`${alert.id_product}-${alert.branch_code}`} className="p-3 border-b hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate" title={alert.product_name}>
                              {alert.product_name}
                            </p>
                            {alert.po_status !== 'NONE' && (
                              <span className={`px-1 py-0.5 text-xs font-semibold rounded ${
                                alert.po_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                alert.po_status === 'Sedang diproses' ? 'bg-blue-100 text-blue-800' : ''
                              }`}>
                                {alert.po_status === 'Pending' ? 'PO PENDING' :
                                 alert.po_status === 'Sedang diproses' ? 'ON ORDER' : alert.po_status}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 truncate">
                            {alert.branch_name} • {alert.sub_category}
                            {alert.po_number && (
                              <span className="ml-2 text-blue-600 font-medium">{alert.po_number}</span>
                            )}
                          </p>
                          <p className="text-xs text-orange-600 mt-1">
                            Stock: {alert.current_stock} / Safety: {alert.safety_stock}
                          </p>
                          <p className="text-xs text-gray-500">
                            Shortage: {alert.shortage_qty} units
                          </p>
                        </div>
                        <button
                          onClick={() => handleCreatePO(alert)}
                          className="ml-2 bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 flex items-center gap-1 whitespace-nowrap"
                          title={`Order ${alert.reorder_point} units`}
                        >
                          <ShoppingCart size={12} />
                          PO {alert.reorder_point}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t">
              <button 
                onClick={() => {
                  router.push('/purchaseorder/stock-alert');
                  setShowDropdown(false);
                }}
                className="w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 transition-colors"
              >
                Create Bulk PO from Alerts
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}