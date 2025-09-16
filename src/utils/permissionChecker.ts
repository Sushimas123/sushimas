import { supabase } from '@/src/lib/supabaseClient';
import { safeLog } from '@/src/utils/logSanitizer';

// Direct database permission check - bypasses cache
export const checkPermissionFromDB = async (userRole: string, page: string, action: 'create' | 'edit' | 'delete'): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('crud_permissions')
      .select(`can_${action}`)
      .eq('role', userRole)
      .eq('page', page)
      .single();
    
    if (error) {
      safeLog('Permission check error:', error);
      return false;
    }
    
    return (data as any)?.[`can_${action}`] || false;
  } catch (error) {
    safeLog('Error checking permission from DB:', error);
    return false;
  }
};

// Check if user has ANY access to a page (create, edit, or delete)
export const hasPageAccess = async (userRole: string, page: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('crud_permissions')
      .select('can_create, can_edit, can_delete')
      .eq('role', userRole)
      .eq('page', page);
    
    if (error) {
      safeLog('Page access check error:', error);
      return false;
    }
    
    if (!data || data.length === 0) {
      return false;
    }
    
    const perm = data[0];
    return perm?.can_create || perm?.can_edit || perm?.can_delete || false;
  } catch (error) {
    safeLog('Error checking page access from DB:', error);
    return false;
  }
};