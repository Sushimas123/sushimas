'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2, Tag } from 'lucide-react';
import Layout from '../../../components/Layout';
import PageAccessControl from '../../../components/PageAccessControl';

interface AssetCategory {
  category_id: number;
  category_name: string;
  category_type: string;
  depreciation_rate: number;
  useful_life: number;
  created_at: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null);
  const [formData, setFormData] = useState({
    category_name: '',
    category_type: 'KITCHEN',
    depreciation_rate: '',
    useful_life: ''
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from('asset_categories')
        .select('*')
        .order('category_name');
      
      if (data) setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        depreciation_rate: parseFloat(formData.depreciation_rate) || 0,
        useful_life: parseInt(formData.useful_life) || 0
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('asset_categories')
          .update(payload)
          .eq('category_id', editingCategory.category_id);
        
        if (error) throw error;
        alert('Category updated successfully');
      } else {
        const { error } = await supabase
          .from('asset_categories')
          .insert([payload]);
        
        if (error) throw error;
        alert('Category added successfully');
      }

      setShowForm(false);
      setEditingCategory(null);
      setFormData({ category_name: '', category_type: 'KITCHEN', depreciation_rate: '', useful_life: '' });
      fetchCategories();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleEdit = (category: AssetCategory) => {
    setEditingCategory(category);
    setFormData({
      category_name: category.category_name,
      category_type: category.category_type,
      depreciation_rate: category.depreciation_rate.toString(),
      useful_life: category.useful_life.toString()
    });
    setShowForm(true);
  };

  const handleDelete = async (category: AssetCategory) => {
    if (!confirm(`Delete category "${category.category_name}"?`)) return;
    
    try {
      // Check if category is being used by assets
      const { data: assetsUsingCategory } = await supabase
        .from('assets')
        .select('asset_id, asset_name')
        .eq('category_id', category.category_id)
        .limit(5);
      
      if (assetsUsingCategory && assetsUsingCategory.length > 0) {
        const assetNames = assetsUsingCategory.map(a => a.asset_name).join(', ');
        alert(`Cannot delete category "${category.category_name}" because it is being used by ${assetsUsingCategory.length} asset(s): ${assetNames}${assetsUsingCategory.length === 5 ? '...' : ''}`);
        return;
      }

      const { error } = await supabase
        .from('asset_categories')
        .delete()
        .eq('category_id', category.category_id);
      
      if (error) throw error;
      
      setCategories(prev => prev.filter(cat => cat.category_id !== category.category_id));
      alert('Category deleted successfully');
    } catch (error: any) {
      alert('Error deleting category: ' + error.message);
    }
  };

  const getCategoryTypeColor = (type: string) => {
    switch (type) {
      case 'KITCHEN': return 'bg-red-100 text-red-800';
      case 'DINING': return 'bg-blue-100 text-blue-800';
      case 'FURNITURE': return 'bg-green-100 text-green-800';
      case 'ELECTRONIC': return 'bg-purple-100 text-purple-800';
      case 'UTILITY': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
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
              <h1 className="text-2xl font-bold text-gray-800">Asset Categories</h1>
              <p className="text-gray-600">Manage asset categories and depreciation settings</p>
            </div>
            <button
              onClick={() => {
                setEditingCategory(null);
                setFormData({ category_name: '', category_type: 'KITCHEN', depreciation_rate: '', useful_life: '' });
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Category
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={formData.category_name}
                    onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., Kitchen Equipment"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Type
                  </label>
                  <select
                    value={formData.category_type}
                    onChange={(e) => setFormData({ ...formData, category_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="KITCHEN">Kitchen</option>
                    <option value="DINING">Dining</option>
                    <option value="FURNITURE">Furniture</option>
                    <option value="ELECTRONIC">Electronic</option>
                    <option value="UTILITY">Utility</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Depreciation Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.depreciation_rate}
                    onChange={(e) => setFormData({ ...formData, depreciation_rate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., 20.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Useful Life (Years)
                  </label>
                  <input
                    type="number"
                    value={formData.useful_life}
                    onChange={(e) => setFormData({ ...formData, useful_life: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., 5"
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {editingCategory ? 'Update' : 'Add'} Category
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Category Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Depreciation Rate</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Useful Life</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categories.map((category) => (
                  <tr key={category.category_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {category.category_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${getCategoryTypeColor(category.category_type)}`}>
                        {category.category_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {category.depreciation_rate}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {category.useful_life} years
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
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