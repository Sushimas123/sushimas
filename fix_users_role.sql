-- Update all 'pic_branch' roles to 'pic_branch' in users table
UPDATE users 
SET role = 'pic_branch' 
WHERE role = 'pic_branch';

-- Verify the update
SELECT id_user, username, role 
FROM users 
WHERE role = 'pic_branch';