'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Save, RefreshCw, Filter, X, ChevronDown, ChevronRight } from 'lucide-react';
import Layout from '../../components/Layout';
import { reloadPermissions } from '@/src/utils/rolePermissions';
import PageAccessControl from '../../components/PageAccessControl';

interface CrudPermission {
  id?: number;
  role: string;
  page: string;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const ROLES = ['super admin', 'admin', 'finance', 'pic_branch', 'staff'];
const PAGES = [
  'ready', 'gudang', 'produksi', 'produksi_detail', 'analysis', 'esb', 
  'product_name', 'categories', 'recipes', 'supplier', 'branches', 
  'users', 'stock_opname_batch', 'product_settings', 'permissions-db', 
  'crud-permissions', 'audit-log', 'pivot', 'dashboard', 'login', 'register',
  'price-history', 'purchaseorder', 'transfer-barang', 'finance', 'aging-report',
  'aging-pivot', 'bulk-payments'
];

export default function CrudPermissionsPage() {
  const [permissions, setPermissions] = useState<CrudPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedRoles, setCollapsedRoles] = useState<Set<string>>(new Set());

  const toggleRoleCollapse = (role: string) => {
    setCollapsedRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(role)) {
        newSet.delete(role);
      } else {
        newSet.add(role);
      }
      return newSet;
    });
  };

  const expandAll = () => setCollapsedRoles(new Set());
  const collapseAll = () => setCollapsedRoles(new Set(ROLES));

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('crud_permissions')
        .select('*')
        .order('role')
        .order('page');

      if (error) throw error;

      // Create default permissions if none exist
      const existingPermissions = data || [];
      const allPermissions: CrudPermission[] = [];

      ROLES.forEach(role => {
        PAGES.forEach(page => {
          const existing = existingPermissions.find(p => p.role === role && p.page === page);
          if (existing) {
            allPermissions.push(existing);
          } else {
            // Default permissions
            const defaultPerms = getDefaultPermissions(role);
            allPermissions.push({
              role,
              page,
              can_create: defaultPerms.create,
              can_edit: defaultPerms.edit,
              can_delete: defaultPerms.delete
            });
          }
        });
      });

      setPermissions(allPermissions);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultPermissions = (role: string) => {
    switch (role) {
      case 'super admin':
      case 'admin':
        return { create: true, edit: true, delete: true };
      case 'finance':
        return { create: false, edit: false, delete: false };
      case 'pic_branch':
        return { create: true, edit: true, delete: false };
      case 'staff':
        return { create: true, edit: false, delete: false };
      default:
        return { create: false, edit: false, delete: false };
    }
  };

  const updatePermission = (role: string, page: string, action: 'can_create' | 'can_edit' | 'can_delete', value: boolean) => {
    setPermissions(prev => prev.map(p => 
      p.role === role && p.page === page 
        ? { ...p, [action]: value }
        : p
    ));
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      // Delete all existing permissions
      const { error: deleteError } = await supabase
        .from('crud_permissions')
        .delete()
        .neq('id', 0);

      if (deleteError) throw deleteError;

      // Insert new permissions
      const permissionsToInsert = permissions.map(p => ({
        role: p.role,
        page: p.page,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete
      }));

      const { error: insertError } = await supabase.from('crud_permissions', permissionsToInsert);

      if (insertError) throw insertError;

      alert('CRUD permissions saved successfully!');
      // Force reload permissions cache
      await reloadPermissions();
      await fetchPermissions();
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert(`Failed to save permissions`);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (!confirm('Reset all permissions to default values?')) return;
    
    const defaultPermissions: CrudPermission[] = [];
    ROLES.forEach(role => {
      PAGES.forEach(page => {
        const defaultPerms = getDefaultPermissions(role);
        defaultPermissions.push({
          role,
          page,
          can_create: defaultPerms.create,
          can_edit: defaultPerms.edit,
          can_delete: defaultPerms.delete
        });
      });
    });
    
    setPermissions(defaultPermissions);
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-4">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2" />
            <p>Loading permissions...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageAccessControl pageName="crud-permissions">
        <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-800">🔐 CRUD Permissions</h1>
          {isMobile && (
            <button 
              onClick={() => setShowMobileFilters(true)}
              className="ml-auto p-2 bg-gray-200 rounded-md"
            >
              <Filter size={20} />
            </button>
          )}
        </div>

        {/* Mobile Filters */}
        {showMobileFilters && (
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
                  <label className="block text-sm font-medium mb-1">Search Pages</label>
                  <input
                    type="text"
                    placeholder="Search pages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border px-3 py-2 rounded-md"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full border px-3 py-2 rounded-md"
                  >
                    <option value="all">All Roles</option>
                    {ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setSelectedRole('all');
                      setSearchTerm('');
                    }}
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
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={expandAll}
            className="bg-green-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1"
          >
            <ChevronDown size={14} />
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="bg-orange-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1"
          >
            <ChevronRight size={14} />
            Collapse All
          </button>
          <button
            onClick={resetToDefaults}
            className="bg-gray-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1"
          >
            <RefreshCw size={14} />
            Reset
          </button>
          <button
            onClick={savePermissions}
            disabled={saving}
            className="bg-blue-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Desktop Filters */}
        {!isMobile && (
          <div className="bg-white p-3 rounded-lg shadow mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Search Pages</label>
                <input
                  type="text"
                  placeholder="Search pages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border px-2 py-1 rounded text-xs w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="border px-2 py-1 rounded text-xs w-full"
                >
                  <option value="all">All Roles</option>
                  {ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {!isMobile && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="bg-white p-3 rounded-lg shadow">
              <h3 className="font-medium text-sm mb-2">Quick Role Actions</h3>
              <div className="space-y-1">
                {ROLES.map(role => (
                  <div key={role} className="flex items-center justify-between">
                    <span className="text-xs capitalize">{role}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          PAGES.forEach(page => {
                            updatePermission(role, page, 'can_create', true);
                            updatePermission(role, page, 'can_edit', true);
                            updatePermission(role, page, 'can_delete', true);
                          });
                        }}
                        className="px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs hover:bg-green-200"
                      >
                        All
                      </button>
                      <button
                        onClick={() => {
                          PAGES.forEach(page => {
                            updatePermission(role, page, 'can_create', false);
                            updatePermission(role, page, 'can_edit', false);
                            updatePermission(role, page, 'can_delete', false);
                          });
                        }}
                        className="px-1 py-0.5 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200"
                      >
                        None
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg shadow">
              <h3 className="font-medium text-sm mb-2">Bulk Actions</h3>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    ROLES.forEach(role => {
                      PAGES.forEach(page => {
                        updatePermission(role, page, 'can_create', true);
                      });
                    });
                  }}
                  className="w-full px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 text-xs"
                >
                  Enable All CREATE
                </button>
                <button
                  onClick={() => {
                    ROLES.forEach(role => {
                      PAGES.forEach(page => {
                        updatePermission(role, page, 'can_edit', true);
                      });
                    });
                  }}
                  className="w-full px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-xs"
                >
                  Enable All EDIT
                </button>
                <button
                  onClick={() => {
                    ROLES.forEach(role => {
                      PAGES.forEach(page => {
                        updatePermission(role, page, 'can_delete', false);
                      });
                    });
                  }}
                  className="w-full px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 text-xs"
                >
                  Disable All DELETE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Table */}
        {!isMobile ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-gray-700">Role</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-700">Page</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-700">Create</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-700">Edit</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-700">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ROLES.filter(role => selectedRole === 'all' || selectedRole === role).map(role => {
                    const filteredPages = PAGES.filter(page => page.toLowerCase().includes(searchTerm.toLowerCase()));
                    const isCollapsed = collapsedRoles.has(role);
                    
                    return [
                      // Role header row
                      <tr key={`${role}-header`} className="bg-gray-100 hover:bg-gray-200">
                        <td className="px-2 py-2 font-medium border-r border-gray-200">
                          <button
                            onClick={() => toggleRoleCollapse(role)}
                            className="flex items-center gap-1 w-full"
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            <span className={`px-1 py-0.5 rounded text-xs font-semibold ${
                              role === 'super admin' ? 'bg-red-100 text-red-800' :
                              role === 'admin' ? 'bg-blue-100 text-blue-800' :
                              role === 'finance' ? 'bg-purple-100 text-purple-800' :
                              role === 'pic_branch' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {role.toUpperCase()}
                            </span>
                          </button>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600">
                          {filteredPages.length} pages
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => {
                              filteredPages.forEach(page => {
                                updatePermission(role, page, 'can_create', true);
                              });
                            }}
                            className="text-xs text-green-600 hover:bg-green-50 px-1 rounded"
                          >
                            All
                          </button>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => {
                              filteredPages.forEach(page => {
                                updatePermission(role, page, 'can_edit', true);
                              });
                            }}
                            className="text-xs text-blue-600 hover:bg-blue-50 px-1 rounded"
                          >
                            All
                          </button>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => {
                              filteredPages.forEach(page => {
                                updatePermission(role, page, 'can_delete', false);
                              });
                            }}
                            className="text-xs text-red-600 hover:bg-red-50 px-1 rounded"
                          >
                            None
                          </button>
                        </td>
                      </tr>,
                      // Page rows (only if not collapsed)
                      ...(!isCollapsed ? filteredPages.map(page => {
                        const permission = permissions.find(p => p.role === role && p.page === page);
                        if (!permission) return null;

                        return (
                          <tr key={`${role}-${page}`} className="hover:bg-gray-50">
                            <td className="px-2 py-2 pl-6 text-xs text-gray-500">
                              └─
                            </td>
                            <td className="px-2 py-2 capitalize font-medium text-gray-700 text-xs">
                              {page.replace('-', ' ')}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={permission.can_create}
                                onChange={(e) => updatePermission(role, page, 'can_create', e.target.checked)}
                                className="w-3 h-3 text-green-600 rounded focus:ring-green-500"
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={permission.can_edit}
                                onChange={(e) => updatePermission(role, page, 'can_edit', e.target.checked)}
                                className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={permission.can_delete}
                                onChange={(e) => updatePermission(role, page, 'can_delete', e.target.checked)}
                                className="w-3 h-3 text-red-600 rounded focus:ring-red-500"
                              />
                            </td>
                          </tr>
                        );
                      }) : [])
                    ];
                  }).flat().filter(Boolean)}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Mobile Card View */
          <div className="space-y-3">
            {ROLES.filter(role => selectedRole === 'all' || selectedRole === role).map(role => {
              const filteredPages = PAGES.filter(page => page.toLowerCase().includes(searchTerm.toLowerCase()));
              const isCollapsed = collapsedRoles.has(role);
              
              return (
                <div key={role} className="bg-white rounded-lg shadow">
                  <div className="p-3 border-b">
                    <button
                      onClick={() => toggleRoleCollapse(role)}
                      className="flex items-center gap-2 w-full"
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      <h3 className={`font-semibold text-sm px-2 py-1 rounded inline-block ${
                        role === 'super admin' ? 'bg-red-100 text-red-800' :
                        role === 'admin' ? 'bg-blue-100 text-blue-800' :
                        role === 'finance' ? 'bg-purple-100 text-purple-800' :
                        role === 'pic_branch' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {role.toUpperCase()}
                      </h3>
                      <span className="text-xs text-gray-500 ml-auto">
                        {filteredPages.length} pages
                      </span>
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="divide-y">
                      {filteredPages.map(page => {
                        const permission = permissions.find(p => p.role === role && p.page === page);
                        if (!permission) return null;

                        return (
                          <div key={`${role}-${page}`} className="p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-sm capitalize">{page.replace('-', ' ')}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={permission.can_create}
                                  onChange={(e) => updatePermission(role, page, 'can_create', e.target.checked)}
                                  className="w-4 h-4 text-green-600 rounded"
                                />
                                <span className="text-xs text-green-700">Create</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={permission.can_edit}
                                  onChange={(e) => updatePermission(role, page, 'can_edit', e.target.checked)}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-xs text-blue-700">Edit</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={permission.can_delete}
                                  onChange={(e) => updatePermission(role, page, 'can_delete', e.target.checked)}
                                  className="w-4 h-4 text-red-600 rounded"
                                />
                                <span className="text-xs text-red-700">Delete</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        </div>
      </PageAccessControl>
    </Layout>
  );
}