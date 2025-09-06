-- Create permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(50) NOT NULL,
  page VARCHAR(100) NOT NULL,
  columns TEXT[] DEFAULT '{}',
  can_access BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role, page)
);

-- Insert default permissions
INSERT INTO user_permissions (role, page, columns, can_access) VALUES
-- Admin - full access to everything
('admin', 'esb', ARRAY['*'], true),
('admin', 'ready', ARRAY['*'], true),
('admin', 'users', ARRAY['*'], true),
('admin', 'produksi', ARRAY['*'], true),
('admin', 'analysis', ARRAY['*'], true),
('admin', 'branches', ARRAY['*'], true),
('admin', 'categories', ARRAY['*'], true),
('admin', 'gudang', ARRAY['*'], true),
('admin', 'product_name', ARRAY['*'], true),
('admin', 'product_settings', ARRAY['*'], true),
('admin', 'produksi_detail', ARRAY['*'], true),
('admin', 'recipes', ARRAY['*'], true),
('admin', 'stock_opname', ARRAY['*'], true),
('admin', 'supplier', ARRAY['*'], true),
('admin', 'permissions', ARRAY['*'], true),

-- Manager - almost full access
('manager', 'esb', ARRAY['*'], true),
('manager', 'ready', ARRAY['*'], true),
('manager', 'users', ARRAY['email', 'nama_lengkap', 'no_telp', 'role', 'cabang'], true),
('manager', 'produksi', ARRAY['*'], true),
('manager', 'analysis', ARRAY['*'], true),
('manager', 'branches', ARRAY['*'], true),
('manager', 'categories', ARRAY['*'], true),
('manager', 'gudang', ARRAY['*'], true),
('manager', 'product_name', ARRAY['*'], true),
('manager', 'product_settings', ARRAY['*'], true),
('manager', 'produksi_detail', ARRAY['*'], true),
('manager', 'recipes', ARRAY['*'], true),
('manager', 'stock_opname', ARRAY['*'], true),
('manager', 'supplier', ARRAY['*'], true),

-- PIC Branch - limited access
('pic_branch', 'esb', ARRAY['sales_date', 'branch', 'product', 'sub_category', 'quantity'], true),
('pic_branch', 'ready', ARRAY['ready_no', 'tanggal_input', 'branch', 'category', 'product_name', 'quantity'], true),
('pic_branch', 'produksi', ARRAY['product_name', 'quantity', 'status', 'branch'], true),
('pic_branch', 'gudang', ARRAY['product_name', 'quantity', 'location', 'branch'], true),
('pic_branch', 'product_name', ARRAY['product_name', 'category', 'unit'], true),
('pic_branch', 'recipes', ARRAY['recipe_name', 'ingredients', 'quantity'], true),
('pic_branch', 'stock_opname', ARRAY['product_name', 'system_qty', 'actual_qty', 'difference', 'branch'], true),

-- Staff - very limited access
('staff', 'esb', ARRAY['sales_date', 'branch', 'product'], true),
('staff', 'ready', ARRAY['product_name', 'quantity'], true)

ON CONFLICT (role, page) DO NOTHING;

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at 
    BEFORE UPDATE ON user_permissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();