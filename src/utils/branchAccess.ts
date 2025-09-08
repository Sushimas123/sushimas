import { supabase } from '@/src/lib/supabaseClient'

interface User {
  id_user: number
  role: string
  cabang?: string
  branches?: string[]
}

// Get current user's branch information
export const getCurrentUser = (): User | null => {
  if (typeof window === 'undefined') return null
  
  const userData = localStorage.getItem('user')
  if (!userData) return null
  
  try {
    return JSON.parse(userData)
  } catch {
    return null
  }
}

// Get user's allowed branches based on role and assignments
export const getUserBranches = async (userId: number): Promise<string[]> => {
  const user = getCurrentUser()
  if (!user) return []
  
  // Super admin and admin can see all branches
  if (user.role === 'super admin' || user.role === 'admin') {
    const { data } = await supabase
      .from('branches')
      .select('kode_branch')
      .eq('is_active', true)
    
    return data?.map(b => b.kode_branch) || []
  }
  
  // Other roles only see their assigned branches
  const { data } = await supabase
    .from('user_branches')
    .select('kode_branch')
    .eq('id_user', userId)
    .eq('is_active', true)
  
  return data?.map(b => b.kode_branch) || []
}

// Get branch filter for queries (returns branch codes user can access)
export const getBranchFilter = async (): Promise<string[] | null> => {
  const user = getCurrentUser()
  if (!user) return null
  
  // Super admin and admin can see all branches
  if (user.role === 'super admin' || user.role === 'admin') {
    return null // No filter = see all
  }
  
  // Other roles only see their assigned branches
  return await getUserBranches(user.id_user)
}

// Get user's default/primary branch for auto-selection
export const getUserDefaultBranch = async (): Promise<string | null> => {
  const user = getCurrentUser()
  if (!user) return null
  
  // For super admin/admin, return null (they choose manually)
  if (user.role === 'super admin' || user.role === 'admin') {
    return null
  }
  
  // For other roles, return their first assigned branch
  const branches = await getUserBranches(user.id_user)
  return branches.length > 0 ? branches[0] : null
}

// Apply branch filter to Supabase query
export const applyBranchFilter = async (query: any, branchColumn: string = 'kode_branch') => {
  const branchFilter = await getBranchFilter()
  
  if (branchFilter && branchFilter.length > 0) {
    return query.in(branchColumn, branchFilter)
  }
  
  return query // No filter for admin/manager
}

// Synchronous version for immediate use
export const applyBranchFilterSync = (query: any, branchCodes: string[], branchColumn: string = 'kode_branch') => {
  if (branchCodes && branchCodes.length > 0) {
    return query.in(branchColumn, branchCodes)
  }
  return query
}

// Get branch name from code
export const getBranchName = async (branchCode: string): Promise<string> => {
  const { data } = await supabase
    .from('branches')
    .select('nama_branch')
    .eq('kode_branch', branchCode)
    .single()
  
  return data?.nama_branch || branchCode
}

// Check if user can access specific branch
export const canAccessBranch = async (branchCode: string): Promise<boolean> => {
  const user = getCurrentUser()
  if (!user) return false
  
  // All roles can access all branches
  return true
}