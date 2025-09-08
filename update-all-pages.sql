-- SQL untuk memberikan akses penuh ke semua halaman untuk semua role
-- Jalankan ini untuk menerapkan permission system ke semua halaman

-- Insert permissions untuk semua halaman dan semua role
INSERT INTO user_permissions (role, page, columns, can_access) VALUES
-- Super Admin - Full access to all pages
('super admin', 'esb', ARRAY['*'], true),
('super admin', 'ready', ARRAY['*'], true),
('super admin', 'produksi', ARRAY['*'], true),
('super admin', 'produksi_detail', ARRAY['*'], true),
('super admin', 'gudang', ARRAY['*'], true),
('super admin', 'stock_opname', ARRAY['*'], true),
('super admin', 'analysis', ARRAY['*'], true),
('super admin', 'users', ARRAY['*'], true),
('super admin', 'branches', ARRAY['*'], true),
('super admin', 'categories', ARRAY['*'], true),
('super admin', 'product_name', ARRAY['*'], true),
('super admin', 'product_settings', ARRAY['*'], true),
('super admin', 'recipes', ARRAY['*'], true),
('super admin', 'supplier', ARRAY['*'], true),
('super admin', 'permissions-db', ARRAY['*'], true),
('super admin', 'crud-permissions', ARRAY['*'], true),
('super admin', 'audit-log', ARRAY['*'], true),

-- Admin - Full access to all pages
('admin', 'esb', ARRAY['*'], true),
('admin', 'ready', ARRAY['*'], true),
('admin', 'produksi', ARRAY['*'], true),
('admin', 'produksi_detail', ARRAY['*'], true),
('admin', 'gudang', ARRAY['*'], true),
('admin', 'stock_opname', ARRAY['*'], true),
('admin', 'analysis', ARRAY['*'], true),
('admin', 'users', ARRAY['*'], true),
('admin', 'branches', ARRAY['*'], true),
('admin', 'categories', ARRAY['*'], true),
('admin', 'product_name', ARRAY['*'], true),
('admin', 'product_settings', ARRAY['*'], true),
('admin', 'recipes', ARRAY['*'], true),
('admin', 'supplier', ARRAY['*'], true),
('admin', 'permissions-db', ARRAY['*'], true),
('admin', 'crud-permissions', ARRAY['*'], true),
('admin', 'audit-log', ARRAY['*'], true),

-- Finance - Access to financial and operational pages
('finance', 'esb', ARRAY['*'], true),
('finance', 'ready', ARRAY['*'], true),
('finance', 'produksi', ARRAY['*'], true),
('finance', 'produksi_detail', ARRAY['*'], true),
('finance', 'gudang', ARRAY['*'], true),
('finance', 'stock_opname', ARRAY['*'], true),
('finance', 'analysis', ARRAY['*'], true),
('finance', 'users', ARRAY['email', 'nama_lengkap', 'role', 'cabang'], true),
('finance', 'categories', ARRAY['*'], true),
('finance', 'product_name', ARRAY['*'], true),
('finance', 'recipes', ARRAY['*'], true),
('finance', 'supplier', ARRAY['*'], true),

-- pic_branch - Access to operational pages
('pic_branch', 'esb', ARRAY['*'], true),
('pic_branch', 'ready', ARRAY['*'], true),
('pic_branch', 'produksi', ARRAY['*'], true),
('pic_branch', 'produksi_detail', ARRAY['*'], true),
('pic_branch', 'gudang', ARRAY['*'], true),
('pic_branch', 'stock_opname', ARRAY['*'], true),
('pic_branch', 'analysis', ARRAY['*'], true),
('pic_branch', 'users', ARRAY['email', 'nama_lengkap', 'role'], true),
('pic_branch', 'branches', ARRAY['nama_branch', 'kode_branch', 'alamat'], true),

-- Staff - Basic operational access
('staff', 'esb', ARRAY['sales_date', 'branch', 'product', 'category', 'sub_category', 'qty_total', 'value_total'], true),
('staff', 'ready', ARRAY['ready_no', 'tanggal_input', 'branch', 'category', 'product_name', 'quantity'], true),
('staff', 'produksi', ARRAY['tanggal_produksi', 'product_name', 'quantity', 'branch'], true),
('staff', 'produksi_detail', ARRAY['tanggal_produksi', 'item_id', 'quantity_used', 'branch'], true),
('staff', 'gudang', ARRAY['tanggal_input', 'product_name', 'quantity', 'branch'], true),
('staff', 'stock_opname', ARRAY['tanggal_opname', 'product_name', 'system_qty', 'actual_qty', 'branch'], true)

ON CONFLICT (role, page) DO UPDATE SET 
  columns = EXCLUDED.columns, 
  can_access = EXCLUDED.can_access,
  updated_at = NOW();

-- Verify the permissions were inserted
SELECT role, page, can_access, array_length(columns, 1) as column_count 
FROM user_permissions 
ORDER BY role, page;