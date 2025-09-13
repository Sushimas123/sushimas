'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import Link from 'next/link';
import { Plus, Edit2, Trash2, Search, Download, Upload, ArrowUpDown, List, Grid } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { canPerformActionSync, reloadPermissions } from '@/src/utils/rolePermissions';
import { hasPageAccess } from '@/src/utils/permissionChecker';
import PageAccessControl from '../../components/PageAccessControl';

// Helper function to convert text to Title Case
const toTitleCase = (str: any) => {
  if (str === null || str === undefined) return ""
  return String(str)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

interface Supplier {
  id_supplier: number;
  nama_supplier: string;
  nomor_rekening: string | null;
  bank_penerima: string | null;
  nama_penerima: string | null;
  termin_tempo: number;
  estimasi_pengiriman: number;
  divisi: string | null;
  created_by: string | null;
  nama_barang: string | null;
  merk: string | null;
  created_at: string;
  updated_at: string;
}

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'group'>('table');
  const [formData, setFormData] = useState({
    nama_supplier: '',
    nomor_rekening: '',
    bank_penerima: '',
    nama_penerima: '',
    termin_tempo: 0,
    estimasi_pengiriman: 1,
    divisi: '',
    created_by: '',
    nama_barang: '',
    merk: ''
  });
  const [userRole, setUserRole] = useState<string>('guest');

  // Get user role
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role || 'guest');
    }
  }, []);

  // const supabase = createClient(); // removed - using imported supabase

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('nama_supplier')
        .order('nama_barang');

      if (error) {
        throw error;
      }

      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_supplier.trim()) {
      alert('Nama supplier wajib diisi');
      return;
    }

    // Check for duplicate supplier + item combination (skip if editing)
    const isDuplicate = suppliers.some(supplier => 
      supplier.id_supplier !== editingId &&
      supplier.nama_supplier.toLowerCase() === formData.nama_supplier.toLowerCase() &&
      (supplier.nama_barang || '').toLowerCase() === (formData.nama_barang || '').toLowerCase()
    );

    if (isDuplicate) {
      alert('Kombinasi supplier dan barang sudah ada!');
      return;
    }

    setAddLoading(true);
    try {
      if (editingId) {
        // Update existing supplier
        const { error } = await supabase
          .from('suppliers')
          .update(formData)
          .eq('id_supplier', editingId);

        if (error) throw error;
        alert('Supplier berhasil diupdate!');
      } else {
        // Add new supplier
        const { error } = await supabase
          .from('suppliers')
          .insert([formData]);

        if (error) throw error;
        alert('Supplier berhasil ditambahkan!');
      }

      setFormData({
        nama_supplier: '',
        nomor_rekening: '',
        bank_penerima: '',
        nama_penerima: '',
        termin_tempo: 0,
        estimasi_pengiriman: 1,
        divisi: '',
        created_by: '',
        nama_barang: '',
        merk: ''
      });
      setShowAddForm(false);
      setEditingId(null);
      await fetchSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      alert('Gagal menyimpan supplier');
    } finally {
      setAddLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'termin_tempo' || name === 'estimasi_pengiriman' ? parseInt(value) || 0 : value
    }));
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(suppliers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
    XLSX.writeFile(wb, `suppliers_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const importData = jsonData.map((row: any) => ({
        nama_supplier: row.nama_supplier?.toString().trim(),
        nomor_rekening: row.nomor_rekening?.toString().trim() || null,
        bank_penerima: row.bank_penerima?.toString().trim() || null,
        nama_penerima: row.nama_penerima?.toString().trim() || null,
        termin_tempo: parseInt(row.termin_tempo) || 0,
        estimasi_pengiriman: parseInt(row.estimasi_pengiriman) || 1,
        divisi: row.divisi?.toString().trim() || null,
        created_by: row.created_by?.toString().trim() || null,
        nama_barang: row.nama_barang?.toString().trim() || null,
        merk: row.merk?.toString().trim() || null
      })).filter((item: any) => item.nama_supplier);

      // Remove duplicates
      const seenKeys = new Set();
      const uniqueImportData = importData.filter((item: any) => {
        const key = `${item.nama_supplier.toLowerCase()}_${(item.nama_barang || '').toLowerCase()}`;
        
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        
        return !suppliers.some(supplier => 
          supplier.nama_supplier.toLowerCase() === item.nama_supplier.toLowerCase() &&
          (supplier.nama_barang || '').toLowerCase() === (item.nama_barang || '').toLowerCase()
        );
      });

      const { error } = await supabase
        .from('suppliers')
        .insert(uniqueImportData);

      if (error) throw error;

      const skippedCount = importData.length - uniqueImportData.length;
      const message = skippedCount > 0 
        ? `Berhasil import ${uniqueImportData.length} supplier! ${skippedCount} duplikat dilewati.`
        : `Berhasil import ${uniqueImportData.length} supplier!`;
      alert(message);
      await fetchSuppliers();
    } catch (error: any) {
      console.error('Error importing:', error);
      alert(`Gagal import: ${error.message}`);
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus supplier ini?')) {
      return;
    }

    setDeleteLoading(id);
    
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id_supplier', id);

      if (error) {
        throw error;
      }

      // Refresh list setelah delete
      await fetchSuppliers();
      alert('Supplier berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting supplier:', error);
      alert('Gagal menghapus supplier');
    } finally {
      setDeleteLoading(null);
    }
  };



  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedSuppliers = suppliers
    .filter(supplier =>
      supplier.nama_supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.nomor_rekening?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.bank_penerima?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.divisi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.nama_barang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.merk?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortConfig) return 0;
      
      const aValue = a[sortConfig.key as keyof Supplier] || '';
      const bValue = b[sortConfig.key as keyof Supplier] || '';
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  // Group suppliers by nama_supplier for group view
  const groupedSuppliers = filteredAndSortedSuppliers.reduce((acc, supplier) => {
    const key = supplier.nama_supplier;
    if (!acc[key]) {
      acc[key] = {
        supplier_info: supplier,
        items: []
      };
    }
    acc[key].items.push(supplier);
    return acc;
  }, {} as Record<string, { supplier_info: Supplier; items: Supplier[] }>);

  const totalPages = viewMode === 'table' 
    ? Math.ceil(filteredAndSortedSuppliers.length / pageSize)
    : Math.ceil(Object.keys(groupedSuppliers).length / pageSize);
  
  const paginatedSuppliers = viewMode === 'table'
    ? filteredAndSortedSuppliers.slice((page - 1) * pageSize, page * pageSize)
    : Object.entries(groupedSuppliers).slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageAccessControl pageName="supplier">
        <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-sm font-bold text-gray-800">📦 Supplier Management</h1>
      </div>

      {/* Add Supplier Form */}
      {showAddForm && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h3 className="font-medium text-gray-800 mb-3 text-xs">{editingId ? 'Edit Supplier' : 'Tambah Supplier Baru'}</h3>
          <form onSubmit={handleAddSupplier} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                name="nama_supplier"
                value={formData.nama_supplier}
                onChange={handleInputChange}
                required
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Nama Supplier *"
              />
              <input
                type="text"
                name="nomor_rekening"
                value={formData.nomor_rekening}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Nomor Rekening"
              />
              <input
                type="text"
                name="bank_penerima"
                value={formData.bank_penerima}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Bank Penerima"
              />
              <input
                type="text"
                name="nama_penerima"
                value={formData.nama_penerima}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Nama Penerima"
              />
              <input
                type="number"
                name="termin_tempo"
                value={formData.termin_tempo || ''}
                onChange={handleInputChange}
                min="0"
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Termin Tempo"
              />
              <input
                type="number"
                name="estimasi_pengiriman"
                value={formData.estimasi_pengiriman || ''}
                onChange={handleInputChange}
                min="0"
                required
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Estimasi Pengiriman"
              />
              <input
                type="text"
                name="divisi"
                value={formData.divisi}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Divisi"
              />
              <input
                type="text"
                name="created_by"
                value={formData.created_by}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Created By"
              />
              <input
                type="text"
                name="nama_barang"
                value={formData.nama_barang}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Nama Barang"
              />
              <input
                type="text"
                name="merk"
                value={formData.merk}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Merk"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addLoading}
                className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-xs disabled:opacity-50"
              >
                {addLoading ? 'Saving...' : (editingId ? 'Update' : 'Save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingId(null);
                  setFormData({
                    nama_supplier: '',
                    nomor_rekening: '',
                    bank_penerima: '',
                    nama_penerima: '',
                    termin_tempo: 0,
                    estimasi_pengiriman: 1,
                    divisi: '',
                    created_by: '',
                    nama_barang: '',
                    merk: ''
                  });
                }}
                className="bg-gray-600 text-white px-3 py-1 rounded-md hover:bg-gray-700 text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Controls */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border px-2 py-1 rounded-md text-xs w-full"
            />
          </div>
          <div className="flex gap-2">
            {(userRole === 'super admin' || userRole === 'admin') && (
              <button
                onClick={handleExport}
                className="bg-green-600 text-white px-2 py-1 rounded-md hover:bg-green-700 text-xs flex items-center gap-1"
              >
                <Download size={16} />
                Export
              </button>
            )}
            {(userRole === 'super admin' || userRole === 'admin') && (
              <label className="bg-orange-600 text-white px-2 py-1 rounded-md hover:bg-orange-700 text-xs flex items-center gap-1 cursor-pointer">
                <Upload size={16} />
                Import
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                  className="hidden"
                  disabled={importLoading}
                />
              </label>
            )}
            <div className="flex gap-1 border rounded-md">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm flex items-center gap-1 ${
                  viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <List size={16} />
                Table
              </button>
              <button
                onClick={() => setViewMode('group')}
                className={`px-2 py-1 text-xs flex items-center gap-1 ${
                  viewMode === 'group' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Grid size={16} />
                Group
              </button>
            </div>
            {canPerformActionSync(userRole, 'supplier', 'create') && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 text-xs flex items-center gap-1"
              >
                <Plus size={16} />
                Add New
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th 
                  className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('nama_supplier')}
                >
                  <div className="flex items-center gap-1">
                    Nama Supplier
                    <ArrowUpDown size={8} />
                  </div>
                </th>
                <th 
                  className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('nama_barang')}
                >
                  <div className="flex items-center gap-1">
                    Nama Barang
                    <ArrowUpDown size={8} />
                  </div>
                </th>
                <th 
                  className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('merk')}
                >
                  <div className="flex items-center gap-1">
                    Merk
                    <ArrowUpDown size={8} />
                  </div>
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Rekening</th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Bank</th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Penerima</th>
                <th 
                  className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('termin_tempo')}
                >
                  <div className="flex items-center gap-1">
                    Tempo
                    <ArrowUpDown size={8} />
                  </div>
                </th>
                <th 
                  className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('estimasi_pengiriman')}
                >
                  <div className="flex items-center gap-1">
                    Kirim
                    <ArrowUpDown size={8} />
                  </div>
                </th>
                <th 
                  className="px-1 py-1 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('divisi')}
                >
                  <div className="flex items-center gap-1">
                    Divisi
                    <ArrowUpDown size={8} />
                  </div>
                </th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-1 py-2 text-center text-gray-500">
                    {searchTerm ? 'No suppliers found' : 'No suppliers yet'}
                  </td>
                </tr>
              ) : (
                (paginatedSuppliers as Supplier[]).map((supplier) => (
                  <tr key={supplier.id_supplier} className="hover:bg-gray-50">
                    <td className="px-1 py-1 font-medium text-gray-900">{toTitleCase(supplier.nama_supplier)}</td>
                    <td className="px-1 py-1 text-gray-600">{toTitleCase(supplier.nama_barang) || '-'}</td>
                    <td className="px-1 py-1 text-gray-600">{toTitleCase(supplier.merk) || '-'}</td>
                    <td className="px-1 py-1 text-gray-600">{toTitleCase(supplier.nomor_rekening) || '-'}</td>
                    <td className="px-1 py-1 text-gray-600">{toTitleCase(supplier.bank_penerima) || '-'}</td>
                    <td className="px-1 py-1 text-gray-600">{toTitleCase(supplier.nama_penerima) || '-'}</td>
                    <td className="px-1 py-1 text-gray-600">{supplier.termin_tempo} hari</td>
                    <td className="px-1 py-1 text-gray-600">{supplier.estimasi_pengiriman} hari</td>
                    <td className="px-1 py-1 text-gray-600">{toTitleCase(supplier.divisi) || '-'}</td>
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        {canPerformActionSync(userRole, 'supplier', 'edit') && (
                          <button
                            onClick={() => {
                              setFormData({
                                nama_supplier: supplier.nama_supplier,
                                nomor_rekening: supplier.nomor_rekening || '',
                                bank_penerima: supplier.bank_penerima || '',
                                nama_penerima: supplier.nama_penerima || '',
                                termin_tempo: supplier.termin_tempo,
                                estimasi_pengiriman: supplier.estimasi_pengiriman,
                                divisi: supplier.divisi || '',
                                created_by: supplier.created_by || '',
                                nama_barang: supplier.nama_barang || '',
                                merk: supplier.merk || ''
                              });
                              setEditingId(supplier.id_supplier);
                              setShowAddForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        {canPerformActionSync(userRole, 'supplier', 'delete') && (
                          <button
                            onClick={() => handleDelete(supplier.id_supplier)}
                            disabled={deleteLoading === supplier.id_supplier}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 disabled:opacity-50"
                            title="Delete"
                          >
                            {deleteLoading === supplier.id_supplier ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Group View */}
      {viewMode === 'group' && (
        <div className="space-y-2">
          {paginatedSuppliers.length === 0 ? (
            <div className="bg-white p-4 rounded shadow text-center text-gray-500 text-sm">
              {searchTerm ? 'No suppliers found' : 'No suppliers yet'}
            </div>
          ) : (
            (paginatedSuppliers as [string, { supplier_info: Supplier; items: Supplier[] }][]).map(([supplierName, group]) => (
              <div key={supplierName} className="bg-white rounded shadow border">
                {/* Supplier Header */}
                <div className="bg-blue-500 text-white p-2 rounded-t">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold">{toTitleCase(supplierName)}</h3>
                      <div className="text-xs opacity-90">
                        {toTitleCase(group.supplier_info.bank_penerima) || 'No bank'} • {group.supplier_info.termin_tempo} hari
                      </div>
                    </div>
                    <div className="text-xs">
                      {group.items.length} items
                    </div>
                  </div>
                </div>
                
                {/* Items List */}
                <div className="p-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1">
                    {group.items.map((item) => (
                      <div key={item.id_supplier} className="bg-gray-50 rounded p-1.5 border text-xs hover:shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 truncate">{toTitleCase(item.nama_barang) || 'No name'}</div>
                            <div className="text-gray-500 truncate">{toTitleCase(item.divisi) || '-'}</div>
                          </div>
                          <div className="flex gap-0.5 ml-1">
                            {canPerformActionSync(userRole, 'supplier', 'edit') && (
                              <button
                                onClick={() => {
                                  setFormData({
                                    nama_supplier: item.nama_supplier,
                                    nomor_rekening: item.nomor_rekening || '',
                                    bank_penerima: item.bank_penerima || '',
                                    nama_penerima: item.nama_penerima || '',
                                    termin_tempo: item.termin_tempo,
                                    estimasi_pengiriman: item.estimasi_pengiriman,
                                    divisi: item.divisi || '',
                                    created_by: item.created_by || '',
                                    nama_barang: item.nama_barang || '',
                                    merk: item.merk || ''
                                  });
                                  setEditingId(item.id_supplier);
                                  setShowAddForm(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 p-0.5 rounded"
                                title="Edit"
                              >
                                <Edit2 size={10} />
                              </button>
                            )}
                            {canPerformActionSync(userRole, 'supplier', 'delete') && (
                              <button
                                onClick={() => handleDelete(item.id_supplier)}
                                disabled={deleteLoading === item.id_supplier}
                                className="text-red-600 hover:text-red-800 p-0.5 rounded disabled:opacity-50"
                                title="Delete"
                              >
                                {deleteLoading === item.id_supplier ? (
                                  <div className="animate-spin rounded-full h-2 w-2 border-b border-red-600"></div>
                                ) : (
                                  <Trash2 size={10} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages} ({filteredAndSortedSuppliers.length} total suppliers)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-200 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </PageAccessControl>
    </Layout>
  );
}