-- Check exact values in database
SELECT 
    id,
    role,
    page,
    can_create,
    can_edit,
    can_delete,
    LENGTH(role) as role_length,
    LENGTH(page) as page_length
FROM crud_permissions 
WHERE role LIKE '%pic_branch%' OR page LIKE '%gudang%'
ORDER BY role, page;