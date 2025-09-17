import { supabase } from '@/src/lib/supabaseClient';

// Cache for permissions
let permissionsCache: Map<string, boolean> = new Map();
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fallback permissions if database is unavailable
const FALLBACK_PERMISSIONS = {
  'super admin': {
    ready: { create: true, edit: true, delete: true },
    gudang: { create: true, edit: true, delete: true },
    produksi: { create: true, edit: true, delete: true },
    produksi_detail: { create: true, edit: true, delete: true },
    analysis: { create: true, edit: true, delete: true },
    esb: { create: true, edit: true, delete: true },
    product_name: { create: true, edit: true, delete: true },
    categories: { create: true, edit: true, delete: true },
    recipes: { create: true, edit: true, delete: true },
    supplier: { create: true, edit: true, delete: true },
    branches: { create: true, edit: true, delete: true },
    users: { create: true, edit: true, delete: true },
    stock_opname_batch: { create: true, edit: true, delete: true },
    product_settings: { create: true, edit: true, delete: true },
    'permissions-db': { create: true, edit: true, delete: true }
  },
  'admin': {
    ready: { create: true, edit: true, delete: true },
    gudang: { create: true, edit: true, delete: true },
    produksi: { create: true, edit: true, delete: true },
    produksi_detail: { create: true, edit: true, delete: true },
    analysis: { create: true, edit: true, delete: true },
    esb: { create: true, edit: true, delete: true },
    product_name: { create: true, edit: true, delete: true },
    categories: { create: true, edit: true, delete: true },
    recipes: { create: true, edit: true, delete: true },
    supplier: { create: true, edit: true, delete: true },
    branches: { create: true, edit: true, delete: true },
    users: { create: true, edit: true, delete: true },
    stock_opname_batch: { create: true, edit: true, delete: true },
    product_settings: { create: true, edit: true, delete: true },
    'permissions-db': { create: true, edit: true, delete: true }
  },
  'finance': {
    ready: { create: false, edit: false, delete: false },
    gudang: { create: false, edit: false, delete: false },
    produksi: { create: false, edit: false, delete: false },
    produksi_detail: { create: false, edit: false, delete: false },
    analysis: { create: false, edit: false, delete: false },
    esb: { create: false, edit: false, delete: false },
    product_name: { create: false, edit: false, delete: false },
    categories: { create: false, edit: false, delete: false },
    recipes: { create: false, edit: false, delete: false },
    supplier: { create: false, edit: false, delete: false },
    branches: { create: false, edit: false, delete: false },
    users: { create: false, edit: false, delete: false },
    stock_opname_batch: { create: false, edit: false, delete: false },
    product_settings: { create: false, edit: false, delete: false },
    'permissions-db': { create: false, edit: false, delete: false }
  },
  'pic_branch': {
    ready: { create: true, edit: true, delete: false },
    gudang: { create: false, edit: false, delete: false },
    produksi: { create: true, edit: true, delete: false },
    produksi_detail: { create: true, edit: true, delete: false },
    analysis: { create: true, edit: true, delete: false },
    esb: { create: true, edit: true, delete: false },
    product_name: { create: true, edit: true, delete: false },
    categories: { create: true, edit: true, delete: false },
    recipes: { create: true, edit: true, delete: false },
    supplier: { create: true, edit: true, delete: false },
    branches: { create: true, edit: true, delete: false },
    users: { create: true, edit: true, delete: false },
    stock_opname_batch: { create: true, edit: true, delete: false },
    product_settings: { create: true, edit: true, delete: false },
    'permissions-db': { create: true, edit: true, delete: false }
  },
  'staff': {
    ready: { create: true, edit: false, delete: false },
    gudang: { create: true, edit: false, delete: false },
    produksi: { create: true, edit: false, delete: false },
    produksi_detail: { create: false, edit: false, delete: false },
    analysis: { create: false, edit: false, delete: false },
    esb: { create: false, edit: false, delete: false },
    product_name: { create: false, edit: false, delete: false },
    categories: { create: false, edit: false, delete: false },
    recipes: { create: false, edit: false, delete: false },
    supplier: { create: false, edit: false, delete: false },
    branches: { create: false, edit: false, delete: false },
    users: { create: false, edit: false, delete: false },
    stock_opname_batch: { create: false, edit: false, delete: false },
    product_settings: { create: false, edit: false, delete: false },
    'permissions-db': { create: false, edit: false, delete: false }
  }
};

let isLoadingPermissions = false;

