-- Setup default column permissions for ready page for all roles

-- Super Admin - full access
INSERT INTO user_permissions (role, page, columns, can_access) 
VALUES ('super admin', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "id_product", "ready", "waste"]', true)
ON CONFLICT (role, page) DO UPDATE SET 
columns = '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "id_product", "ready", "waste"]',
can_access = true;

-- Admin - full access
INSERT INTO user_permissions (role, page, columns, can_access) 
VALUES ('admin', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "id_product", "ready", "waste"]', true)
ON CONFLICT (role, page) DO UPDATE SET 
columns = '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "id_product", "ready", "waste"]',
can_access = true;

-- Finance - limited access (no waste column)
INSERT INTO user_permissions (role, page, columns, can_access) 
VALUES ('finance', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "ready"]', true)
ON CONFLICT (role, page) DO UPDATE SET 
columns = '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "ready"]',
can_access = true;

-- PIC Branch - basic access (no id_product, waste)
INSERT INTO user_permissions (role, page, columns, can_access) 
VALUES ('pic_branch', 'ready', '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "ready"]', true)
ON CONFLICT (role, page) DO UPDATE SET 
columns = '["ready_no", "tanggal_input", "branch_name", "sub_category", "product_name", "ready"]',
can_access = true;

-- Staff - minimal access (basic columns only)
INSERT INTO user_permissions (role, page, columns, can_access) 
VALUES ('staff', 'ready', '["tanggal_input", "product_name", "ready"]', true)
ON CONFLICT (role, page) DO UPDATE SET 
columns = '["tanggal_input", "product_name", "ready"]',
can_access = true;