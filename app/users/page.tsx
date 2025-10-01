'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2, Download, Upload, Eye, EyeOff, Settings, Filter, X, Search, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import { canViewColumn } from '@/src/utils/dbPermissions';
import PageAccessControl from '../../components/PageAccessControl';

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
  const [userId, setUserId] = useState<number | null>(null);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [permittedColumns, setPermittedColumns] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'nama_lengkap' | 'email' | 'role' | 'created_at'>('nama_lengkap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Mobile specific states
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // 'list' or 'details'
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Check if mobile on mount and on resize
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  // Get user role
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role || 'guest')
      setUserId(user.id_user || null)
    }
  }, [])

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, [statusFilter]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Get columns based on permissions
  useEffect(() => {
    const loadPermittedColumns = async () => {
      if (users.length > 0) {
        const allColumns = ['email', 'nama_lengkap', 'no_telp', 'role', 'branches', 'created_at', 'is_active']
        const permitted = []
        
        for (const col of allColumns) {
          const hasPermission = await canViewColumn(userRole, 'users', col)
          if (hasPermission) {
            permitted.push(col)
          }
        }
        
        setPermittedColumns(permitted)
      }
    }
    
    loadPermittedColumns()
  }, [users, userRole])
  
  const visibleColumns = permittedColumns.filter(col => !hiddenColumns.includes(col))

  const toggleColumn = async (col: string) => {
    const hasPermission = await canViewColumn(userRole, 'users', col)
    if (!hasPermission) {
      showToast(`You don't have permission to view ${col} column`, 'error')
      return
    }
    
    setHiddenColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    )
  }

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // ✅ QUERY OPTIMAL: Ambil user + branches sekaligus
      let query = supabase
        .from('users')
        .select(`
          *,
          user_branches(kode_branch)
        `);
      
      // Filter status
      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      }
      
      let { data: usersData, error } = await query.order('nama_lengkap');
      
      // Fallback: Jika JOIN query gagal, coba query users saja
      if (error && error.message?.includes('user_branches')) {
        console.warn('JOIN query failed, trying simple users query:', error.message);
        
        let simpleQuery = supabase.from('users').select('*');
        
        if (statusFilter === 'active') {
          simpleQuery = simpleQuery.eq('is_active', true);
        } else if (statusFilter === 'inactive') {
          simpleQuery = simpleQuery.eq('is_active', false);
        }
        
        const simpleResult = await simpleQuery.order('nama_lengkap');
        usersData = simpleResult.data;
        error = simpleResult.error;
      }

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      if (!usersData) {
        console.warn('No users data returned from query');
        setUsers([]);
        return;
      }

      // ✅ TRANSFORMASI SEDERHANA: Tidak perlu mapping complex
      const usersWithBranches = usersData.map(user => ({
        ...user,
        branches: user.user_branches ? user.user_branches.map((ub: any) => ub.kode_branch) : []
      }));

      setUsers(usersWithBranches);
      
    } catch (error) {
      console.error('Error fetching users:', error);
      console.error('Error type:', typeof error);
      console.error('Error keys:', error ? Object.keys(error) : 'null');
      
      const errorMessage = error && typeof error === 'object' && 'message' in error 
        ? (error as any).message 
        : 'Unknown error occurred';
      
      showToast(`❌ Gagal memuat data users: ${errorMessage}`, 'error');
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
      showToast('❌ Email and Full Name are required', 'error');
      return;
    }

    setSaving(true);
    try {
      let userId = editingId;
      
      if (editingId) {
        const updateData: {
          email: string;
          nama_lengkap: string;
          no_telp: string | null;
          role: string;
          cabang: string | null;
          password_hash?: string;
        } = {
          email: formData.email,
          nama_lengkap: formData.nama_lengkap,
          no_telp: formData.no_telp || null,
          role: formData.role,
          cabang: formData.cabang || null
        };
        if (formData.password_hash) {
          updateData.password_hash = formData.password_hash;
        }
        
        console.log('Updating user with data:', updateData);
        const { error } = await supabase.from('users')
          .update(updateData)
          .eq('id_user', editingId);

        if (error) {
          console.error('Update error details:', JSON.stringify(error, null, 2));
          throw error;
        }
        
        // Delete existing user branches
        await supabase
          .from('user_branches')
          .delete()
          .eq('id_user', editingId);
      } else {
        if (!formData.password_hash) {
          showToast('❌ Password is required for new users', 'error');
          setSaving(false);
          return;
        }
        
        const userData = { 
          email: formData.email,
          password_hash: formData.password_hash,
          nama_lengkap: formData.nama_lengkap,
          no_telp: formData.no_telp || null,
          role: formData.role,
          cabang: formData.cabang || null
        };
        
        console.log('Creating user with data:', userData);
        
        // Try to disable trigger temporarily and insert
        try {
          // First try to disable the trigger
          await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE users DISABLE TRIGGER audit_trigger_users;'
          });
          
          const { error } = await supabase.from('users')
            .insert(userData);
            
          // Re-enable the trigger
          await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE users ENABLE TRIGGER audit_trigger_users;'
          });
          
          if (error) {
            console.error('Insert error details:', JSON.stringify(error, null, 2));
            throw error;
          }
        } catch (triggerError) {
          console.log('Could not disable trigger, trying raw SQL insert...');
          
          // Try raw SQL insert as last resort
          const { error } = await supabase.rpc('exec_sql', {
            sql: `INSERT INTO users (email, password_hash, nama_lengkap, no_telp, role, cabang) 
                  VALUES ('${userData.email}', '${userData.password_hash}', '${userData.nama_lengkap}', 
                         ${userData.no_telp ? `'${userData.no_telp}'` : 'NULL'}, '${userData.role}', 
                         ${userData.cabang ? `'${userData.cabang}'` : 'NULL'})`
          });
          
          if (error) {
            console.error('Raw SQL insert error:', JSON.stringify(error, null, 2));
            throw error;
          }
        }
        
        // Get the created user ID by email
        const { data: createdUser, error: fetchError } = await supabase
          .from('users')
          .select('id_user')
          .eq('email', formData.email)
          .single();
          
        if (fetchError) {
          console.error('Error fetching created user:', fetchError);
        } else {
          userId = createdUser?.id_user;
        }
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
          
        if (branchError) {
          console.error('Branch insert error:', JSON.stringify(branchError, null, 2));
          throw branchError;
        }
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
      showToast('✅ User saved successfully', 'success');
    } catch (error: any) {
      console.error('Error saving user:', error);
      console.error('Error type:', typeof error);
      console.error('Error keys:', Object.keys(error || {}));
      
      let errorMessage = 'Unknown error occurred';
      
      if (error && typeof error === 'object') {
        errorMessage = error.message || error.details || error.hint || error.code || JSON.stringify(error);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      showToast(`❌ Failed to save user: ${errorMessage}`, 'error');
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
    showToast('✅ Users exported successfully', 'success');
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
        showToast('❌ No valid data found', 'error');
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
        showToast(`✅ Imported ${successCount} users (${updateCount} updated, ${successCount - updateCount} new)`, 'success');
      } else {
        showToast('❌ Failed to import any users', 'error');
      }

    } catch (error) {
      console.error('Failed to import Excel file:', error);
      showToast('❌ Failed to import Excel file', 'error');
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menonaktifkan user ini? User akan di-mark sebagai tidak aktif tapi data tetap tersimpan.')) {
      return;
    }

    setDeleteLoading(id);
    
    try {
      // Soft delete: set is_active to false
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id_user', id);

      if (error) {
        throw error;
      }

      // Also deactivate user branches
      await supabase
        .from('user_branches')
        .update({ is_active: false })
        .eq('id_user', id);

      await fetchUsers();
      showToast('✅ User deactivated successfully', 'success');
    } catch (error) {
      console.error('Error deactivating user:', error);
      showToast('❌ Failed to deactivate user', 'error');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleReactivate = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin mengaktifkan kembali user ini?')) {
      return;
    }

    setDeleteLoading(id);
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id_user', id);

      if (error) {
        throw error;
      }

      await fetchUsers();
      showToast('✅ User reactivated successfully', 'success');
    } catch (error) {
      console.error('Error reactivating user:', error);
      showToast('❌ Failed to reactivate user', 'error');
    } finally {
      setDeleteLoading(null);
    }
  };

  // Mobile view handlers
  const viewUserDetails = (user: User) => {
    setSelectedUser(user);
    setMobileView('details');
  };

  const closeUserDetails = () => {
    setMobileView('list');
    setSelectedUser(null);
  };

  // Mobile filter component
  const MobileFilters = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="bg-white w-4/5 h-full p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Filters</h3>
          <button onClick={() => setShowMobileFilters(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border px-3 py-2 rounded-md w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="border px-3 py-2 rounded-md w-full"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setSearchTerm('')}
              className="px-4 py-2 bg-gray-200 rounded-md flex-1"
            >
              Reset
            </button>
            <button 
              onClick={() => setShowMobileFilters(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md flex-1"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const filteredUsers = users
    .filter(user => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        user.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Branch filter
      const matchesBranch = branchFilter === 'all' || 
        (user.branches && user.branches.includes(branchFilter)) ||
        user.cabang === branchFilter;
      
      // Role filter
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      
      return matchesSearch && matchesBranch && matchesRole;
    })
    .sort((a, b) => {
      let aValue: string | number = a[sortBy];
      let bValue: string | number = b[sortBy];
      
      if (sortBy === 'created_at') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      } else {
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, branchFilter, roleFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

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
    <div className="p-4 md:p-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm z-50 flex items-center shadow-lg transform transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span className="mr-2">{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.message}
        </div>
      )}

      {/* Mobile Filters */}
      {showMobileFilters && <MobileFilters />}

      {/* Mobile User Details View */}
      {isMobile && mobileView === 'details' && selectedUser && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">User Details</h2>
              <button onClick={closeUserDetails} className="p-2">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="font-semibold">Email:</label>
                <p className="text-blue-600">{selectedUser.email}</p>
              </div>
              
              <div>
                <label className="font-semibold">Nama Lengkap:</label>
                <p>{selectedUser.nama_lengkap}</p>
              </div>
              
              <div>
                <label className="font-semibold">No Telp:</label>
                <p>{selectedUser.no_telp || '-'}</p>
              </div>
              
              <div>
                <label className="font-semibold">Role:</label>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  selectedUser.role === 'super admin' ? 'bg-red-100 text-red-800' :
                  selectedUser.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                  selectedUser.role === 'finance' ? 'bg-purple-100 text-purple-800' :
                  selectedUser.role === 'pic_branch' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedUser.role}
                </span>
              </div>
              
              <div>
                <label className="font-semibold">Branches:</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedUser.branches && selectedUser.branches.length > 0 
                    ? selectedUser.branches.map(branchCode => {
                        const branch = branches.find(b => b.kode_branch === branchCode);
                        return (
                          <span key={branchCode} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {branch ? branch.nama_branch : branchCode}
                          </span>
                        );
                      })
                    : <span className="text-gray-400 text-xs">No branches</span>
                  }
                </div>
              </div>
              
              <div>
                <label className="font-semibold">Status:</label>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  selectedUser.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {selectedUser.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div>
                <label className="font-semibold">Created:</label>
                <p className="text-gray-500">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              {(userRole === 'super admin' || userRole === 'admin') && (
                <button 
                  onClick={() => {
                    closeUserDetails();
                    handleEdit(selectedUser);
                  }} 
                  className="flex-1 bg-blue-600 text-white py-2 rounded-md"
                >
                  Edit
                </button>
              )}
              {(userRole === 'super admin' || userRole === 'admin') && (
                selectedUser.is_active ? (
                  <button 
                    onClick={() => handleDelete(selectedUser.id_user)} 
                    className="flex-1 bg-red-600 text-white py-2 rounded-md"
                  >
                    Deactivate
                  </button>
                ) : (
                  <button 
                    onClick={() => handleReactivate(selectedUser.id_user)} 
                    className="flex-1 bg-green-600 text-white py-2 rounded-md"
                  >
                    Reactivate
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold text-gray-800">👥 User Management</h1>
        {isMobile && (
          <button 
            onClick={() => setShowMobileFilters(true)}
            className="ml-auto p-2 bg-gray-200 rounded-md"
          >
            <Filter size={20} />
          </button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-600">Access Level:</span>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            userRole === 'super admin' ? 'bg-red-100 text-red-800' :
            userRole === 'admin' ? 'bg-blue-100 text-blue-800' :
            userRole === 'finance' ? 'bg-purple-100 text-purple-800' :
            userRole === 'pic_branch' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {userRole.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Search & Controls */}
      <div className="space-y-3 mb-4">
        {!isMobile ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            <input
              type="text"
              placeholder="🔍 Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border px-2 py-1 rounded-md text-xs"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="border px-2 py-1 rounded-md text-xs"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="border px-2 py-1 rounded-md text-xs"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.kode_branch} value={branch.kode_branch}>
                  {branch.nama_branch}
                </option>
              ))}
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border px-2 py-1 rounded-md text-xs"
            >
              <option value="all">All Roles</option>
              <option value="super admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="finance">Finance</option>
              <option value="pic_branch">PIC Branch</option>
              <option value="staff">Staff</option>
            </select>
            <div className="flex gap-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border px-2 py-1 rounded-md text-xs flex-1"
              >
                <option value="nama_lengkap">Name</option>
                <option value="email">Email</option>
                <option value="role">Role</option>
                <option value="created_at">Date</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="border px-2 py-1 rounded-md text-xs hover:bg-gray-50"
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border pl-8 pr-2 py-2 rounded-md w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="border px-3 py-2 rounded-md w-full"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
        )}
        
        {/* Primary Actions */}
        <div className="flex flex-wrap gap-2">
          {(userRole === 'super admin' || userRole === 'admin') && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Plus size={16} />
              Add New
            </button>
          )}
          {!isMobile && (
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="bg-purple-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Settings size={16} />
              Columns
            </button>
          )}
        </div>
        
        {/* Secondary Actions */}
        <div className="flex flex-wrap gap-2">
          {(userRole === 'super admin' || userRole === 'admin') && (
            <button 
              onClick={handleExport} 
              className="bg-green-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Download size={16} />
              Export
            </button>
          )}
          {(userRole === 'super admin' || userRole === 'admin') && (
            <label className="bg-orange-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 cursor-pointer">
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
          {(searchTerm || branchFilter !== 'all' || roleFilter !== 'all') && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setBranchFilter('all');
                setRoleFilter('all');
              }}
              className="px-3 py-1 rounded-md text-xs flex items-center gap-1 bg-red-100 text-red-700 hover:bg-red-200"
            >
              <X size={16} />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h3 className="font-medium text-gray-800 mb-2 text-sm">{editingId ? 'Edit User' : 'Add New User'}</h3>
          <form onSubmit={handleAddUser} className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                  placeholder={editingId ? "Password (leave empty if not changing)" : "Password *"}
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
                placeholder="Full Name *"
              />
              <input
                type="text"
                name="no_telp"
                value={formData.no_telp}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
                placeholder="Phone Number"
              />
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="border px-2 py-1 rounded-md text-xs w-full"
              >
                <option value="staff">Staff</option>
                <option value="super admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="finance">Finance</option>
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
            <div className="flex gap-2">
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

      {/* Column Selector (Desktop only) */}
      {showColumnSelector && filteredUsers.length > 0 && !isMobile && (
        <div className="bg-white p-2 rounded-lg shadow mb-4">
          <h3 className="font-medium text-gray-800 mb-2 text-xs">Column Visibility Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 mb-2">
            {['email', 'nama_lengkap', 'no_telp', 'role', 'branches', 'created_at', 'is_active'].map(col => {
              const hasPermission = permittedColumns.includes(col)
              return (
                <label key={col} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.includes(col) && hasPermission}
                    disabled={!hasPermission}
                    onChange={() => toggleColumn(col)}
                    className="rounded text-blue-600 w-3 h-3"
                  />
                  <span className={hiddenColumns.includes(col) || !hasPermission ? 'text-gray-500' : 'text-gray-800'}>
                    {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    {!hasPermission && <span className="text-red-500 text-xs ml-1">(No Access)</span>}
                  </span>
                </label>
              )
            })}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setHiddenColumns([])}
              className="px-2 py-1 bg-green-600 text-white rounded-md text-xs hover:bg-green-700 flex items-center gap-1"
            >
              <Eye size={10} />
              Show All
            </button>
            <button
              onClick={() => setHiddenColumns(permittedColumns)}
              className="px-2 py-1 bg-red-600 text-white rounded-md text-xs hover:bg-red-700 flex items-center gap-1"
            >
              <EyeOff size={10} />
              Hide All
            </button>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      {!isMobile && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  {visibleColumns.includes('email') && <th className="px-1 py-1 text-left font-medium text-gray-700">Email</th>}
                  {visibleColumns.includes('nama_lengkap') && <th className="px-1 py-1 text-left font-medium text-gray-700">Nama Lengkap</th>}
                  {visibleColumns.includes('no_telp') && <th className="px-1 py-1 text-left font-medium text-gray-700">No Telp</th>}
                  {visibleColumns.includes('role') && <th className="px-1 py-1 text-left font-medium text-gray-700">Role</th>}
                  {visibleColumns.includes('branches') && <th className="px-1 py-1 text-left font-medium text-gray-700">Branch</th>}
                  {visibleColumns.includes('created_at') && <th className="px-1 py-1 text-left font-medium text-gray-700">Created</th>}
                  {visibleColumns.includes('is_active') && <th className="px-1 py-1 text-left font-medium text-gray-700">Status</th>}
                  {(userRole === 'super admin' || userRole === 'admin') && <th className="px-1 py-1 text-left font-medium text-gray-700">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={(userRole === 'super admin' || userRole === 'admin') ? 7 : 6} className="px-1 py-2 text-center text-gray-500 text-xs">
                      {userRole === 'staff' ? 'You do not have permission to view user data' :
                       searchTerm ? 'No users match your search' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id_user} className="hover:bg-gray-50">
                      {visibleColumns.includes('email') && <td className="px-1 py-1">
                        <div className="font-medium text-blue-600">{user.email}</div>
                      </td>}
                      {visibleColumns.includes('nama_lengkap') && <td className="px-1 py-1">
                        <div className="font-medium text-gray-900">{user.nama_lengkap}</div>
                      </td>}
                      {visibleColumns.includes('no_telp') && <td className="px-1 py-1">
                        <div className="text-gray-900">{user.no_telp || '-'}</div>
                      </td>}
                      {visibleColumns.includes('role') && <td className="px-1 py-1">
                        <span className={`px-1 py-0.5 rounded text-xs font-semibold ${
                          user.role === 'super admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                          user.role === 'finance' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'pic_branch' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>}
                      {visibleColumns.includes('branches') && <td className="px-1 py-1">
                        <div className="text-gray-900">
                          {user.branches && user.branches.length > 0 
                            ? user.branches.map(branchCode => {
                                const branch = branches.find(b => b.kode_branch === branchCode);
                                return branch ? branch.nama_branch : branchCode;
                              }).join(', ')
                            : user.cabang ? (
                                branches.find(b => b.kode_branch === user.cabang)?.nama_branch || user.cabang
                              ) : '-'
                          }
                        </div>
                      </td>}
                      {visibleColumns.includes('created_at') && <td className="px-1 py-1">
                        <div className="text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>}
                      {visibleColumns.includes('is_active') && <td className="px-1 py-1">
                        <span className={`px-1 py-0.5 rounded text-xs font-semibold ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>}
                      {(userRole === 'super admin' || userRole === 'admin') && (
                        <td className="px-1 py-1 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(user)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                              title="Edit"
                            >
                              <Edit size={12} />
                            </button>
                            {user.is_active ? (
                              <button
                                onClick={() => handleDelete(user.id_user)}
                                disabled={deleteLoading === user.id_user}
                                className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 disabled:opacity-50"
                                title="Deactivate"
                              >
                                {deleteLoading === user.id_user ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(user.id_user)}
                                disabled={deleteLoading === user.id_user}
                                className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 disabled:opacity-50"
                                title="Reactivate"
                              >
                                {deleteLoading === user.id_user ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                                ) : (
                                  <Plus size={12} />
                                )}
                              </button>
                            )}
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
      )}

      {/* Mobile List View */}
      {isMobile && mobileView === 'list' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="p-3 border-b border-gray-200">
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2 w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
              </div>
            ))
          ) : paginatedUsers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {userRole === 'staff' ? 'You do not have permission to view user data' :
               searchTerm ? 'No users match your search' : 'No users found'}
            </div>
          ) : (
            paginatedUsers.map((user) => (
              <div 
                key={user.id_user} 
                className="p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                onClick={() => viewUserDetails(user)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{user.nama_lengkap}</h3>
                    <p className="text-xs text-gray-600">{user.email}</p>
                    <p className="text-xs text-gray-500">{user.no_telp || 'No phone'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    user.role === 'super admin' ? 'bg-red-100 text-red-800' :
                    user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                    user.role === 'finance' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'pic_branch' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {user.branches && user.branches.length > 0 
                    ? user.branches.slice(0, 3).map(branchCode => {
                        const branch = branches.find(b => b.kode_branch === branchCode);
                        return (
                          <span key={branchCode} className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                            {branch ? branch.nama_branch : branchCode}
                          </span>
                        );
                      })
                    : <span className="text-gray-400 text-xs">No branches</span>
                  }
                  {user.branches && user.branches.length > 3 && (
                    <span className="px-1 py-0.5 bg-gray-100 text-gray-800 rounded text-xs">
                      +{user.branches.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {filteredUsers.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
          <p className="text-xs text-gray-600">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredUsers.length)} of {filteredUsers.length} entries
          </p>
          <div className="flex gap-1">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(1)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              First
            </button>
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              Prev
            </button>
            <div className="flex items-center gap-1">
              <span className="text-xs">Page</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={page}
                onChange={(e) => {
                  const newPage = Math.max(1, Math.min(totalPages, Number(e.target.value)))
                  setPage(newPage)
                }}
                className="w-12 px-1 py-0.5 border rounded text-xs text-center"
              />
              <span className="text-xs">of {totalPages || 1}</span>
            </div>
            <button 
              disabled={page === totalPages || totalPages === 0} 
              onClick={() => setPage(p => p + 1)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              Next
            </button>
            <button 
              disabled={page === totalPages || totalPages === 0} 
              onClick={() => setPage(totalPages)}
              className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <Layout>
      <PageAccessControl pageName="users">
        <UsersPageContent />
      </PageAccessControl>
    </Layout>
  );
}