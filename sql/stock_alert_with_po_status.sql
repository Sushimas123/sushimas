-- Drop existing function first
DROP FUNCTION IF EXISTS get_stock_alerts_with_po_status();

-- Function to get stock alerts with PO status tracking (fixed data types)
CREATE FUNCTION get_stock_alerts_with_po_status()
RETURNS TABLE (
  id_product BIGINT,
  product_name TEXT,
  branch_code TEXT,
  branch_name TEXT,
  sub_category TEXT,
  current_stock BIGINT,
  safety_stock BIGINT,
  reorder_point BIGINT,
  shortage_qty BIGINT,
  urgency_level TEXT,
  po_status TEXT,
  po_number TEXT,
  po_created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  WITH stock_data AS (
    SELECT 
      np.id_product::BIGINT,
      np.product_name,
      b.kode_branch as branch_code,
      b.nama_branch as branch_name,
      b.id_branch,
      np.sub_category,
      (COALESCE(SUM(g.jumlah_masuk), 0) - COALESCE(SUM(g.jumlah_keluar), 0))::BIGINT as current_stock,
      pbs.safety_stock::BIGINT,
      pbs.reorder_point::BIGINT,
      GREATEST(pbs.reorder_point::BIGINT - (COALESCE(SUM(g.jumlah_masuk), 0) - COALESCE(SUM(g.jumlah_keluar), 0))::BIGINT, 0) as shortage_qty
    FROM nama_product np
    CROSS JOIN branches b
    LEFT JOIN gudang g ON g.id_product = np.id_product AND g.cabang = b.kode_branch
    LEFT JOIN product_branch_settings pbs ON pbs.id_product = np.id_product AND pbs.id_branch = b.id_branch
    WHERE pbs.safety_stock IS NOT NULL 
      AND pbs.reorder_point IS NOT NULL
      AND pbs.safety_stock::BIGINT > 0 
      AND pbs.reorder_point::BIGINT > 0
    GROUP BY np.id_product, np.product_name, b.kode_branch, b.nama_branch, b.id_branch, np.sub_category, pbs.safety_stock, pbs.reorder_point
    HAVING (COALESCE(SUM(g.jumlah_masuk), 0) - COALESCE(SUM(g.jumlah_keluar), 0)) <= pbs.safety_stock::BIGINT
  ),
  alerts_with_po AS (
    SELECT 
      sd.*,
      CASE 
        WHEN sd.current_stock <= sd.reorder_point THEN 'CRITICAL'
        WHEN sd.current_stock <= sd.safety_stock THEN 'URGENT'
        ELSE 'OK'
      END as urgency_level,
      po.status as po_status,
      po.po_number,
      po.created_at as po_created_at,
      ROW_NUMBER() OVER (PARTITION BY sd.id_product, sd.branch_code ORDER BY po.created_at DESC) as rn
    FROM stock_data sd
    LEFT JOIN (
      SELECT DISTINCT ON (poi.product_id, po.cabang_id) 
        poi.product_id,
        po.cabang_id,
        po.status,
        po.po_number,
        po.created_at
      FROM purchase_orders po
      JOIN po_items poi ON poi.po_id = po.id
      WHERE po.status IN ('Pending', 'Sedang diproses')
        AND po.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY poi.product_id, po.cabang_id, po.created_at DESC
    ) po ON po.product_id = sd.id_product AND po.cabang_id = sd.id_branch
  )
  SELECT 
    awp.id_product,
    awp.product_name,
    awp.branch_code,
    awp.branch_name,
    awp.sub_category,
    awp.current_stock,
    awp.safety_stock,
    awp.reorder_point,
    awp.shortage_qty,
    awp.urgency_level,
    COALESCE(awp.po_status, 'NONE') as po_status,
    awp.po_number,
    awp.po_created_at
  FROM alerts_with_po awp
  WHERE awp.rn = 1 OR awp.po_status IS NULL
  ORDER BY 
    CASE awp.urgency_level 
      WHEN 'CRITICAL' THEN 1 
      WHEN 'URGENT' THEN 2 
      ELSE 3 
    END,
    awp.shortage_qty DESC;
END;
$$ LANGUAGE plpgsql;

-- Test function to check if original function works
CREATE OR REPLACE FUNCTION test_original_stock_alerts()
RETURNS TABLE (
  id_product INTEGER,
  product_name TEXT,
  branch_code TEXT,
  branch_name TEXT,
  sub_category TEXT,
  current_stock INTEGER,
  safety_stock INTEGER,
  reorder_point INTEGER,
  shortage_qty INTEGER,
  urgency_level TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM get_products_needing_po();
END;
$$ LANGUAGE plpgsql;