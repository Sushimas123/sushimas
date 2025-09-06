'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2, Download, Upload, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import { canViewColumn, getHiddenColumns } from '@/src/utils/columnPermissions';

interface User {
  id_user: number;
  email: string;
  nama_lengkap: string;
  no_telp: string | null;
  role: string;
  cabang: string | null;
  branches?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Branch {
  id_branch: number;
  kode_branch: string;
  nama_branch: string;
  alamat: string;
  kota: string;
  provinsi: string;
}

function UsersPageContent() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password_hash: '',
    nama_lengkap: '',
    no_telp: '',
    role: 'staff',
    cabang: '',
    selectedBranches: [] as string[]
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>('guest');

  // Get user role
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role || 'guest')
    }
  }, [])

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('nama_lengkap');

      if (error) throw error;

      // Fetch all user branches in one query
      const userIds = usersData.map(user => user.id_user);
      const { data: allUserBranches } = await supabase
        .from('user_branches')
        .select('id_user, kode_branch')
        .in('id_user', userIds)
        .eq('is_active', true);
      
      // Create branches map for O(1) lookup
      const branchesMap = new Map<number, string[]>();
      allUserBranches?.forEach(ub => {
        if (!branchesMap.has(ub.id_user)) {
          branchesMap.set(ub.id_user, []);
        }
        branchesMap.get(ub.id_user)!.push(ub.kode_branch);
      });
      
      // Transform users with branches
      const usersWithBranches = usersData.map(user => ({
        ...user,
        branches: branchesMap.get(user.id_user) || []
      }));

      setUsers(usersWithBranches);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id_branch, kode_branch, nama_branch, alamat, kota, provinsi')
        .eq('is_active', true)
        .order('nama_branch');

      if (error) {
        throw error;
      }

      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.nama_lengkap.trim()) {
      return;
    }

    setSaving(true);
    try {
      let userId = editingId;
      
      if (editingId) {
        const updateData = { ...formData };
        delete (updateData as any).selectedBranches;
        if (!formData.password_hash) {
          delete (updateData as any).password_hash;
        }
        
        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id_user', editingId);

        if (error) throw error;
        
        // Delete existing user branches
        await supabase
          .from('user_branches')
          .delete()
          .eq('id_user', editingId);
      } else {
        if (!formData.password_hash) {
          setSaving(false);
          return;
        }
        
        const userData = { ...formData };
        delete (userData as any).selectedBranches;
        
        const { data, error } = await supabase
          .from('users')
          .insert([userData])
          .select('id_user')
          .single();

        if (error) throw error;
        userId = data.id_user;
      }

      // Insert user branches
      if (formData.selectedBranches.length > 0 && userId) {
        const userBranches = formData.selectedBranches.map(branch => ({
          id_user: userId,
          kode_branch: branch
        }));
        
        const { error: branchError } = await supabase
          .from('user_branches')
          .insert(userBranches);
          
        if (branchError) throw branchError;
      }

      setFormData({
        email: '',
        password_hash: '',
        nama_lengkap: '',
        no_telp: '',
        role: 'staff',
        cabang: '',
        selectedBranches: []
      });
      setShowAddForm(false);
      setEditingId(null);
      await fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleBranchToggle = (branchCode: string) => {
    setFormData(prev => ({
      ...prev,
      selectedBranches: prev.selectedBranches.includes(branchCode)
        ? prev.selectedBranches.filter(b => b !== branchCode)
        : [...prev.selectedBranches, branchCode]
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEdit = (user: User) => {
    setFormData({
      email: user.email,
      password_hash: '',
      nama_lengkap: user.nama_lengkap,
      no_telp: user.no_telp || '',
      role: user.role,
      cabang: user.cabang || '',
      selectedBranches: user.branches || []
    });
    setEditingId(user.id_user);
    setShowAddForm(true);
  };

  const handleExport = () => {
    if (users.length === 0) return;
    
    const ws = XLSX.utils.json_to_sheet(users.map(user => ({
      email: user.email,
      nama_lengkap: user.nama_lengkap,
      no_telp: user.no_telp,
      role: user.role,
      cabang: user.cabang
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, `users_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        email: row.email?.toString().trim() || '',
        password_hash: row.password_hash?.toString().trim() || 'defaultpassword',
        nama_lengkap: row.nama_lengkap?.toString().trim() || '',
        no_telp: row.no_telp?.toString().trim() || null,
        role: row.role?.toString().trim() || 'staff',
        cabang: row.cabang?.toString().trim() || null,
        is_active: true
      })).filter((item: any) => item.email && item.nama_lengkap);

      if (importData.length === 0) {
        return;
      }

      let successCount = 0;
      let updateCount = 0;

      for (const entry of importData) {
        const { data: existing } = await supabase
          .from('users')
          .select('id_user')
          .eq('email', entry.email)
          .single();

        if (existing) {
          const updateData = { ...entry };
          delete (updateData as any).password_hash;
          
          const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id_user', existing.id_user);

          if (!error) {
            updateCount++;
            successCount++;
          }
        } else {
          const { error } = await supabase
            .from('users')
            .insert([entry]);

          if (!error) successCount++;
        }
      }

      if (successCount > 0) {
        fetchUsers();
      }

    } catch (error) {
      console.error('Failed to import Excel file:', error);
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus user ini?')) {
      return;
    }

    setDeleteLoading(id);
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id_user', id);

      if (error) {
        throw error;
      }

      await fetchUsers();
      alert('User berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Gagal menghapus user');
    } finally {
      setDeleteLoading(null);
    }
  };

  const filteredUsers = users.filter(user =>
    user.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-2">
        <div className="bg-white p-2 rounded-lg shadow text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mb-1"></div>
            <p className="text-xs text-gray-600">Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 md:p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-sm font-bold text-gray-800">👥 User Management</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Access Level:</span>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            userRole === 'admin' ? 'bg-red-100 text-red-800' :
            userRole === 'manager' ? 'bg-blue-100 text-blue-800' :
            userRole === 'pic_branch' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {userRole.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Search & Controls */}
      <div className="bg-white p-1 rounded-lg shadow mb-1">
        <div className="flex flex-col md:flex-row gap-1 items-start md:items-end">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search users..."
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
            {userRole === 'admin' && (
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

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white p-1 rounded-lg shadow mb-1">
          <h3 className="font-medium text-gray-800 mb-2 text-xs">{editingId ? 'Edit User' : 'Tambah User Baru'}</h3>
          <form onSubmit={handleAddUser} className="space-y-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Email *"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password_hash"
                  value={formData.password_hash}
                  onChange={handleInputChange}
                  className="border px-2 py-1 rounded-md text-xs w-full pr-8"
                  placeholder={editingId ? "Password (kosongkan jika tidak diubah)" : "Password *"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <input
                type="text"
                name="nama_lengkap"
                value={formData.nama_lengkap}
                onChange={handleInputChange}
                required
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Nama Lengkap *"
              />
              <input
                type="text"
                name="no_telp"
                value={formData.no_telp}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="No Telp"
              />
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="pic_branch">PIC Branch</option>
              </select>
              <div className="border rounded-md p-2 max-h-24 overflow-y-auto">
                <div className="text-xs text-gray-600 mb-1">Select Branches:</div>
                {branches.map(branch => (
                  <label key={branch.id_branch} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={formData.selectedBranches.includes(branch.kode_branch)}
                      onChange={() => handleBranchToggle(branch.kode_branch)}
                      className="w-3 h-3"
                    />
                    {branch.nama_branch}
                  </label>
                ))}
              </div>
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
                    email: '',
                    password_hash: '',
                    nama_lengkap: '',
                    no_telp: '',
                    role: 'staff',
                    cabang: '',
                    selectedBranches: []
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

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                {canViewColumn(userRole, 'users', 'email') && <th className="px-1 py-1 text-left font-medium text-gray-700">Email</th>}
                {canViewColumn(userRole, 'users', 'nama_lengkap') && <th className="px-1 py-1 text-left font-medium text-gray-700">Nama Lengkap</th>}
                {canViewColumn(userRole, 'users', 'no_telp') && <th className="px-1 py-1 text-left font-medium text-gray-700">No Telp</th>}
                {canViewColumn(userRole, 'users', 'role') && <th className="px-1 py-1 text-left font-medium text-gray-700">Role</th>}
                {canViewColumn(userRole, 'users', 'cabang') && <th className="px-1 py-1 text-left font-medium text-gray-700">Branch</th>}
                {canViewColumn(userRole, 'users', 'created_at') && <th className="px-1 py-1 text-left font-medium text-gray-700">Created</th>}
                {userRole === 'admin' && <th className="px-1 py-1 text-left font-medium text-gray-700">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={Object.keys(['email', 'nama_lengkap', 'no_telp', 'role', 'cabang', 'created_at', 'actions']).filter(col => 
                    col === 'actions' ? userRole === 'admin' : canViewColumn(userRole, 'users', col)
                  ).length} className="px-1 py-2 text-center text-gray-500 text-xs">
                    {userRole === 'staff' ? 'You do not have permission to view user data' :
                     searchTerm ? 'Tidak ada user yang sesuai dengan pencarian' : 'Belum ada data user'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id_user} className="hover:bg-gray-50">
                    {canViewColumn(userRole, 'users', 'email') && (
                      <td className="px-1 py-1">
                        <div className="font-medium text-blue-600">{user.email}</div>
                      </td>
                    )}
                    {canViewColumn(userRole, 'users', 'nama_lengkap') && (
                      <td className="px-1 py-1">
                        <div className="font-medium text-gray-900">{user.nama_lengkap}</div>
                      </td>
                    )}
                    {canViewColumn(userRole, 'users', 'no_telp') && (
                      <td className="px-1 py-1">
                        <div className="text-gray-900">{user.no_telp || '-'}</div>
                      </td>
                    )}
                    {canViewColumn(userRole, 'users', 'role') && (
                      <td className="px-1 py-1">
                        <span className={`px-1 py-0.5 rounded text-xs font-semibold ${
                          user.role === 'admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                          user.role === 'pic_branch' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                    )}
                    {canViewColumn(userRole, 'users', 'cabang') && (
                      <td className="px-1 py-1">
                        <div className="text-gray-900">
                          {user.branches && user.branches.length > 0 
                            ? user.branches.map(branchCode => {
                                const branch = branches.find(b => b.kode_branch === branchCode);
                                return branch ? branch.nama_branch : branchCode;
                              }).join(', ')
                            : (user.cabang || '-')
                          }
                        </div>
                      </td>
                    )}
                    {canViewColumn(userRole, 'users', 'created_at') && (
                      <td className="px-1 py-1">
                        <div className="text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                    )}
                    {userRole === 'admin' && (
                      <td className="px-1 py-1 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id_user)}
                            disabled={deleteLoading === user.id_user}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 disabled:opacity-50"
                          >
                            {deleteLoading === user.id_user ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
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

export default function UsersPage() {
  return (
    <Layout>
      <UsersPageContent />
    </Layout>
  );
}