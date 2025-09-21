-- Bulk Payment Tracking System SQL Script

-- 1. Create bulk_payments table
CREATE TABLE bulk_payments (
  id SERIAL PRIMARY KEY,
  bulk_reference TEXT UNIQUE NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_via TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'reconciled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create bulk_payment_po junction table
CREATE TABLE bulk_payment_po (
  id SERIAL PRIMARY KEY,
  bulk_payment_id INTEGER REFERENCES bulk_payments(id) ON DELETE CASCADE,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(bulk_payment_id, po_id)
);

-- 3. Add bulk_payment_ref column to purchase_orders
ALTER TABLE purchase_orders 
ADD COLUMN bulk_payment_ref TEXT REFERENCES bulk_payments(bulk_reference);

-- 4. Create indexes for performance
CREATE INDEX idx_bulk_payment_ref ON purchase_orders(bulk_payment_ref);
CREATE INDEX idx_bulk_payment_date ON bulk_payments(payment_date);
CREATE INDEX idx_bulk_payment_status ON bulk_payments(status);
CREATE INDEX idx_bulk_payment_po_bulk_id ON bulk_payment_po(bulk_payment_id);
CREATE INDEX idx_bulk_payment_po_po_id ON bulk_payment_po(po_id);

-- 5. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create trigger for bulk_payments
CREATE TRIGGER update_bulk_payments_updated_at 
    BEFORE UPDATE ON bulk_payments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Create view for easy querying
CREATE VIEW bulk_payment_summary AS
SELECT 
    bp.id,
    bp.bulk_reference,
    bp.total_amount,
    bp.payment_date,
    bp.payment_via,
    bp.payment_method,
    bp.status,
    bp.notes,
    COUNT(bpp.po_id) as po_count,
    SUM(bpp.amount) as total_po_amount,
    bp.created_at
FROM bulk_payments bp
LEFT JOIN bulk_payment_po bpp ON bp.id = bpp.bulk_payment_id
GROUP BY bp.id, bp.bulk_reference, bp.total_amount, bp.payment_date, 
         bp.payment_via, bp.payment_method, bp.status, bp.notes, bp.created_at
ORDER BY bp.payment_date DESC;

-- 8. Sample data (optional - remove if not needed)
-- INSERT INTO bulk_payments (bulk_reference, total_amount, payment_date, payment_via, payment_method, notes)
-- VALUES 
-- ('BULK-2024-001', 15000000.00, '2024-01-15', 'BCA', 'Transfer', 'Pembayaran bulk supplier A'),
-- ('BULK-2024-002', 8500000.00, '2024-01-16', 'Mandiri', 'Transfer', 'Pembayaran bulk supplier B');

-- 9. Function to validate bulk payment total
CREATE OR REPLACE FUNCTION validate_bulk_payment_total(bulk_payment_id_param INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    bulk_total NUMERIC;
    po_total NUMERIC;
BEGIN
    -- Get bulk payment total
    SELECT total_amount INTO bulk_total 
    FROM bulk_payments 
    WHERE id = bulk_payment_id_param;
    
    -- Get sum of PO amounts
    SELECT COALESCE(SUM(amount), 0) INTO po_total
    FROM bulk_payment_po 
    WHERE bulk_payment_id = bulk_payment_id_param;
    
    -- Return true if totals match (with small tolerance for floating point)
    RETURN ABS(bulk_total - po_total) < 0.01;
END;
$$ LANGUAGE plpgsql;

-- 10. Comments for documentation
COMMENT ON TABLE bulk_payments IS 'Stores bulk payment transactions that cover multiple POs';
COMMENT ON TABLE bulk_payment_po IS 'Junction table linking bulk payments to individual POs';
COMMENT ON COLUMN purchase_orders.bulk_payment_ref IS 'Reference to bulk payment if PO was paid via bulk transaction';
COMMENT ON VIEW bulk_payment_summary IS 'Summary view of bulk payments with PO counts and totals';