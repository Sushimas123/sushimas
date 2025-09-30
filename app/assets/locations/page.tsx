'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2 } from 'lucide-react';
import Layout from '../../../components/Layout';
import PageAccessControl from '../../../components/PageAccessControl';

interface Location {
  location_id: number;
  location_code: string;
  location_name: string;
  is_active: boolean;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({
    location_code: '',
    location_name: ''
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .order('location_name');
      
      if (data) setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('locations')
          .update(formData)
          .eq('location_id', editingLocation.location_id);
        
        if (error) throw error;
        alert('Location updated successfully');
      } else {
        const { error } = await supabase
          .from('locations')
          .insert([formData]);
        
        if (error) throw error;
        alert('Location added successfully');
      }

      setShowForm(false);
      setEditingLocation(null);
      setFormData({ location_code: '', location_name: '' });
      fetchLocations();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      location_code: location.location_code,
      location_name: location.location_name
    });
    setShowForm(true);
  };

  const handleDelete = async (location: Location) => {
    if (!confirm(`Delete location "${location.location_name}"?`)) return;
    
    try {
      // Check if location is being used by assets first
      const { data: assetsUsingLocation } = await supabase
        .from('assets')
        .select('asset_id, asset_name')
        .eq('location', location.location_code)
        .limit(5);
      
      if (assetsUsingLocation && assetsUsingLocation.length > 0) {
        const assetNames = assetsUsingLocation.map(a => a.asset_name).join(', ');
        alert(`Cannot delete location "${location.location_name}" because it is being used by ${assetsUsingLocation.length} asset(s): ${assetNames}${assetsUsingLocation.length === 5 ? '...' : ''}`);
        return;
      }

      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('location_id', location.location_id);
      
      if (error) throw error;
      
      // Update local state immediately
      setLocations(prev => prev.filter(loc => loc.location_id !== location.location_id));
      alert('Location deleted successfully');
    } catch (error: any) {
      alert('Error deleting location: ' + error.message);
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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Manage Locations</h1>
              <p className="text-gray-600">Add and manage asset locations</p>
            </div>
            <button
              onClick={() => {
                setEditingLocation(null);
                setFormData({ location_code: '', location_name: '' });
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Location
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location Code
                  </label>
                  <input
                    type="text"
                    value={formData.location_code}
                    onChange={(e) => setFormData({ ...formData, location_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., PARKIR"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location Name
                  </label>
                  <input
                    type="text"
                    value={formData.location_name}
                    onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., Area Parkir"
                    required
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {editingLocation ? 'Update' : 'Add'} Location
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {locations.map((location) => (
                  <tr key={location.location_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {location.location_code}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {location.location_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        location.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {location.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(location)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(location)}
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
      </PageAccessControl>
    </Layout>
  );
}