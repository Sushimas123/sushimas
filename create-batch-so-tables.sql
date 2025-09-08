-- Create Stock Opname Batch Tables

-- 1. Batch Header Table
CREATE TABLE IF NOT EXISTS stock_opname_batch (
  batch_id SERIAL PRIMARY KEY,
  batch_date DATE NOT NULL,
  batch_time TIME DEFAULT '12:00:00',
  branch_code VARCHAR(10) NOT NULL,
  sub_category VARCHAR(100) NOT NULL,
  pic_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Batch Detail Table
CREATE TABLE IF NOT EXISTS stock_opname_detail (
  detail_id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES stock_opname_batch(batch_id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  system_stock DECIMAL(15,2) DEFAULT 0,
  physical_stock DECIMAL(15,2) DEFAULT 0,
  difference DECIMAL(15,2) GENERATED ALWAYS AS (physical_stock - system_stock) STORED,
  unit VARCHAR(20) DEFAULT 'pcs',
  notes TEXT
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_so_batch_date ON stock_opname_batch(batch_date);
CREATE INDEX IF NOT EXISTS idx_so_batch_branch ON stock_opname_batch(branch_code);
CREATE INDEX IF NOT EXISTS idx_so_batch_status ON stock_opname_batch(status);
CREATE INDEX IF NOT EXISTS idx_so_detail_batch ON stock_opname_detail(batch_id);
CREATE INDEX IF NOT EXISTS idx_so_detail_product ON stock_opname_detail(product_name);

-- 4. Create View for easier querying
CREATE OR REPLACE VIEW stock_opname_batch_summary AS
SELECT 
  b.batch_id,
  b.batch_date,
  b.batch_time,
  b.branch_code,
  br.nama_branch,
  b.sub_category,
  b.pic_name,
  b.status,
  b.created_at,
  COUNT(d.detail_id) as total_products,
  COUNT(CASE WHEN d.physical_stock > 0 THEN 1 END) as products_counted,
  SUM(CASE WHEN d.difference > 0 THEN d.difference ELSE 0 END) as total_surplus,
  SUM(CASE WHEN d.difference < 0 THEN ABS(d.difference) ELSE 0 END) as total_shortage,
  CASE 
    WHEN b.status = 'pending' THEN '⏳'
    WHEN b.status = 'approved' THEN '✅'
    WHEN b.status = 'rejected' THEN '❌'
    ELSE '❓'
  END as status_icon
FROM stock_opname_batch b
LEFT JOIN branches br ON b.branch_code = br.kode_branch
LEFT JOIN stock_opname_detail d ON b.batch_id = d.batch_id
GROUP BY b.batch_id, b.batch_date, b.batch_time, b.branch_code, br.nama_branch, 
         b.sub_category, b.pic_name, b.status, b.created_at
ORDER BY b.created_at DESC;

-- 5. Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_so_batch_updated_at 
    BEFORE UPDATE ON stock_opname_batch 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();