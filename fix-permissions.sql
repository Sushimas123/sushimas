-- Check if permission record exists for pic_branch + gudang
SELECT * FROM crud_permissions WHERE role = 'pic_branch' AND page = 'gudang';

-- If no record exists, insert one with all permissions set to false
INSERT INTO crud_permissions (role, page, can_create, can_edit, can_delete)
SELECT 'pic_branch', 'gudang', false, false, false
WHERE NOT EXISTS (
    SELECT 1 FROM crud_permissions 
    WHERE role = 'pic_branch' AND page = 'gudang'
);

-- Update the record to ensure it's set to false (in case it exists)
UPDATE crud_permissions 
SET can_create = false, can_edit = false, can_delete = false
WHERE role = 'pic_branch' AND page = 'gudang';

-- Verify the record
SELECT * FROM crud_permissions WHERE role = 'pic_branch' AND page = 'gudang';