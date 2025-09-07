'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Save, RefreshCw } from 'lucide-react';
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
  'users', 'stock_opname', 'product_settings', 'permissions-db'
];

export default function CrudPermissionsPage() {
  const [permissions, setPermissions] = useState<CrudPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

      const { error: insertError } = await supabase
        .from('crud_permissions')
        .insert(permissionsToInsert);

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">🔐 CRUD Permissions Management</h1>
          <div className="flex gap-2">
            <button
              onClick={resetToDefaults}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Reset to Defaults
            </button>
            <button
              onClick={savePermissions}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

                {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold text-gray-800 mb-3">Quick Role Actions</h3>
            <div className="space-y-2">
              {ROLES.map(role => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{role}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        PAGES.forEach(page => {
                          updatePermission(role, page, 'can_create', true);
                          updatePermission(role, page, 'can_edit', true);
                          updatePermission(role, page, 'can_delete', true);
                        });
                      }}
                      className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs hover:bg-green-200"
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
                      className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200"
                    >
                      None
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold text-gray-800 mb-3">Bulk Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  ROLES.forEach(role => {
                    PAGES.forEach(page => {
                      updatePermission(role, page, 'can_create', true);
                    });
                  });
                }}
                className="w-full px-3 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200 text-sm"
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
                className="w-full px-3 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-sm"
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
                className="w-full px-3 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200 text-sm"
              >
                Disable All DELETE
              </button>
            </div>
          </div>

          
        </div>

      
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Page</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700">Create</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700">Edit</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ROLES.map(role => (
                  PAGES.map((page, pageIndex) => {
                    const permission = permissions.find(p => p.role === role && p.page === page);
                    if (!permission) return null;

                    return (
                      <tr key={`${role}-${page}`} className="hover:bg-gray-50">
                        {pageIndex === 0 && (
                          <td 
                            className="px-4 py-3 font-medium border-r border-gray-200"
                            rowSpan={PAGES.length}
                          >
                            <span className={`px-2 py-1 rounded text-sm font-semibold ${
                              role === 'super admin' ? 'bg-red-100 text-red-800' :
                              role === 'admin' ? 'bg-blue-100 text-blue-800' :
                              role === 'finance' ? 'bg-purple-100 text-purple-800' :
                              role === 'pic_branch' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {role.toUpperCase()}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3 capitalize font-medium text-gray-700">
                          {page}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={permission.can_create}
                            onChange={(e) => updatePermission(role, page, 'can_create', e.target.checked)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={permission.can_edit}
                            onChange={(e) => updatePermission(role, page, 'can_edit', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={permission.can_delete}
                            onChange={(e) => updatePermission(role, page, 'can_delete', e.target.checked)}
                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                          />
                        </td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>
        </div>


      </PageAccessControl>
    </Layout>
  );
}