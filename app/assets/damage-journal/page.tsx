'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { AlertTriangle, Plus, Search, Package, Edit, Trash2 } from 'lucide-react';
import Layout from '../../../components/Layout';
import PageAccessControl from '../../../components/PageAccessControl';
import { Asset, AssetDamageJournal } from '@/src/types/assets';

export default function DamageJournalPage() {
  const [journals, setJournals] = useState<AssetDamageJournal[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editingJournal, setEditingJournal] = useState<AssetDamageJournal | null>(null);
  const [formData, setFormData] = useState({
    asset_id: '',
    damaged_by: '',
    damage_description: '',
    quantity_damaged: 1,
    damage_value: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [journalsData, assetsData] = await Promise.all([
        supabase
          .from('asset_damage_journal')
          .select(`
            *,
            assets (
              asset_name,
              asset_categories (
                category_name
              )
            )
          `)
          .order('damage_date', { ascending: false }),
        supabase
          .from('assets')
          .select('asset_id, asset_name, current_value, id_branch')
          .eq('status', 'ACTIVE')
          .order('asset_name')
      ]);

      if (journalsData.data) setJournals(journalsData.data);
      if (assetsData.data) setAssets(assetsData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssetChange = async (assetId: string) => {
    const asset = assets.find(a => a.asset_id === assetId);
    setSelectedAsset(asset || null);
    
    if (asset) {
      // Auto-fill damage value from asset current value
      setFormData(prev => ({
        ...prev,
        asset_id: assetId,
        damage_value: asset.current_value || 0
      }));
      
      // Fetch users from the same branch as the asset
      if (asset.id_branch) {
        try {
          // Get branch kode_branch first
          const { data: branchData } = await supabase
            .from('branches')
            .select('kode_branch')
            .eq('id_branch', asset.id_branch)
            .single();
          
          console.log('Branch data:', branchData);
          
          if (branchData?.kode_branch) {
            // First, get user_branches for this branch
            const { data: userBranchData, error: ubError } = await supabase
              .from('user_branches')
              .select('id_user')
              .eq('kode_branch', branchData.kode_branch)
              .eq('is_active', true);
            
            console.log('User branch data:', userBranchData);
            console.log('User branch error:', ubError);
            
            if (userBranchData && userBranchData.length > 0) {
              // First check what columns exist in users table
              const { data: testUser } = await supabase
                .from('users')
                .select('*')
                .limit(1);
              
              console.log('Sample user structure:', testUser);
              
              // Get user details - try common column names
              const userIds = userBranchData.map(ub => ub.id_user);
              const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('*')
                .in('id_user', userIds)
                .eq('is_active', true);
              
              console.log('Users data:', usersData);
              console.log('Users error:', usersError);
              
              if (usersData) {
                setUsers(usersData);
              }
            } else {
              // If no users found in user_branches, show all active users as fallback
              const { data: allUsers } = await supabase
                .from('users')
                .select('*')
                .eq('is_active', true)
                .limit(20);
              
              console.log('Fallback - all users:', allUsers);
              if (allUsers) {
                setUsers(allUsers);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching users:', error);
        }
      }
    } else {
      setFormData(prev => ({ ...prev, asset_id: assetId, damage_value: 0 }));
      setUsers([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Insert damage journal entry
      const { error: journalError } = await supabase
        .from('asset_damage_journal')
        .insert([formData]);

      if (journalError) throw journalError;

      // Update asset quantity (reduce by quantity_damaged)
      if (selectedAsset) {
        const newQuantity = (selectedAsset.quantity || 1) - formData.quantity_damaged;
        const { error: assetError } = await supabase
          .from('assets')
          .update({ quantity: Math.max(0, newQuantity) }) // Ensure quantity doesn't go below 0
          .eq('asset_id', formData.asset_id);

        if (assetError) {
          console.error('Error updating asset quantity:', assetError);
          // Don't throw error here, journal was already created successfully
        }
      }

      setShowForm(false);
      setFormData({
        asset_id: '',
        damaged_by: '',
        damage_description: '',
        quantity_damaged: 1,
        damage_value: 0
      });
      setSelectedAsset(null);
      setUsers([]);
      fetchData();
      alert('Damage journal entry added and asset quantity updated successfully');
    } catch (error) {
      console.error('Error adding journal entry:', error);
      alert('Failed to add journal entry');
    }
  };

  const handleEdit = (journal: AssetDamageJournal) => {
    setEditingJournal(journal);
    setFormData({
      asset_id: journal.asset_id,
      damaged_by: journal.damaged_by,
      damage_description: journal.damage_description || '',
      quantity_damaged: journal.quantity_damaged,
      damage_value: journal.damage_value || 0
    });
    
    const asset = assets.find(a => a.asset_id === journal.asset_id);
    if (asset) {
      setSelectedAsset(asset);
      handleAssetChange(journal.asset_id);
    }
    
    setShowForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJournal) return;
    
    try {
      const oldQuantity = editingJournal.quantity_damaged;
      const newQuantity = formData.quantity_damaged;
      const quantityDiff = newQuantity - oldQuantity;
      
      const { error: journalError } = await supabase
        .from('asset_damage_journal')
        .update({
          damaged_by: formData.damaged_by,
          damage_description: formData.damage_description,
          quantity_damaged: formData.quantity_damaged,
          damage_value: formData.damage_value
        })
        .eq('journal_id', editingJournal.journal_id);

      if (journalError) throw journalError;

      if (selectedAsset && quantityDiff !== 0) {
        const currentQuantity = selectedAsset.quantity || 0;
        const newAssetQuantity = currentQuantity - quantityDiff;
        
        await supabase
          .from('assets')
          .update({ quantity: Math.max(0, newAssetQuantity) })
          .eq('asset_id', formData.asset_id);
      }

      setShowForm(false);
      setEditingJournal(null);
      setFormData({ asset_id: '', damaged_by: '', damage_description: '', quantity_damaged: 1, damage_value: 0 });
      setSelectedAsset(null);
      setUsers([]);
      fetchData();
      alert('Damage journal updated successfully');
    } catch (error) {
      console.error('Error updating journal entry:', error);
      alert('Failed to update journal entry');
    }
  };

  const handleDelete = async (journal: AssetDamageJournal) => {
    if (!confirm('Are you sure you want to delete this damage journal entry?')) return;
    
    try {
      const { error: journalError } = await supabase
        .from('asset_damage_journal')
        .delete()
        .eq('journal_id', journal.journal_id);

      if (journalError) throw journalError;

      const asset = assets.find(a => a.asset_id === journal.asset_id);
      if (asset) {
        const restoredQuantity = (asset.quantity || 0) + journal.quantity_damaged;
        
        await supabase
          .from('assets')
          .update({ quantity: restoredQuantity })
          .eq('asset_id', journal.asset_id);
      }

      fetchData();
      alert('Damage journal deleted and asset quantity restored');
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      alert('Failed to delete journal entry');
    }
  };

  const filteredJournals = journals.filter(journal =>
    journal.assets?.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    journal.damaged_by.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Asset Damage Journal</h1>
              <p className="text-gray-600">Track damaged assets and responsible parties</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              <Plus size={16} />
              Report Damage
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search by asset name or person..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border rounded text-sm w-64"
              />
            </div>
          </div>

          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">
                  {editingJournal ? 'Edit Damage Report' : 'Report Asset Damage'}
                </h2>
                <form onSubmit={editingJournal ? handleUpdate : handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
                    <select
                      value={formData.asset_id}
                      onChange={(e) => handleAssetChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Select Asset</option>
                      {assets.map((asset) => (
                        <option key={asset.asset_id} value={asset.asset_id}>
                          {asset.asset_id} - {asset.asset_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Damaged By</label>
                    <select
                      value={formData.damaged_by}
                      onChange={(e) => setFormData({ ...formData, damaged_by: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Select User</option>
                      {users.map((user) => (
                        <option key={user.id_user} value={user.nama_lengkap || user.full_name || user.username || user.email}>
                          {user.nama_lengkap || user.full_name || user.username || user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Damaged</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity_damaged}
                      onChange={(e) => setFormData({ ...formData, quantity_damaged: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Damage Value (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.damage_value}
                      onChange={(e) => setFormData({ ...formData, damage_value: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.damage_description}
                      onChange={(e) => setFormData({ ...formData, damage_description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700">
                      {editingJournal ? 'Update Damage' : 'Report Damage'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingJournal(null);
                        setFormData({ asset_id: '', damaged_by: '', damage_description: '', quantity_damaged: 1, damage_value: 0 });
                        setSelectedAsset(null);
                        setUsers([]);
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Asset</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Damaged By</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Quantity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Value</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredJournals.map((journal) => (
                    <tr key={journal.journal_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(journal.damage_date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{journal.assets?.asset_name}</div>
                          <div className="text-xs text-gray-500">{journal.asset_id}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{journal.damaged_by}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{journal.quantity_damaged}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        Rp {journal.damage_value?.toLocaleString('id-ID') || '0'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {journal.damage_description || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(journal)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(journal)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Incidents</p>
                  <p className="text-2xl font-bold text-red-600">{journals.length}</p>
                </div>
                <AlertTriangle className="text-red-600" size={24} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Items Damaged</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {journals.reduce((sum, j) => sum + j.quantity_damaged, 0)}
                  </p>
                </div>
                <Package className="text-orange-600" size={24} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Damage Value</p>
                  <p className="text-2xl font-bold text-red-600">
                    Rp {journals.reduce((sum, j) => sum + (j.damage_value || 0), 0).toLocaleString('id-ID')}
                  </p>
                </div>
                <AlertTriangle className="text-red-600" size={24} />
              </div>
            </div>
          </div>
        </div>
      </PageAccessControl>
    </Layout>
  );
}