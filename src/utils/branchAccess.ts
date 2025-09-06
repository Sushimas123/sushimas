// Branch-based access control utilities
export interface UserBranchInfo {
  role: string;
  cabang: string | null;
}

export const getUserBranchInfo = (): UserBranchInfo => {
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return {
        role: user.role || 'staff',
        cabang: user.cabang || null
      };
    }
  } catch (error) {
    console.error('Error getting user branch info:', error);
  }
  return { role: 'staff', cabang: null };
};

export const shouldFilterByBranch = (userRole: string): boolean => {
  // Only PIC Branch users are restricted to their branch
  return userRole === 'pic_branch';
};

export const getBranchFilter = (): string | null => {
  const { role, cabang } = getUserBranchInfo();
  return shouldFilterByBranch(role) ? cabang : null;
};

// For forms - get allowed branches for user
export const getAllowedBranches = (allBranches: any[]): any[] => {
  const { role, cabang } = getUserBranchInfo();
  
  if (shouldFilterByBranch(role) && cabang) {
    // PIC Branch can only see their branch
    return allBranches.filter(branch => 
      branch.nama_branch === cabang || 
      branch.kode_branch === cabang
    );
  }
  
  // Admin, Manager, Staff can see all branches
  return allBranches;
};