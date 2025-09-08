-- Update all 'pic_branch' roles to 'pic_branch' in crud_permissions table
UPDATE crud_permissions 
SET role = 'pic_branch' 
WHERE role = 'pic_branch';

-- Verify the update
SELECT role, page, can_create, can_edit, can_delete 
FROM crud_permissions 
WHERE role = 'pic_branch';