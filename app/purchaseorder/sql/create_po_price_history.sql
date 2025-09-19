-- Create table to track price changes at PO level (separate from master price history)
CREATE TABLE IF NOT EXISTS po_price_history (
  id BIGSERIAL PRIMARY KEY,
  po_id BIGINT NOT NULL REFERENCES purchase_orders(id),
  po_number TEXT NOT NULL,
  product_id BIGINT NOT NULL REFERENCES nama_product(id_product),
  po_price DECIMAL(15,2) NOT NULL,
  actual_price DECIMAL(15,2) NOT NULL,
  price_difference DECIMAL(15,2) NOT NULL,
  percentage_difference DECIMAL(5,2) NOT NULL,
  master_price_at_time DECIMAL(15,2) NOT NULL,
  received_date DATE NOT NULL,
  invoice_number TEXT,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_po_price_history_po_id ON po_price_history(po_id);
CREATE INDEX IF NOT EXISTS idx_po_price_history_product_id ON po_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_po_price_history_received_date ON po_price_history(received_date);

-- Add comments
COMMENT ON TABLE po_price_history IS 'Track price differences between PO price and actual received price';
COMMENT ON COLUMN po_price_history.po_price IS 'Original price in PO';
COMMENT ON COLUMN po_price_history.actual_price IS 'Actual price when goods received';
COMMENT ON COLUMN po_price_history.master_price_at_time IS 'Master price at time of receiving goods';