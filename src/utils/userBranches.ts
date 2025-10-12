import { supabase } from '@/src/lib/supabaseClient'

export interface UserBranch {
  kode_branch: string
  nama_branch: string
  is_active: boolean
}

/**
 * Get branches that user has access to based on their role and user_branches table
 */
export const getUserBranches = async (userId: number, userRole: string): Promise<UserBranch[]> => {
  try {
    // Super admin and admin can see all branches
    if (userRole === 'super admin' || userRole === 'admin') {
      const { data, error } = await supabase
        .from('branches')
        .select('kode_branch, nama_branch, is_active')
        .eq('is_active', true)
        .order('nama_branch')
      
      if (error) throw error
      return data || []
    }

    // Other roles only see branches they're assigned to
    const { data, error } = await supabase
      .from('user_branches')
      .select(`
        kode_branch,
        branches!inner (
          nama_branch,
          is_active
        )
      `)
      .eq('id_user', userId)
      .eq('is_active', true)
      .eq('branches.is_active', true)
      .order('branches.nama_branch')

    if (error) throw error

    return (data || []).map(item => ({
      kode_branch: item.kode_branch,
      nama_branch: item.branches.nama_branch,
      is_active: item.branches.is_active
    }))

  } catch (error) {
    console.error('Error fetching user branches:', error)
    return []
  }
}

/**
 * Check if user has access to specific branch
 */
export const hasAccessToBranch = async (userId: number, userRole: string, branchCode: string): Promise<boolean> => {
  try {
    // Super admin and admin have access to all branches
    if (userRole === 'super admin' || userRole === 'admin') {
      return true
    }

    const { data, error } = await supabase
      .from('user_branches')
      .select('id_user_branch')
      .eq('id_user', userId)
      .eq('kode_branch', branchCode)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return !!data

  } catch (error) {
    console.error('Error checking branch access:', error)
    return false
  }
}

/**
 * Filter data based on user's branch access
 */
export const filterDataByUserBranches = async <T extends { kode_branch?: string }>(
  data: T[], 
  userId: number, 
  userRole: string
): Promise<T[]> => {
  try {
    // Super admin and admin see all data
    if (userRole === 'super admin' || userRole === 'admin') {
      return data
    }

    // Get user's allowed branches
    const userBranches = await getUserBranches(userId, userRole)
    const allowedBranchCodes = userBranches.map(b => b.kode_branch)

    // Filter data to only include allowed branches
    return data.filter(item => 
      item.kode_branch && allowedBranchCodes.includes(item.kode_branch)
    )

  } catch (error) {
    console.error('Error filtering data by user branches:', error)
    return []
  }
}