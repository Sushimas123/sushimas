'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';

interface Category {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  expense_count?: number;
}

function PettyCashCategoriesContent() {
  const [categories, setCategories] = useState<Category[]>([
    { id: 1, name: 'Transportasi', description: 'Biaya transportasi dan perjalanan', is_active: true, created_at: '2025-01-01', expense_count: 5 },
    { id: 2, name: 'Konsumsi', description: 'Makanan dan minuman untuk kegiatan kantor', is_active: true, created_at: '2025-01-01', expense_count: 12 },
    { id: 3, name: 'ATK', description: 'Alat tulis kantor dan supplies', is_active: true, created_at: '2025-01-01', expense_count: 8 },
    { id: 4, name: 'Maintenance', description: 'Perawatan dan perbaikan peralatan', is_active: false, created_at: '2025-01-01', expense_count: 3 }
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const filteredCategories = categories.filter(category =>
    (showInactive || category.is_active) &&
    (category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      setCategories(prev => prev.map(cat => 
        cat.id === editingCategory.id 
          ? { ...cat, name: formData.name, description: formData.description }
          : cat
      ));
      setEditingCategory(null);
    } else {
      const newCategory: Category = {
        id: Date.now(),
        name: formData.name,
        description: formData.description,
        is_active: true,
        created_at: new Date().toISOString(),
        expense_count: 0
      };
      setCategories(prev => [...prev, newCategory]);
    }
    setFormData({ name: '', description: '' });
    setIsCreateModalOpen(false);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, description: category.description });
    setIsCreateModalOpen(true);
  };

  const toggleStatus = (id: number) => {
    setCategories(prev => prev.map(cat => 
      cat.id === id ? { ...cat, is_active: !cat.is_active } : cat
    ));
  };

  const deleteCategory = (id: number) => {
    if (confirm('Yakin ingin menghapus kategori ini?')) {
      setCategories(prev => prev.filter(cat => cat.id !== id));
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Kategori Petty Cash</h1>
        <button 
          onClick={() => { setIsCreateModalOpen(true); setEditingCategory(null); setFormData({ name: '', description: '' }); }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Tambah Kategori
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded border">
          <div className="text-sm text-gray-600">Total Kategori</div>
          <div className="text-2xl font-bold">{categories.length}</div>
        </div>
        <div className="bg-white p-4 rounded border">
          <div className="text-sm text-gray-600">Kategori Aktif</div>
          <div className="text-2xl font-bold">{categories.filter(c => c.is_active).length}</div>
        </div>
        <div className="bg-white p-4 rounded border">
          <div className="text-sm text-gray-600">Kategori Nonaktif</div>
          <div className="text-2xl font-bold">{categories.filter(c => !c.is_active).length}</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded border mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Cari kategori..."
            className="flex-1 border rounded px-3 py-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={() => setShowInactive(!showInactive)}
            className={`px-4 py-2 rounded ${showInactive ? 'bg-blue-600 text-white' : 'border'}`}
          >
            {showInactive ? 'Semua' : 'Hanya Aktif'}
          </button>
        </div>
      </div>

      {/* Categories List */}
      <div className="bg-white rounded border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Daftar Kategori ({filteredCategories.length})</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCategories.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-4 border rounded">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${category.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{category.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${category.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {category.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{category.description}</p>
                    <div className="text-xs text-gray-500">{category.expense_count} pengeluaran</div>
                  </div>
                </div>
                
                <div className="flex space-x-1">
                  <button onClick={() => handleEdit(category)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                    ✏️
                  </button>
                  <button onClick={() => toggleStatus(category.id)} className="p-2 text-gray-600 hover:bg-gray-50 rounded">
                    {category.is_active ? '👁️' : '🚫'}
                  </button>
                  <button 
                    onClick={() => deleteCategory(category.id)}
                    disabled={Boolean(category.expense_count && category.expense_count > 0)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {filteredCategories.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-medium">Tidak ada kategori</h3>
              <p className="text-gray-600">
                {searchTerm || !showInactive 
                  ? 'Coba ubah pencarian atau filter' 
                  : 'Belum ada kategori yang dibuat'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">{editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nama Kategori</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Masukkan nama kategori"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Deskripsi</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Masukkan deskripsi kategori"
                  rows={3}
                  required
                />
              </div>
              <div className="flex space-x-2">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 border rounded px-4 py-2">
                  Batal
                </button>
                <button type="submit" className="flex-1 bg-blue-600 text-white rounded px-4 py-2">
                  {editingCategory ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PettyCashCategoriesPage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <PettyCashCategoriesContent />
      </Layout>
    </PageAccessControl>
  );
}