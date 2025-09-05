// Role permissions
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager', 
  PIC_BRANCH: 'pic_branch',
  STAFF: 'staff'
} as const;

// Check if user has required role
export const hasRole = (userRole: string, allowedRoles: string[]): boolean => {
  return allowedRoles.includes(userRole);
};

// Page access permissions
export const PAGE_PERMISSIONS = {
  '/ready': ['admin', 'manager', 'pic_branch', 'staff'],
  '/esb': ['admin', 'manager'],
  '/analysis': ['admin', 'manager'],
  '/produksi': ['admin', 'manager', 'pic_branch'],
  '/produksi_detail': ['admin', 'manager']
};

// Check page access
export const canAccessPage = (userRole: string, path: string): boolean => {
  const allowedRoles = PAGE_PERMISSIONS[path as keyof typeof PAGE_PERMISSIONS];
  return allowedRoles ? hasRole(userRole, allowedRoles) : false;
};