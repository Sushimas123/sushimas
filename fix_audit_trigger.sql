-- Fix the audit trigger for nama_product table
-- This will replace the problematic trigger with the correct one

-- Drop the existing trigger
DROP TRIGGER IF EXISTS audit_trigger_nama_product ON nama_product;

-- Recreate the correct audit trigger function (matching your audit_log table structure)
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    record_id_value INTEGER;
    user_name_value VARCHAR(255);
BEGIN
    -- Get record ID from various possible primary key columns
    record_id_value := COALESCE(
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.id_user, OLD.id_user),
        COALESCE(NEW.id_branch, OLD.id_branch),
        COALESCE(NEW.id_product, OLD.id_product),
        COALESCE(NEW.id_ready, OLD.id_ready),
        COALESCE(NEW.order_no, OLD.order_no),
        COALESCE(NEW.ready_no, OLD.ready_no),
        COALESCE(NEW.id_supplier, OLD.id_supplier),
        COALESCE(NEW.id_category, OLD.id_category)
    );
    
    -- Get user name if user_id is available
    IF NEW.updated_by IS NOT NULL THEN
        SELECT nama_lengkap INTO user_name_value 
        FROM users WHERE id_user = NEW.updated_by;
    ELSIF NEW.created_by IS NOT NULL THEN
        SELECT nama_lengkap INTO user_name_value 
        FROM users WHERE id_user = NEW.created_by;
    END IF;
    
    -- Insert audit record
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, user_id, user_name, old_values)
        VALUES (TG_TABLE_NAME, record_id_value, 'DELETE', OLD.updated_by, user_name_value, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, user_id, user_name, old_values, new_values)
        VALUES (TG_TABLE_NAME, record_id_value, 'UPDATE', NEW.updated_by, user_name_value, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, user_id, user_name, new_values)
        VALUES (TG_TABLE_NAME, record_id_value, 'INSERT', NEW.created_by, user_name_value, row_to_json(NEW));
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger for nama_product
CREATE TRIGGER audit_trigger_nama_product
AFTER INSERT OR UPDATE OR DELETE ON nama_product
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();