-- Fix all permission inconsistencies

-- 1. CRUD Permissions (for page access)
INSERT INTO crud_permissions (role, page, can_create, can_edit, can_delete) VALUES
('super admin', 'ready', true, true, true),
('admin', 'ready', true, true, true),
('finance', 'ready', false, true, false),
('pic branch', 'ready', true, true, false),
('staff', 'ready', false, false, false)
ON CONFLICT (role, page) DO UPDATE SET 
can_create = EXCLUDED.can_create, 
can_edit = EXCLUDED.can_edit, 
can_delete = EXCLUDED.can_delete;

-- 2. User Permissions (for column access) - using same role names
INSERT INTO user_permissions (role, page, columns, can_access) VALUES
('super admin', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "id_product", "ready", "waste"]', true),
('admin', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "id_product", "ready", "waste"]', true),
('finance', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "ready"]', true),
('pic branch', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "ready"]', true),
('staff', 'ready', '["tanggal_input", "product_name", "ready"]', true)
ON CONFLICT (role, page) DO UPDATE SET 
columns = EXCLUDED.columns,
can_access = EXCLUDED.can_access;