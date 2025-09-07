-- Check staff permissions untuk ESB
SELECT * FROM user_permissions 
WHERE role = 'staff' AND page = 'esb';

-- Check semua permissions untuk staff
SELECT * FROM user_permissions 
WHERE role = 'staff' 
ORDER BY page;