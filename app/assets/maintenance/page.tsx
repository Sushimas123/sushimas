'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Calendar, Wrench, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import Layout from '../../../components/Layout';
import PageAccessControl from '../../../components/PageAccessControl';
import { AssetMaintenance, Asset } from '@/src/types/assets';

export default function MaintenancePage() {
  const [maintenances, setMaintenances] = useState<AssetMaintenance[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    asset_id: '',
    maintenance_date: new Date().toISOString().split('T')[0],
    maintenance_type: 'ROUTINE',
    description: '',
    cost: '',
    technician: '',
    next_maintenance_date: '',
    status: 'SCHEDULED'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [maintenanceData, assetData] = await Promise.all([
        supabase
          .from('asset_maintenance')
          .select(`
            *,
            assets (
              asset_name,
              location
            )
          `)
          .order('maintenance_date', { ascending: false }),
        supabase
          .from('assets')
          .select('asset_id, asset_name, location')
          .eq('status', 'ACTIVE')
          .order('asset_name')
      ]);

      if (maintenanceData.data) setMaintenances(maintenanceData.data);
      if (assetData.data) setAssets(assetData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMaintenanceStatus = async (maintenanceId: number, newStatus: string) => {
    try {
      // Update maintenance status
      const { error: maintenanceError } = await supabase
        .from('asset_maintenance')
        .update({ status: newStatus })
        .eq('maintenance_id', maintenanceId);

      if (maintenanceError) throw maintenanceError;
      
      // If status is COMPLETED, update asset's last_maintenance_date and next_maintenance_date
      if (newStatus === 'COMPLETED') {
        const maintenance = maintenances.find(m => m.maintenance_id === maintenanceId);
        if (maintenance) {
          const { error: assetError } = await supabase
            .from('assets')
            .update({ 
              last_maintenance_date: maintenance.maintenance_date,
              next_maintenance_date: maintenance.next_maintenance_date
            })
            .eq('asset_id', maintenance.asset_id);
          
          if (assetError) console.error('Error updating asset maintenance dates:', assetError);
        }
      }
      
      // Refresh data
      fetchData();
    } catch (error: any) {
      alert('Error updating status: ' + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('asset_maintenance')
        .insert([{
          ...formData,
          cost: parseFloat(formData.cost) || 0,
          next_maintenance_date: formData.next_maintenance_date || null
        }]);

      if (error) throw error;
      
      alert('Maintenance record added successfully!');
      setShowAddForm(false);
      setFormData({
        asset_id: '',
        maintenance_date: new Date().toISOString().split('T')[0],
        maintenance_type: 'ROUTINE',
        description: '',
        cost: '',
        technician: '',
        next_maintenance_date: '',
        status: 'SCHEDULED'
      });
      fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="text-green-600" size={16} />;
      case 'IN_PROGRESS': return <Clock className="text-blue-600" size={16} />;
      case 'SCHEDULED': return <Calendar className="text-yellow-600" size={16} />;
      case 'CANCELLED': return <AlertTriangle className="text-red-600" size={16} />;
      default: return <Calendar className="text-gray-600" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'SCHEDULED': return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredMaintenances = maintenances.filter(maintenance => 
    !statusFilter || maintenance.status === statusFilter
  );

  const upcomingMaintenances = maintenances.filter(m => {
    const maintenanceDate = new Date(m.maintenance_date);
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return m.status === 'SCHEDULED' && maintenanceDate <= nextWeek;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageAccessControl pageName="assets">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Asset Maintenance</h1>
              <p className="text-gray-600">Schedule and track asset maintenance</p>
            </div>
            <button 
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Wrench size={16} />
              Add Maintenance
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Maintenances</p>
                  <p className="text-2xl font-bold text-gray-900">{maintenances.length}</p>
                </div>
                <Wrench className="text-blue-600" size={24} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Scheduled</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {maintenances.filter(m => m.status === 'SCHEDULED').length}
                  </p>
                </div>
                <Calendar className="text-yellow-600" size={24} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">In Progress</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {maintenances.filter(m => m.status === 'IN_PROGRESS').length}
                  </p>
                </div>
                <Clock className="text-blue-600" size={24} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {maintenances.filter(m => m.status === 'COMPLETED').length}
                  </p>
                </div>
                <CheckCircle className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          {/* Upcoming Maintenances Alert */}
          {upcomingMaintenances.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="text-yellow-600 mr-2" size={20} />
                <h3 className="text-lg font-semibold text-yellow-800">
                  {upcomingMaintenances.length} maintenance(s) scheduled for this week
                </h3>
              </div>
              <div className="mt-2 space-y-1">
                {upcomingMaintenances.map(maintenance => (
                  <p key={maintenance.maintenance_id} className="text-sm text-yellow-700">
                    • {maintenance.assets?.asset_name} - {new Date(maintenance.maintenance_date).toLocaleDateString('id-ID')}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="">All Status</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Maintenance List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Asset</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Technician</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Cost</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Next Maintenance</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMaintenances.map((maintenance) => (
                    <tr key={maintenance.maintenance_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {maintenance.assets?.asset_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{maintenance.maintenance_type}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(maintenance.maintenance_date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{maintenance.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{maintenance.technician}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        Rp {maintenance.cost.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {maintenance.next_maintenance_date ? new Date(maintenance.next_maintenance_date).toLocaleDateString('id-ID') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(maintenance.status)}
                          <select
                            value={maintenance.status}
                            onChange={(e) => updateMaintenanceStatus(maintenance.maintenance_id, e.target.value)}
                            className={`px-2 py-1 text-xs rounded-full border-0 ${getStatusColor(maintenance.status)}`}
                          >
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Maintenance Modal */}
          {showAddForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-4">Add Maintenance Record</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
                    <select
                      value={formData.asset_id}
                      onChange={(e) => setFormData({...formData, asset_id: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    >
                      <option value="">Select Asset</option>
                      {assets.map(asset => (
                        <option key={asset.asset_id} value={asset.asset_id}>
                          {asset.asset_name} ({asset.location})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Type</label>
                    <select
                      value={formData.maintenance_type}
                      onChange={(e) => setFormData({...formData, maintenance_type: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="ROUTINE">Routine</option>
                      <option value="REPAIR">Repair</option>
                      <option value="OVERHAUL">Overhaul</option>
                      <option value="CLEANING">Cleaning</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={formData.maintenance_date}
                      onChange={(e) => setFormData({...formData, maintenance_date: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                    <input
                      type="number"
                      value={formData.cost}
                      onChange={(e) => setFormData({...formData, cost: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Technician</label>
                    <input
                      type="text"
                      value={formData.technician}
                      onChange={(e) => setFormData({...formData, technician: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Next Maintenance Date</label>
                    <input
                      type="date"
                      value={formData.next_maintenance_date}
                      onChange={(e) => setFormData({...formData, next_maintenance_date: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  );
}