const loadPermissionsFromDB = async (): Promise<void> => {
  // Prevent multiple simultaneous loads
  if (isLoadingPermissions) return;
  
  try {
    isLoadingPermissions = true;
    const { data, error } = await supabase
      .from('crud_permissions')
      .select('user_id, role, page, can_create, can_edit, can_delete');

    if (error) {
      console.error('Database error loading permissions:', error);
      throw error;
    }

    // Only clear cache if we got new data
    if (data && data.length > 0) {
      permissionsCache.clear();

      // Populate cache
      data.forEach(perm => {
        // Create keys for both role-based and user-specific permissions
        const roleKey = `${perm.role.toLowerCase()}|${perm.page}`;
        const userKey = perm.user_id ? `user_${perm.user_id}|${perm.page}` : null;
        
        // Store role-based permissions
        permissionsCache.set(`${roleKey}|create`, perm.can_create);
        permissionsCache.set(`${roleKey}|edit`, perm.can_edit);
        permissionsCache.set(`${roleKey}|delete`, perm.can_delete);
        
        // Store user-specific permissions if user_id exists
        if (userKey) {
          permissionsCache.set(`${userKey}|create`, perm.can_create);
          permissionsCache.set(`${userKey}|edit`, perm.can_edit);
          permissionsCache.set(`${userKey}|delete`, perm.can_delete);
        }
      });

      cacheTimestamp = Date.now();
    }
  } catch (error) {
    console.error('Error loading CRUD permissions from database:', error);
  } finally {
    isLoadingPermissions = false;
  }
};

export const canPerformAction = async (userRole: string, page: string, action: 'create' | 'edit' | 'delete', userId?: number): Promise<boolean> => {
  try {
    // Super admin and admin always have full access
    if (userRole === 'super admin' || userRole === 'admin') {
      return true;
    }
    
    // Check if cache is expired
    if (Date.now() - cacheTimestamp > CACHE_DURATION) {
      await loadPermissionsFromDB();
    }

    // Check user-specific permissions first (if userId provided)
    if (userId) {
      const userKey = `user_${userId}|${page}|${action}`;
      if (permissionsCache.has(userKey)) {
        return permissionsCache.get(userKey) || false;
      }
    }

    // Check role-based permissions
    const roleKey = `${userRole.toLowerCase()}|${page}|${action}`;
    if (permissionsCache.has(roleKey)) {
      return permissionsCache.get(roleKey) || false;
    }

    // If not in cache, try to load from DB once more
    await loadPermissionsFromDB();
    
    // Check again after reload
    if (userId) {
      const userKey = `user_${userId}|${page}|${action}`;
      if (permissionsCache.has(userKey)) {
        return permissionsCache.get(userKey) || false;
      }
    }
    
    if (permissionsCache.has(roleKey)) {
      return permissionsCache.get(roleKey) || false;
    }

    // Fallback to hardcoded permissions
    const fallbackPerms = FALLBACK_PERMISSIONS[userRole.toLowerCase() as keyof typeof FALLBACK_PERMISSIONS];
    if (fallbackPerms) {
      const pagePerms = fallbackPerms[page as keyof typeof fallbackPerms];
      if (pagePerms) {
        return pagePerms[action];
      }
    }

    return false;
  } catch (error) {
    console.error('Error in canPerformAction:', error);
    return canPerformActionSync(userRole, page, action, userId);
  }
};

// Synchronous version for immediate use (uses cache only)
export const canPerformActionSync = (userRole: string, page: string, action: 'create' | 'edit' | 'delete', userId?: number): boolean => {
  // Super admin and admin always have full access
  if (userRole === 'super admin' || userRole === 'admin') {
    return true;
  }
  
  // Load permissions only once if cache is empty
  if (permissionsCache.size === 0 && Date.now() - cacheTimestamp > 1000) {
    loadPermissionsFromDB();
    cacheTimestamp = Date.now(); // Prevent multiple simultaneous loads
  }
  
  // Check user-specific permissions first (if userId provided)
  if (userId) {
    const userKey = `user_${userId}|${page}|${action}`;
    if (permissionsCache.has(userKey)) {
      return permissionsCache.get(userKey) || false;
    }
  }
  
  // Check role-based permissions
  const roleKey = `${userRole.toLowerCase()}|${page}|${action}`;
  if (permissionsCache.has(roleKey)) {
    return permissionsCache.get(roleKey) || false;
  }

  // Fallback to hardcoded permissions immediately (don't wait for DB)
  const fallbackPerms = FALLBACK_PERMISSIONS[userRole.toLowerCase() as keyof typeof FALLBACK_PERMISSIONS];
  if (fallbackPerms) {
    const pagePerms = fallbackPerms[page as keyof typeof fallbackPerms];
    if (pagePerms) {
      return pagePerms[action];
    }
  }

  return false;
};

// Initialize permissions on module load (only once)
if (typeof window !== 'undefined' && permissionsCache.size === 0) {
  // Load permissions immediately but only once
  loadPermissionsFromDB();
}

export const getUserRole = (): string => {
  if (typeof window !== 'undefined') {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.role || '';
    }
    return localStorage.getItem('userRole') || '';
  }
  return '';
};

// Force reload permissions from database
export const reloadPermissions = async (): Promise<void> => {
  permissionsCache.clear();
  cacheTimestamp = 0;
  await loadPermissionsFromDB();
  console.log('Permission cache reloaded, size:', permissionsCache.size);
};

// Check if permissions are loaded
export const arePermissionsLoaded = (): boolean => {
  return permissionsCache.size > 0;
};