-- Enable gudang access for pic branch
UPDATE crud_permissions 
SET can_create = true, can_edit = true, can_delete = false
WHERE role = 'pic branch' AND page = 'gudang';

-- Verify the change
SELECT * FROM crud_permissions WHERE role = 'pic branch' AND page = 'gudang';