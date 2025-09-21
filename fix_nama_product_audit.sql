-- Fix audit trigger specifically for nama_product table
-- Drop existing triggers
DROP TRIGGER IF EXISTS audit_trigger_nama_product ON nama_product;
DROP TRIGGER IF EXISTS trigger_price_history ON nama_product;

-- Create specific audit function for nama_product
CREATE OR REPLACE FUNCTION audit_nama_product_function()
RETURNS TRIGGER AS $$
DECLARE
    user_name_value VARCHAR(255);
BEGIN
    -- Get user name if user_id is available
    IF TG_OP = 'UPDATE' AND NEW.updated_by IS NOT NULL THEN
        SELECT nama_lengkap INTO user_name_value 
        FROM users WHERE id_user = NEW.updated_by;
    ELSIF TG_OP = 'INSERT' AND NEW.created_by IS NOT NULL THEN
        SELECT nama_lengkap INTO user_name_value 
        FROM users WHERE id_user = NEW.created_by;
    END IF;
    
    -- Insert audit record
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, user_id, user_name, old_values)
        VALUES ('nama_product', OLD.id_product, 'DELETE', OLD.updated_by, user_name_value, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, user_id, user_name, old_values, new_values)
        VALUES ('nama_product', NEW.id_product, 'UPDATE', NEW.updated_by, user_name_value, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, user_id, user_name, new_values)
        VALUES ('nama_product', NEW.id_product, 'INSERT', NEW.created_by, user_name_value, row_to_json(NEW));
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create specific price history function for nama_product
CREATE OR REPLACE FUNCTION record_nama_product_price_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if price actually changed
    IF OLD.harga IS DISTINCT FROM NEW.harga THEN
        INSERT INTO price_history (
            product_id, 
            old_price, 
            new_price, 
            changed_by, 
            changed_at,
            notes
        ) VALUES (
            NEW.id_product,
            OLD.harga,
            NEW.harga,
            NEW.updated_by,
            NOW(),
            'Price updated from product management'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers with specific functions
CREATE TRIGGER audit_trigger_nama_product
AFTER INSERT OR UPDATE OR DELETE ON nama_product
FOR EACH ROW EXECUTE FUNCTION audit_nama_product_function();

CREATE TRIGGER trigger_price_history_nama_product
AFTER UPDATE ON nama_product
FOR EACH ROW EXECUTE FUNCTION record_nama_product_price_change();