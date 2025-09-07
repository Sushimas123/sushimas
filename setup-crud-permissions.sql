-- Setup CRUD permissions for ready page for all roles

-- Super Admin
INSERT INTO crud_permissions (role, page, can_create, can_edit, can_delete) 
VALUES ('super admin', 'ready', true, true, true)
ON CONFLICT (role, page) DO UPDATE SET 
can_create = true, can_edit = true, can_delete = true;

-- Admin
INSERT INTO crud_permissions (role, page, can_create, can_edit, can_delete) 
VALUES ('admin', 'ready', true, true, true)
ON CONFLICT (role, page) DO UPDATE SET 
can_create = true, can_edit = true, can_delete = true;

-- Finance
INSERT INTO crud_permissions (role, page, can_create, can_edit, can_delete) 
VALUES ('finance', 'ready', false, true, false)
ON CONFLICT (role, page) DO UPDATE SET 
can_create = false, can_edit = true, can_delete = false;

-- PIC Branch (with underscore)
INSERT INTO crud_permissions (role, page, can_create, can_edit, can_delete) 
VALUES ('pic_branch', 'ready', true, true, false)
ON CONFLICT (role, page) DO UPDATE SET 
can_create = true, can_edit = true, can_delete = false;

-- Staff
INSERT INTO crud_permissions (role, page, can_create, can_edit, can_delete) 
VALUES ('staff', 'ready', false, false, false)
ON CONFLICT (role, page) DO UPDATE SET 
can_create = false, can_edit = false, can_delete = false;