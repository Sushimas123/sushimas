-- Fix all roles permissions for ready page

-- Delete all existing records for ready page
DELETE FROM crud_permissions WHERE page = 'ready';

-- Insert correct permissions for all roles
INSERT INTO crud_permissions (role, page, can_create, can_edit, can_delete) VALUES
('super_admin', 'ready', true, true, true),
('admin', 'ready', true, true, true),
('finance', 'ready', false, true, false),
('pic_branch', 'ready', true, true, false),
('staff', 'ready', false, false, false);

-- Also fix user_permissions table for column access
DELETE FROM user_permissions WHERE page = 'ready';

INSERT INTO user_permissions (role, page, columns, can_access) VALUES
('super_admin', 'ready', '{"ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "id_product", "ready", "waste"}', true),
('admin', 'ready', '{"ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "id_product", "ready", "waste"}', true),
('finance', 'ready', '{"ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "ready"}', true),
('pic_branch', 'ready', '{"ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "ready"}', true),
('staff', 'ready', '{"tanggal_input", "product_name", "ready"}', true);