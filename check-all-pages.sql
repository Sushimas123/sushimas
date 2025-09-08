-- Cek semua halaman yang ada di crud_permissions
SELECT DISTINCT page FROM crud_permissions ORDER BY page;

-- Cek permission untuk pic_branch di semua halaman
SELECT page, can_create, can_edit, can_delete 
FROM crud_permissions 
WHERE role = 'pic_branch' 
ORDER BY page;