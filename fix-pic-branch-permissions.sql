-- Fix pic_branch permissions for ready page

UPDATE crud_permissions 
SET can_create = true, can_edit = true, can_delete = false
WHERE role = 'pic_branch' AND page = 'ready';