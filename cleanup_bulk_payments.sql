-- Cleanup duplicate bulk payments and reset PO references

-- 1. Reset bulk_payment_ref in purchase_orders
UPDATE purchase_orders 
SET bulk_payment_ref = NULL 
WHERE bulk_payment_ref IN ('BULK-20250921-115', 'BULK-20250921-009');

-- 2. Delete duplicate bulk payments
DELETE FROM bulk_payments 
WHERE bulk_reference IN ('BULK-20250921-115', 'BULK-20250921-009');

-- 3. Check if any POs still have bulk references
SELECT po_number, bulk_payment_ref 
FROM purchase_orders 
WHERE bulk_payment_ref IS NOT NULL;