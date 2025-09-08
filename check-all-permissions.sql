-- 1. Cek struktur tabel crud_permissions
\d crud_permissions;

-- 2. Cek semua data di crud_permissions
SELECT * FROM crud_permissions ORDER BY role, page;

-- 3. Cek tabel users untuk melihat role yang digunakan
SELECT id_user, nama_lengkap, role, cabang FROM users LIMIT 10;

-- 4. Cek apakah ada tabel roles atau role_permissions lain
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%role%' OR table_name LIKE '%permission%';

-- 5. Cek data user yang sedang login (ganti dengan user ID yang sesuai)
SELECT * FROM users WHERE role = 'pic_branch';

-- 6. Cek apakah ada foreign key atau constraint
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND (tc.table_name = 'crud_permissions' OR tc.table_name = 'users');