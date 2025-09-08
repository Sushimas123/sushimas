-- Standardize all roles to use underscore format

-- Update existing pic_branch to pic_branch in crud_permissions
UPDATE crud_permissions SET role = 'pic_branch' WHERE role = 'pic_branch';

-- Update existing pic_branch to pic_branch in user_permissions  
UPDATE user_permissions SET role = 'pic_branch' WHERE role = 'pic_branch';

-- Insert/Update with standardized names
INSERT INTO crud_permissions (role, page, can_create, can_edit, can_delete) VALUES
('super_admin', 'ready', true, true, true),
('admin', 'ready', true, true, true),
('finance', 'ready', false, true, false),
('pic_branch', 'ready', true, true, false),
('staff', 'ready', false, false, false)
ON CONFLICT (role, page) DO UPDATE SET 
can_create = EXCLUDED.can_create, 
can_edit = EXCLUDED.can_edit, 
can_delete = EXCLUDED.can_delete;

INSERT INTO user_permissions (role, page, columns, can_access) VALUES
('super_admin', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "id_product", "ready", "waste"]', true),
('admin', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "id_product", "ready", "waste"]', true),
('finance', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "ready"]', true),
('pic_branch', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "ready"]', true),
('staff', 'ready', '["tanggal_input", "product_name", "ready"]', true)
ON CONFLICT (role, page) DO UPDATE SET 
columns = EXCLUDED.columns,
can_access = EXCLUDED.can_access;