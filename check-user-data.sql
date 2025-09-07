-- 1. Cek user yang sedang login (sesuaikan dengan user yang sedang digunakan)
SELECT id_user, nama_lengkap, role, cabang FROM users 
WHERE role LIKE '%pic%' OR role = 'pic_branch' OR role = 'pic branch';

-- 2. Cek permission berdasarkan user_id (jika ada)
SELECT cp.*, u.nama_lengkap, u.role as user_role 
FROM crud_permissions cp
LEFT JOIN users u ON cp.user_id = u.id_user
WHERE cp.page = 'gudang'
ORDER BY cp.role, cp.user_id;

-- 3. Cek semua role yang ada di sistem
SELECT DISTINCT role FROM users ORDER BY role;

-- 4. Cek semua role yang ada di crud_permissions
SELECT DISTINCT role FROM crud_permissions ORDER BY role;