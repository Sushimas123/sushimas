'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Package, Plus, Search, Filter, Eye, Edit, Trash2, AlertTriangle, Tag } from 'lucide-react';
import Layout from '../../components/Layout';
import PageAccessControl from '../../components/PageAccessControl';
import { Asset, AssetCategory } from '@/src/types/assets';

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<{url: string, name: string} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assetsData, categoriesData, branchesData] = await Promise.all([
        supabase
          .from('assets')
          .select(`
            *,
            asset_categories (
              category_name,
              category_type
            ),
            branches (
              nama_branch,
              kode_branch
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('asset_categories')
          .select('*')
          .order('category_name'),
        supabase
          .from('branches')
          .select('id_branch, nama_branch')
          .eq('is_active', true)
          .order('nama_branch')
      ]);

      if (assetsData.data) setAssets(assetsData.data);
      if (categoriesData.data) setCategories(categoriesData.data);
      if (branchesData.data) setBranches(branchesData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.asset_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || asset.status === statusFilter;
    const matchesLocation = !locationFilter || asset.location === locationFilter;
    const matchesBranch = !branchFilter || asset.id_branch?.toString() === branchFilter;
    
    return matchesSearch && matchesStatus && matchesLocation && matchesBranch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800';
      case 'BROKEN': return 'bg-red-100 text-red-800';
      case 'SOLD': return 'bg-gray-100 text-gray-800';
      case 'LOST': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'EXCELLENT': return 'bg-green-100 text-green-800';
      case 'GOOD': return 'bg-blue-100 text-blue-800';
      case 'FAIR': return 'bg-yellow-100 text-yellow-800';
      case 'POOR': return 'bg-orange-100 text-orange-800';
      case 'BROKEN': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const updateAssetStatus = async (assetId: string, newStatus: string) => {
    try {
      console.log('Attempting to update asset:', assetId, 'with status:', newStatus);
      
      const { data, error } = await supabase
        .from('assets')
        .update({ status: newStatus })
        .eq('asset_id', assetId)
        .select();
      
      console.log('Supabase response:', { data, error });
      
      if (error) {
        console.error('Supabase error details:', error);
        alert(`Failed to update status: ${error.message}`);
        return;
      }
      
      console.log('Update successful, updating local state');
      setAssets(assets.map(asset => 
        asset.asset_id === assetId ? { ...asset, status: newStatus as Asset['status'] } : asset
      ));
    } catch (error) {
      console.error('Caught error:', error);
      alert('An unexpected error occurred while updating status');
    }
  };

  const updateAssetCondition = async (assetId: string, newCondition: string) => {
    try {
      console.log('Attempting to update asset:', assetId, 'with condition:', newCondition);
      
      const { data, error } = await supabase
        .from('assets')
        .update({ condition: newCondition })
        .eq('asset_id', assetId)
        .select();
      
      console.log('Supabase response:', { data, error });
      
      if (error) {
        console.error('Supabase error details:', error);
        alert(`Failed to update condition: ${error.message}`);
        return;
      }
      
      console.log('Update successful, updating local state');
      setAssets(assets.map(asset => 
        asset.asset_id === assetId ? { ...asset, condition: newCondition as Asset['condition'] } : asset
      ));
    } catch (error) {
      console.error('Caught error:', error);
      alert('An unexpected error occurred while updating condition');
    }
  };

  const handleDeleteAsset = async (assetId: string, assetName: string) => {
    if (!confirm(`Are you sure you want to delete asset "${assetName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('asset_id', assetId);

      if (error) {
        console.error('Delete error:', error);
        alert(`Failed to delete asset: ${error.message}`);
        return;
      }

      // Remove from local state
      setAssets(assets.filter(asset => asset.asset_id !== assetId));
      alert('Asset deleted successfully');
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('An unexpected error occurred while deleting asset');
    }
  };

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
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Asset Management</h1>
                <p className="text-gray-600">Manage restaurant assets and equipment</p>
              </div>
              <a href="/assets/create" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                <Plus size={16} />
                Add Asset
              </a>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <a href="/assets/maintenance" className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <Package size={18} />
                <span className="font-medium">Maintenance</span>
              </a>
              <a href="/assets/damage-journal" className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                <AlertTriangle size={18} />
                <span className="font-medium">Damage Journal</span>
              </a>
              <a href="/assets/categories" className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                <Tag size={18} />
                <span className="font-medium">Categories</span>
              </a>
              <a href="/assets/locations" className="flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <Filter size={18} />
                <span className="font-medium">Locations</span>
              </a>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border rounded text-sm w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="">Semua Status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="MAINTENANCE">Perbaikan</option>
                <option value="BROKEN">Rusak</option>
                <option value="SOLD">Dijual</option>
                <option value="LOST">Hilang</option>
              </select>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="">All Locations</option>
                <option value="DAPUR">Dapur</option>
                <option value="RESTAURANT">Restaurant</option>
                <option value="GUDANG">Gudang</option>
                <option value="KASIR">Kasir</option>
                <option value="OFFICE">Office</option>
                <option value="LOBBY">Lobby</option>
                <option value="TOILET">Toilet</option>
              </select>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="">All Branches</option>
                {branches.map(branch => (
                  <option key={branch.id_branch} value={branch.id_branch}>
                    {branch.nama_branch}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assets Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Asset Info</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Category & Location</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Purchase Info</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Value & Qty</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status & Condition</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAssets.map((asset) => (
                    <tr key={asset.asset_id} className="hover:bg-gray-50">
                      {/* Asset Info */}
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          {asset.photo_url ? (
                            <img 
                              src={asset.photo_url} 
                              alt={asset.asset_name}
                              className="w-12 h-12 rounded-lg object-cover border cursor-pointer hover:opacity-80"
                              onClick={() => setSelectedPhoto({url: asset.photo_url!, name: asset.asset_name})}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center border">
                              <Package size={20} className="text-gray-400" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-gray-900">{asset.asset_name}</div>
                            <div className="text-xs text-gray-500">{asset.brand} {asset.model}</div>
                            <div className="text-xs text-gray-500">{asset.asset_id}</div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Category & Location */}
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900">{asset.asset_categories?.category_name}</div>
                          <div className="text-xs text-gray-500">{asset.location}</div>
                          <div className="text-xs text-gray-500">{asset.branches?.nama_branch || '-'}</div>
                        </div>
                      </td>
                      
                      {/* Purchase Info */}
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                        <div className="text-sm text-gray-900">
                            Rp {asset.purchase_price?.toLocaleString('id-ID') || '-'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString('id-ID') : '-'}
                          </div>

                        </div>
                      </td>
                                            
                      {/* Value & Qty */}
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">
                            Rp {asset.current_value?.toLocaleString('id-ID')}
                          </div>
                          <div className="text-xs text-gray-500">Qty: {asset.quantity || 1}</div>
                        </div>
                      </td>
                      
                      {/* Status & Condition */}
                      <td className="px-3 py-4">
                        <div className="space-y-2">
                          <select
                            value={asset.status}
                            onChange={(e) => updateAssetStatus(asset.asset_id, e.target.value)}
                            className={`w-full px-2 py-1 text-xs rounded border-0 ${getStatusColor(asset.status)}`}
                          >
                            <option value="ACTIVE">Aktif</option>
                            <option value="MAINTENANCE">Perbaikan</option>
                            <option value="BROKEN">Rusak</option>
                            <option value="SOLD">Dijual</option>
                            <option value="LOST">Hilang</option>
                          </select>
                          <select
                            value={asset.condition}
                            onChange={(e) => updateAssetCondition(asset.asset_id, e.target.value)}
                            className={`w-full px-2 py-1 text-xs rounded border-0 ${getConditionColor(asset.condition)}`}
                          >
                            <option value="EXCELLENT">Baru</option>
                            <option value="GOOD">Bagus</option>
                            <option value="FAIR">Cukup</option>
                            <option value="POOR">Kurang Bagus</option>
                            <option value="BROKEN">Rusak</option>
                          </select>
                        </div>
                      </td>

                      
                      {/* Actions */}
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <a href={`/assets/${asset.asset_id}`} className="text-blue-600 hover:text-blue-800" title="View Details">
                            <Eye size={16} />
                          </a>
                          <a href={`/assets/edit/${asset.asset_id}`} className="text-green-600 hover:text-green-800" title="Edit Asset">
                            <Edit size={16} />
                          </a>
                          <button 
                            onClick={() => handleDeleteAsset(asset.asset_id, asset.asset_name)}
                            className="text-red-600 hover:text-red-800" 
                            title="Delete Asset"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Assets</p>
                  <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
                </div>
                <Package className="text-blue-600" size={24} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Assets</p>
                  <p className="text-2xl font-bold text-green-600">
                    {assets.filter(a => a.status === 'ACTIVE').length}
                  </p>
                </div>
                <Package className="text-green-600" size={24} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Good Condition</p>
                  <p className="text-2xl font-bold text-green-600">
                    {assets.filter(a => ['EXCELLENT', 'GOOD'].includes(a.condition)).reduce((sum, a) => sum + (a.quantity || 1), 0)}
                  </p>
                </div>
                <Package className="text-green-600" size={24} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-blue-600">
                    Rp {assets.reduce((sum, a) => sum + (a.current_value || 0), 0).toLocaleString('id-ID')}
                  </p>
                </div>
                <Package className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          {/* Photo Preview Modal */}
          {selectedPhoto && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setSelectedPhoto(null)}>
              <div className="max-w-4xl max-h-full p-4">
                <img 
                  src={selectedPhoto.url} 
                  alt={selectedPhoto.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
                <p className="text-white text-center mt-2">{selectedPhoto.name}</p>
              </div>
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  );
}