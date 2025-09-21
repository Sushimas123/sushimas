-- Check bulk payment and related POs
SELECT 
  bp.bulk_reference,
  bp.total_amount,
  bp.payment_date,
  COUNT(po.id) as po_count
FROM bulk_payments bp
LEFT JOIN purchase_orders po ON po.bulk_payment_ref = bp.bulk_reference
WHERE bp.bulk_reference = 'BULK-20250921-4233'
GROUP BY bp.id, bp.bulk_reference, bp.total_amount, bp.payment_date;

-- Check which POs have this bulk reference
SELECT 
  po_number,
  supplier_id,
  total_tagih,
  bulk_payment_ref
FROM purchase_orders 
WHERE bulk_payment_ref = 'BULK-20250921-4233';

-- If no POs found, check if bulk payment exists
SELECT * FROM bulk_payments WHERE bulk_reference = 'BULK-20250921-4233';