-- Debug PO tracking for stock alerts

-- 1. Check PO items for the products that have alerts
SELECT 
  po.po_number,
  po.status,
  po.cabang_id,
  b.nama_branch,
  poi.product_id,
  np.product_name,
  poi.qty
FROM purchase_orders po
JOIN po_items poi ON poi.po_id = po.id
JOIN branches b ON b.id_branch = po.cabang_id
JOIN nama_product np ON np.id_product = poi.product_id
WHERE po.po_number LIKE 'PO-ALERT%'
ORDER BY po.created_at DESC;

-- 2. Check if the new function is working
SELECT 
  product_name,
  branch_name,
  urgency_level,
  po_status,
  po_number,
  current_stock,
  safety_stock
FROM get_stock_alerts_with_po_status()
LIMIT 5;

-- 3. Check specific products that should have PO tracking
SELECT 
  np.product_name,
  b.nama_branch,
  po.po_number,
  po.status,
  COALESCE(SUM(g.jumlah_masuk), 0) - COALESCE(SUM(g.jumlah_keluar), 0) as current_stock,
  pbs.safety_stock
FROM nama_product np
JOIN branches b ON b.nama_branch IN ('Sushimas Cibinong', 'Sushimas Depok')
LEFT JOIN gudang g ON g.id_product = np.id_product AND g.cabang = b.kode_branch
LEFT JOIN product_branch_settings pbs ON pbs.id_product = np.id_product AND pbs.id_branch = b.id_branch
LEFT JOIN po_items poi ON poi.product_id = np.id_product
LEFT JOIN purchase_orders po ON po.id = poi.po_id AND po.cabang_id = b.id_branch
WHERE np.product_name IN ('Air', 'Ayam')
  AND po.status = 'Sedang diproses'
GROUP BY np.id_product, np.product_name, b.id_branch, b.nama_branch, b.kode_branch, pbs.safety_stock, po.po_number, po.status;