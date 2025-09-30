'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from "@/src/lib/supabaseClient";
import { ArrowLeft, Edit, Wrench, Calendar, DollarSign, Camera } from 'lucide-react';
import Layout from '../../../components/Layout';
import PageAccessControl from '../../../components/PageAccessControl';
import { Asset, AssetMaintenance } from '@/src/types/assets';

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState<AssetMaintenance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchAssetDetail(params.id as string);
      fetchMaintenanceHistory(params.id as string);
    }
  }, [params.id]);

  const fetchAssetDetail = async (assetId: string) => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          asset_categories (
            category_name,
            category_type,
            depreciation_rate,
            useful_life
          )
        `)
        .eq('asset_id', assetId)
        .single();

      if (error) throw error;
      setAsset(data);
    } catch (error) {
      console.error('Error fetching asset:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenanceHistory = async (assetId: string) => {
    const { data } = await supabase
      .from('asset_maintenance')
      .select('*')
      .eq('asset_id', assetId)
      .order('maintenance_date', { ascending: false });
    
    if (data) setMaintenanceHistory(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800';
      case 'BROKEN': return 'bg-red-100 text-red-800';
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

  const calculateDepreciation = () => {
    if (!asset?.purchase_price || !asset?.asset_categories?.depreciation_rate || !asset?.purchase_date) return 0;
    
    const purchaseDate = new Date(asset.purchase_date);
    const currentDate = new Date();
    const yearsOwned = (currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    
    return asset.purchase_price * (asset.asset_categories.depreciation_rate / 100) * yearsOwned;
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

  if (!asset) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">Asset Not Found</h1>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageAccessControl pageName="assets">
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{asset.asset_name}</h1>
                <p className="text-gray-600">{asset.asset_id}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => router.push(`/assets/edit/${asset.asset_id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Edit size={16} />
                Edit
              </button>
              <button 
                onClick={() => router.push('/assets/maintenance')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Wrench size={16} />
                Maintenance
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Asset Details */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Asset Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Category</label>
                    <p className="font-medium">{asset.asset_categories?.category_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Brand</label>
                    <p className="font-medium">{asset.brand || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Model</label>
                    <p className="font-medium">{asset.model || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Serial Number</label>
                    <p className="font-medium">{asset.serial_number || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Location</label>
                    <p className="font-medium">{asset.location}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Supplier</label>
                    <p className="font-medium">{asset.supplier || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Status</label>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(asset.status)}`}>
                      {asset.status}
                    </span>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Condition</label>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${getConditionColor(asset.condition)}`}>
                      {asset.condition}
                    </span>
                  </div>
                </div>
                {asset.notes && (
                  <div className="mt-4">
                    <label className="text-sm text-gray-600">Notes</label>
                    <p className="mt-1">{asset.notes}</p>
                  </div>
                )}
              </div>

              {/* Maintenance History */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Maintenance History</h2>
                  <button 
                    onClick={() => router.push('/assets/maintenance')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Add Maintenance
                  </button>
                </div>
                <div className="space-y-3">
                  {maintenanceHistory.length > 0 ? (
                    maintenanceHistory.map((maintenance) => (
                      <div key={maintenance.maintenance_id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{maintenance.maintenance_type}</p>
                            <p className="text-sm text-gray-600">{maintenance.description}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(maintenance.maintenance_date).toLocaleDateString('id-ID')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">Rp {maintenance.cost.toLocaleString('id-ID')}</p>
                            <p className="text-xs text-gray-500">{maintenance.technician}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No maintenance history</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Asset Photo */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Asset Photo</h3>
                {asset.photo_url ? (
                  <div className="space-y-3">
                    <img 
                      src={asset.photo_url} 
                      alt={asset.asset_name}
                      className="w-full h-48 object-cover rounded-lg border"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-image.png';
                      }}
                    />
                    <button 
                      onClick={() => router.push(`/assets/upload-photo/${asset.asset_id}`)}
                      className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Change Photo
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                      <span className="text-gray-400 text-sm">No Photo</span>
                    </div>
                    <button 
                      onClick={() => router.push(`/assets/upload-photo/${asset.asset_id}`)}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Add Photo
                    </button>
                  </div>
                )}
              </div>
              {/* Financial Info */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <DollarSign size={20} className="mr-2" />
                  Financial Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-600">Purchase Price</label>
                    <p className="text-lg font-bold text-green-600">
                      Rp {asset.purchase_price?.toLocaleString('id-ID') || '0'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Current Value</label>
                    <p className="text-lg font-bold text-blue-600">
                      Rp {asset.current_value?.toLocaleString('id-ID') || '0'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Depreciation</label>
                    <p className="text-lg font-bold text-red-600">
                      Rp {calculateDepreciation().toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Purchase Date</label>
                    <p className="font-medium">
                      {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString('id-ID') : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Calendar size={20} className="mr-2" />
                  Important Dates
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-600">Warranty Expiry</label>
                    <p className="font-medium">
                      {asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString('id-ID') : 'No warranty'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Last Maintenance</label>
                    <p className="font-medium">
                      {asset.last_maintenance_date ? new Date(asset.last_maintenance_date).toLocaleDateString('id-ID') : 'Never'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Next Maintenance</label>
                    <p className="font-medium">
                      {asset.next_maintenance_date ? new Date(asset.next_maintenance_date).toLocaleDateString('id-ID') : 'Not scheduled'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageAccessControl>
    </Layout>
  );
}