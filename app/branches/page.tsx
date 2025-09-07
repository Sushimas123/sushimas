'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import Link from 'next/link';
import { Plus, Edit, Trash2, Search, Phone, Mail, Download, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import { canPerformActionSync } from '@/src/utils/rolePermissions';

interface Branch {
  id_branch: number;
  kode_branch: string;
  nama_branch: string;
  alamat: string;
  kota: string;
  provinsi: string;
  jam_buka: string;
  jam_tutup: string;
  hari_operasional: string;
  pic_id: number;
  is_active: boolean;
  pic_nama: string;
  pic_no_telp: string | null;
  pic_email: string;
}

interface User {
  id_user: number;
  nama_lengkap: string;
  email: string;
}

function BranchesPageContent() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [picSearch, setPicSearch] = useState('');
  const [showPicDropdown, setShowPicDropdown] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    kode_branch: '',
    nama_branch: '',
    alamat: '',
    kota: '',
    provinsi: '',
    kode_pos: '',
    jam_buka: '08:00',
    jam_tutup: '17:00',
    hari_operasional: 'Senin-Jumat',
    pic_id: 0,
    tanggal_berdiri: ''
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const picDropdownRef = useRef<HTMLDivElement>(null);
  const [userRole, setUserRole] = useState<string>('guest');

  // Get user role
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role || 'guest');
    }
  }, []);

  // Using imported supabase client

  useEffect(() => {
    fetchBranches();
    fetchUsers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (picDropdownRef.current && !picDropdownRef.current.contains(event.target as Node)) {
        setShowPicDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select(`
          *,
          users!pic_id(nama_lengkap, no_telp, email)
        `)
        .eq('is_active', true)
        .order('kota')
        .order('nama_branch');

      if (error) {
        throw error;
      }

      // Transform data to include PIC info
      const transformedData = data?.map((branch: any) => ({
        ...branch,
        pic_nama: branch.users?.nama_lengkap || '',
        pic_no_telp: branch.users?.no_telp || null,
        pic_email: branch.users?.email || ''
      })) || [];

      setBranches(transformedData);
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id_user, nama_lengkap, email')
        .eq('is_active', true)
        .order('nama_lengkap');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.nama_branch.trim() || !formData.alamat.trim() || !formData.kota.trim() || !formData.provinsi.trim() || !formData.pic_id || formData.pic_id === 0) {
      return;
    }

    setSaving(true);
    try {
      // Generate unique kode_branch if not provided
      let kodeBranch = formData.kode_branch;
      if (!kodeBranch && !editingId) {
        const cityCode = formData.kota.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'XXX';
        let attempts = 0;
        let isUnique = false;
        
        while (!isUnique && attempts < 10) {
          const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          kodeBranch = `${cityCode}${randomNum}`;
          
          const { data: existing } = await supabase
            .from('branches')
            .select('id_branch')
            .eq('kode_branch', kodeBranch)
            .single();
          
          if (!existing) {
            isUnique = true;
          }
          attempts++;
        }
        
        if (!isUnique) {
          return;
        }
      }
      
      const submitData = {
        ...formData,
        kode_branch: kodeBranch,
        kode_pos: formData.kode_pos || null,
        tanggal_berdiri: formData.tanggal_berdiri || null
      };

      if (editingId) {
        const { error } = await supabase
          .from('branches')
          .update(submitData)
          .eq('id_branch', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('branches')
          .insert([submitData]);

        if (error) throw error;
      }

      setFormData({
        kode_branch: '',
        nama_branch: '',
        alamat: '',
        kota: '',
        provinsi: '',
        kode_pos: '',
        jam_buka: '08:00',
        jam_tutup: '17:00',
        hari_operasional: 'Senin-Jumat',
        pic_id: 0,
        tanggal_berdiri: ''
      });
      setPicSearch('');
      setShowAddForm(false);
      setEditingId(null);
      await fetchBranches();
    } catch (error: any) {
      console.error('Error saving branch:', error);
      let errorMessage = 'Unknown error';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (error?.hint) {
        errorMessage = error.hint;
      } else if (error?.code) {
        errorMessage = `Database error (${error.code})`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = JSON.stringify(error);
      }
      
      console.error(`Gagal menyimpan branch: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: name === 'pic_id' ? parseInt(value) || 0 : value
      };
      

      
      return newData;
    });
  };

  const handlePicSelect = (user: User) => {
    setFormData(prev => ({ ...prev, pic_id: user.id_user }));
    setPicSearch(user.nama_lengkap);
    setShowPicDropdown(false);
  };

  const filteredUsers = users.filter(user =>
    user.nama_lengkap.toLowerCase().includes(picSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(picSearch.toLowerCase())
  );

  const getSelectedUserName = () => {
    const selectedUser = users.find(user => user.id_user === formData.pic_id);
    return selectedUser ? selectedUser.nama_lengkap : '';
  };

  const handleEdit = (branch: Branch) => {
    setFormData({
      kode_branch: branch.kode_branch,
      nama_branch: branch.nama_branch,
      alamat: branch.alamat,
      kota: branch.kota,
      provinsi: branch.provinsi,
      kode_pos: (branch as any).kode_pos || '',
      jam_buka: branch.jam_buka,
      jam_tutup: branch.jam_tutup,
      hari_operasional: branch.hari_operasional,
      pic_id: branch.pic_id,
      tanggal_berdiri: (branch as any).tanggal_berdiri || ''
    });
    setPicSearch(branch.pic_nama);
    setEditingId(branch.id_branch);
    setShowAddForm(true);
  };

  const handleExport = () => {
    if (branches.length === 0) {
      return;
    }
    
    const ws = XLSX.utils.json_to_sheet(branches.map(branch => ({
      kode_branch: branch.kode_branch,
      nama_branch: branch.nama_branch,
      alamat: branch.alamat,
      kota: branch.kota,
      provinsi: branch.provinsi,
      jam_buka: branch.jam_buka,
      jam_tutup: branch.jam_tutup,
      hari_operasional: branch.hari_operasional,
      pic_id: branch.pic_id
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Branches");
    XLSX.writeFile(wb, `branches_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        kode_branch: row.kode_branch?.toString().trim() || '',
        nama_branch: row.nama_branch?.toString().trim() || '',
        alamat: row.alamat?.toString().trim() || '',
        kota: row.kota?.toString().trim() || '',
        provinsi: row.provinsi?.toString().trim() || '',
        jam_buka: row.jam_buka?.toString().trim() || '',
        jam_tutup: row.jam_tutup?.toString().trim() || '',
        hari_operasional: row.hari_operasional?.toString().trim() || '',
        pic_id: parseInt(row.pic_id) || 0,
        is_active: true
      })).filter((item: any) => item.nama_branch);

      if (importData.length === 0) {
        return;
      }

      let successCount = 0;
      let updateCount = 0;

      for (const entry of importData) {
        const { data: existing } = await supabase
          .from('branches')
          .select('id_branch')
          .eq('kode_branch', entry.kode_branch)
          .single();

        if (existing) {
          const { error } = await supabase
            .from('branches')
            .update(entry)
            .eq('id_branch', existing.id_branch);

          if (!error) {
            updateCount++;
            successCount++;
          }
        } else {
          const { error } = await supabase
            .from('branches')
            .insert([entry]);

          if (!error) successCount++;
        }
      }

      if (successCount > 0) {
        fetchBranches();
      }

    } catch (error) {
      console.error('Failed to import Excel file:', error);
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus branch ini?')) {
      return;
    }

    setDeleteLoading(id);
    
    try {
      const { error } = await supabase
        .from('branches')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id_branch', id);

      if (error) {
        throw error;
      }

      await fetchBranches();
    } catch (error) {
      console.error('Error deleting branch:', error);
    } finally {
      setDeleteLoading(null);
    }
  };

  const filteredBranches = branches.filter(branch =>
    branch.nama_branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.kota.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.kode_branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.pic_nama.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5); // Remove seconds
  };

  if (loading) {
    return (
      <div className="p-2">
        <div className="bg-white p-2 rounded-lg shadow text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mb-1"></div>
            <p className="text-xs text-gray-600">Loading branches...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 md:p-2">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-sm font-bold text-gray-800">📍 Branch Management</h1>
      </div>

      {/* Search & Add Button */}
      <div className="bg-white p-1 rounded-lg shadow mb-1">
        <div className="flex flex-col md:flex-row gap-1 items-start md:items-end">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search branches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border px-2 py-1 rounded-md text-xs w-full"
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleExport}
              className="bg-green-600 text-white px-2 py-1 rounded-md hover:bg-green-700 text-xs flex items-center gap-1"
            >
              <Download size={12} />
              Export
            </button>
            <label className="bg-orange-600 text-white px-2 py-1 rounded-md hover:bg-orange-700 text-xs flex items-center gap-1 cursor-pointer">
              <Upload size={12} />
              Import
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
                disabled={importLoading}
              />
            </label>
            {canPerformActionSync(userRole, 'branches', 'create') && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1"
              >
                <Plus size={12} />
                Add New
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Branch Form */}
      {showAddForm && (
        <div className="bg-white p-1 rounded-lg shadow mb-1">
          <h3 className="font-medium text-gray-800 mb-2 text-xs">{editingId ? 'Edit Branch' : 'Tambah Branch Baru'}</h3>
          <form onSubmit={handleAddBranch} className="space-y-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
              <input
                type="text"
                name="kode_branch"
                value={formData.kode_branch}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Kode Branch (auto-generated)"
                disabled={!editingId}
              />
              <input
                type="text"
                name="nama_branch"
                value={formData.nama_branch}
                onChange={handleInputChange}
                required
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Nama Branch *"
              />
              <input
                type="text"
                name="alamat"
                value={formData.alamat}
                onChange={handleInputChange}
                required
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Alamat *"
              />
              <input
                type="text"
                name="kota"
                value={formData.kota}
                onChange={handleInputChange}
                required
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Kota *"
              />
              <input
                type="text"
                name="provinsi"
                value={formData.provinsi}
                onChange={handleInputChange}
                required
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Provinsi *"
              />
              <input
                type="time"
                name="jam_buka"
                value={formData.jam_buka}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Jam Buka"
              />
              <input
                type="time"
                name="jam_tutup"
                value={formData.jam_tutup}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Jam Tutup"
              />
              <input
                type="text"
                name="kode_pos"
                value={formData.kode_pos}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Kode Pos"
              />
              <select
                name="hari_operasional"
                value={formData.hari_operasional}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
              >
                <option value="Senin-Jumat">Senin-Jumat</option>
                <option value="Senin-Sabtu">Senin-Sabtu</option>
                <option value="Setiap Hari">Setiap Hari</option>
                <option value="Senin-Minggu">Senin-Minggu</option>
              </select>
              <div className="relative" ref={picDropdownRef}>
                <input
                  type="text"
                  value={picSearch || getSelectedUserName()}
                  onChange={(e) => {
                    setPicSearch(e.target.value);
                    setShowPicDropdown(true);
                  }}
                  onFocus={() => setShowPicDropdown(true)}
                  required
                  className="border px-2 py-1 rounded-md text-xs w-full"
                  placeholder="Search PIC by name *"
                />
                {showPicDropdown && filteredUsers.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-32 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id_user}
                        onClick={() => handlePicSelect(user)}
                        className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs"
                      >
                        <div className="font-medium">{user.nama_lengkap}</div>
                        <div className="text-gray-500 text-xs">{user.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="date"
                name="tanggal_berdiri"
                value={formData.tanggal_berdiri}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Tanggal Berdiri"
              />
            </div>
            <div className="flex gap-1">
              <button
                type="submit"
                disabled={saving}
                className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-xs disabled:opacity-50"
              >
                {saving ? 'Saving...' : (editingId ? 'Update' : 'Save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingId(null);
                  setFormData({
                    kode_branch: '',
                    nama_branch: '',
                    alamat: '',
                    kota: '',
                    provinsi: '',
                    kode_pos: '',
                    jam_buka: '08:00',
                    jam_tutup: '17:00',
                    hari_operasional: 'Senin-Jumat',
                    pic_id: 0,
                    tanggal_berdiri: ''
                  });
                  setPicSearch('');
                }}
                className="bg-gray-600 text-white px-3 py-1 rounded-md hover:bg-gray-700 text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branches Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Kode</th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Nama Branch</th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Lokasi</th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Jam Operasional</th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">PIC</th>
                <th className="px-1 py-1 text-left font-medium text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-1 py-2 text-center text-gray-500 text-xs">
                    {searchTerm ? 'Tidak ada branch yang sesuai dengan pencarian' : 'Belum ada data branch'}
                  </td>
                </tr>
              ) : (
                filteredBranches.map((branch) => (
                  <tr key={branch.id_branch} className="hover:bg-gray-50">
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="font-medium text-blue-600">{branch.kode_branch}</div>
                    </td>
                    <td className="px-1 py-1">
                      <div className="font-medium text-gray-900">{branch.nama_branch}</div>
                      <div className="text-gray-500 mt-0.5">{branch.alamat}</div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="text-gray-900">{branch.kota}</div>
                      <div className="text-gray-500">{branch.provinsi}</div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="text-gray-900">
                        {formatTime(branch.jam_buka)} - {formatTime(branch.jam_tutup)}
                      </div>
                      <div className="text-gray-500">{branch.hari_operasional}</div>
                    </td>
                    <td className="px-1 py-1">
                      <div className="font-medium text-gray-900">{branch.pic_nama}</div>
                      <div className="text-gray-500 flex items-center gap-0.5 mt-0.5">
                        <Phone size={10} />
                        {branch.pic_no_telp || '-'}
                      </div>
                      <div className="text-gray-500 flex items-center gap-0.5 mt-0.5">
                        <Mail size={10} />
                        {branch.pic_email}
                      </div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {canPerformActionSync(userRole, 'branches', 'edit') && (
                          <button
                            onClick={() => handleEdit(branch)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit size={12} />
                          </button>
                        )}
                        {canPerformActionSync(userRole, 'branches', 'delete') && (
                          <button
                            onClick={() => handleDelete(branch.id_branch)}
                            disabled={deleteLoading === branch.id_branch}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 disabled:opacity-50"
                          >
                            {deleteLoading === branch.id_branch ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
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
      </div>
    </div>
  );
}

export default function BranchesPage() {
  return (
    <Layout>
      <BranchesPageContent />
    </Layout>
  );
}