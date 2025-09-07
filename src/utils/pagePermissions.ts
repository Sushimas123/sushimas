import { supabase } from '@/src/lib/supabaseClient'

export const checkPageAccess = async (userRole: string, pageName: string): Promise<boolean> => {
  // Super admin always has access
  if (userRole === 'super admin') {
    return true
  }

  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('can_access')
      .eq('role', userRole)
      .eq('page', pageName)
      .single()

    if (error || !data) {
      return false // No permission found = no access
    }

    return data.can_access
  } catch (error) {
    console.error('Error checking page access:', error)
    return false
  }
}