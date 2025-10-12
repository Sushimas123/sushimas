-- Refresh all POs to use current supplier payment terms
UPDATE purchase_orders 
SET id_payment_term = (
  SELECT s.id_payment_term 
  FROM suppliers s 
  WHERE s.id_supplier = purchase_orders.supplier_id
)
WHERE EXISTS (
  SELECT 1 FROM suppliers s 
  WHERE s.id_supplier = purchase_orders.supplier_id 
  AND s.id_payment_term IS NOT NULL
);

-- For POs where supplier doesn't have payment term, keep the mapped termin_days
UPDATE purchase_orders 
SET id_payment_term = (
  CASE 
    WHEN termin_days = 0 THEN 1  -- COD
    WHEN termin_days = 7 THEN 2  -- NET 7
    WHEN termin_days = 14 THEN 18 -- NET 14
    WHEN termin_days = 30 THEN 10 -- NET 30
    ELSE 1 -- Default to COD
  END
)
WHERE id_payment_term IS NULL AND termin_days IS NOT NULL;