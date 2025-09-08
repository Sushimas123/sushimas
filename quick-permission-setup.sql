-- Quick setup: Berikan akses penuh ke semua halaman untuk semua role
-- Jalankan ini untuk menerapkan permission system dengan cepat

INSERT INTO user_permissions (role, page, columns, can_access) VALUES
-- Staff - akses ke halaman operasional
('staff', 'esb', ARRAY['*'], true),
('staff', 'ready', ARRAY['*'], true),
('staff', 'produksi', ARRAY['*'], true),
('staff', 'produksi_detail', ARRAY['*'], true),
('staff', 'gudang', ARRAY['*'], true),
('staff', 'stock_opname', ARRAY['*'], true),
('staff', 'analysis', ARRAY['*'], true),

-- pic_branch - akses ke semua halaman operasional + beberapa master data
('pic_branch', 'esb', ARRAY['*'], true),
('pic_branch', 'ready', ARRAY['*'], true),
('pic_branch', 'produksi', ARRAY['*'], true),
('pic_branch', 'produksi_detail', ARRAY['*'], true),
('pic_branch', 'gudang', ARRAY['*'], true),
('pic_branch', 'stock_opname', ARRAY['*'], true),
('pic_branch', 'analysis', ARRAY['*'], true),
('pic_branch', 'users', ARRAY['*'], true),
('pic_branch', 'branches', ARRAY['*'], true),
('pic_branch', 'categories', ARRAY['*'], true),
('pic_branch', 'product_name', ARRAY['*'], true),
('pic_branch', 'recipes', ARRAY['*'], true),
('pic_branch', 'supplier', ARRAY['*'], true),

-- Finance - akses ke semua halaman kecuali admin
('finance', 'esb', ARRAY['*'], true),
('finance', 'ready', ARRAY['*'], true),
('finance', 'produksi', ARRAY['*'], true),
('finance', 'produksi_detail', ARRAY['*'], true),
('finance', 'gudang', ARRAY['*'], true),
('finance', 'stock_opname', ARRAY['*'], true),
('finance', 'analysis', ARRAY['*'], true),
('finance', 'users', ARRAY['*'], true),
('finance', 'branches', ARRAY['*'], true),
('finance', 'categories', ARRAY['*'], true),
('finance', 'product_name', ARRAY['*'], true),
('finance', 'product_settings', ARRAY['*'], true),
('finance', 'recipes', ARRAY['*'], true),
('finance', 'supplier', ARRAY['*'], true),

-- Admin - akses ke semua halaman
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

-- Super Admin - akses ke semua halaman
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
('super admin', 'audit-log', ARRAY['*'], true)

ON CONFLICT (role, page) DO UPDATE SET 
  columns = ARRAY['*'], 
  can_access = true,
  updated_at = NOW();

-- Verify permissions
SELECT role, page, can_access 
FROM user_permissions 
WHERE can_access = true
ORDER BY role, page;