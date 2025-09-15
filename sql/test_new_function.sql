-- Test the new function directly
SELECT 
  product_name,
  branch_name,
  urgency_level,
  po_status,
  po_number,
  current_stock,
  safety_stock,
  reorder_point
FROM get_stock_alerts_with_po_status()
ORDER BY urgency_level, shortage_qty DESC
LIMIT 10;