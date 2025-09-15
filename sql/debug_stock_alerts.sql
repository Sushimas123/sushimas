-- Debug queries to check stock alert data

-- 1. Check if product_branch_settings has data
SELECT 'product_branch_settings' as table_name, COUNT(*) as count FROM product_branch_settings;

-- 2. Check if there are products with low stock
SELECT 
  np.product_name,
  b.nama_branch,
  pbs.safety_stock,
  pbs.reorder_point,
  COALESCE(SUM(g.jumlah_masuk), 0) - COALESCE(SUM(g.jumlah_keluar), 0) as current_stock
FROM nama_product np
CROSS JOIN branches b
LEFT JOIN gudang g ON g.id_product = np.id_product AND g.cabang = b.kode_branch
LEFT JOIN product_branch_settings pbs ON pbs.id_product = np.id_product AND pbs.id_branch = b.id_branch
WHERE pbs.safety_stock IS NOT NULL 
  AND pbs.reorder_point IS NOT NULL
  AND pbs.safety_stock::INTEGER > 0 
  AND pbs.reorder_point::INTEGER > 0
GROUP BY np.id_product, np.product_name, b.kode_branch, b.nama_branch, pbs.safety_stock, pbs.reorder_point
HAVING (COALESCE(SUM(g.jumlah_masuk), 0) - COALESCE(SUM(g.jumlah_keluar), 0)) <= pbs.safety_stock::INTEGER
LIMIT 10;

-- 3. Test original function
SELECT 'get_products_needing_po' as function_name, COUNT(*) as count FROM get_products_needing_po();

-- 4. Check if branches table has data
SELECT 'branches' as table_name, COUNT(*) as count FROM branches;

-- 5. Check if nama_product table has data  
SELECT 'nama_product' as table_name, COUNT(*) as count FROM nama_product;