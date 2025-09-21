-- Temporarily disable audit trigger for nama_product to fix the update issue
DROP TRIGGER IF EXISTS audit_trigger_nama_product ON nama_product;

-- Also drop the price history trigger temporarily if it's causing issues
DROP TRIGGER IF EXISTS trigger_price_history ON nama_product;

-- You can re-enable them later after fixing the trigger functions