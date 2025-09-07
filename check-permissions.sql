-- Check current permissions for gudang page
SELECT role, page, can_create, can_edit, can_delete 
FROM crud_permissions 
WHERE page = 'gudang' 
ORDER BY role;

-- Check all permissions for pic_branch role
SELECT role, page, can_create, can_edit, can_delete 
FROM crud_permissions 
WHERE role = 'pic_branch' 
ORDER BY page;