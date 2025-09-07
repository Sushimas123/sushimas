import { supabase } from '@/src/lib/supabaseClient';

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
      console.error('Permission check error:', error);
      return false;
    }
    
    return data?.[`can_${action}`] || false;
  } catch (error) {
    console.error('Error checking permission from DB:', error);
    return false;
  }
};

// Check if user has ANY access to a page (create, edit, or delete)
export const hasPageAccess = async (userRole: string, page: string): Promise<boolean> => {
  try {
    console.log(`Checking permission for role: '${userRole}', page: '${page}'`);
    // Handle role name variations - convert underscore to space
    const roleToCheck = userRole.replace('_', ' ');
    const { data, error } = await supabase
      .from('crud_permissions')
      .select('can_create, can_edit, can_delete')
      .eq('role', roleToCheck)
      .eq('page', page);
    
    console.log('Query result:', { data, error });
    
    if (error) {
      console.error('Page access check error:', error);
      return false;
    }
    
    // If no data found, return false
    if (!data || data.length === 0) {
      console.log(`No permission record found for ${userRole} on ${page}`);
      return false;
    }
    
    const perm = data[0];
    const hasAccess = perm?.can_create || perm?.can_edit || perm?.can_delete || false;
    console.log(`Permission check for ${userRole} on ${page}:`, perm, 'Result:', hasAccess);
    return hasAccess;
  } catch (error) {
    console.error('Error checking page access from DB:', error);
    return false;
  }
};