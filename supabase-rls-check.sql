-- Check RLS policies untuk tabel esb_harian
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'esb_harian';

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'esb_harian';

-- Jika RLS aktif dan memblokir Apps Script, bisa disable sementara:
-- ALTER TABLE esb_harian DISABLE ROW LEVEL SECURITY;

-- Atau buat policy khusus untuk anon role:
-- CREATE POLICY "Allow anon read access" ON esb_harian
-- FOR SELECT TO anon
-- USING (true);

-- Check apakah anon role punya akses SELECT
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'esb_harian' 
AND grantee = 'anon';

-- Grant akses jika belum ada
-- GRANT SELECT ON esb_harian TO anon;