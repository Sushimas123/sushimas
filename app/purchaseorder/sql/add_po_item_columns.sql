-- Add columns to po_items table to track actual received prices and quantities
ALTER TABLE po_items 
ADD COLUMN IF NOT EXISTS actual_price DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS received_qty DECIMAL(10,2);

-- Add column to barang_masuk to store original PO price
ALTER TABLE barang_masuk 
ADD COLUMN IF NOT EXISTS harga_po DECIMAL(15,2);

-- Add comment for clarity
COMMENT ON COLUMN po_items.actual_price IS 'Actual price received when goods arrive (may differ from original PO price)';
COMMENT ON COLUMN po_items.received_qty IS 'Actual quantity received';
COMMENT ON COLUMN barang_masuk.harga_po IS 'Original PO price for comparison';