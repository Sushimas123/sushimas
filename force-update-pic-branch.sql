-- Force update pic_branch permissions

-- Delete existing record first
DELETE FROM crud_permissions WHERE role = 'pic_branch' AND page = 'ready';

-- Insert new record with correct permissions
INSERT INTO crud_permissions (role, page, can_create, can_edit, can_delete) 
VALUES ('pic_branch', 'ready', true, true, false);