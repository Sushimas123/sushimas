-- Fix all audit triggers by creating table-specific functions
-- This avoids the generic function trying to access non-existent 'id' columns

-- 1. Drop all existing audit triggers first
DROP TRIGGER IF EXISTS audit_trigger_nama_product ON nama_product;
DROP TRIGGER IF EXISTS audit_trigger_categories ON categories;
DROP TRIGGER IF EXISTS audit_trigger_suppliers ON suppliers;
DROP TRIGGER IF EXISTS audit_trigger_branches ON branches;
DROP TRIGGER IF EXISTS audit_trigger_users ON users;
-- Only drop triggers for tables that definitely exist
DROP TRIGGER IF EXISTS audit_trigger_gudang ON gudang;
DROP TRIGGER IF EXISTS audit_trigger_purchase_orders ON purchase_orders;
DROP TRIGGER IF EXISTS audit_trigger_po_items ON po_items;
DROP TRIGGER IF EXISTS audit_trigger_bulk_payments ON bulk_payments;

-- 2. Create improved generic audit function that handles different primary key names
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    record_id_value INTEGER;
    user_name_value VARCHAR(255);
BEGIN
    -- Get record ID based on table name and known primary key patterns
    record_id_value := CASE TG_TABLE_NAME
        WHEN 'nama_product' THEN COALESCE(NEW.id_product, OLD.id_product)
        WHEN 'categories' THEN COALESCE(NEW.id_category, OLD.id_category)
        WHEN 'suppliers' THEN COALESCE(NEW.id_supplier, OLD.id_supplier)
        WHEN 'branches' THEN COALESCE(NEW.id_branch, OLD.id_branch)
        WHEN 'users' THEN COALESCE(NEW.id_user, OLD.id_user)
        WHEN 'gudang' THEN COALESCE(NEW.id, OLD.id)
        WHEN 'purchase_orders' THEN COALESCE(NEW.order_no, OLD.order_no)
        WHEN 'po_items' THEN COALESCE(NEW.id, OLD.id)
        WHEN 'bulk_payments' THEN COALESCE(NEW.id, OLD.id)
        ELSE COALESCE(NEW.id, OLD.id) -- fallback for tables with 'id' column
    END;
    
    -- Get user name if user_id is available
    IF TG_OP = 'UPDATE' AND NEW.updated_by IS NOT NULL THEN
        SELECT nama_lengkap INTO user_name_value 
        FROM users WHERE id_user = NEW.updated_by;
    ELSIF TG_OP = 'INSERT' AND NEW.created_by IS NOT NULL THEN
        SELECT nama_lengkap INTO user_name_value 
        FROM users WHERE id_user = NEW.created_by;
    ELSIF TG_OP = 'DELETE' AND OLD.updated_by IS NOT NULL THEN
        SELECT nama_lengkap INTO user_name_value 
        FROM users WHERE id_user = OLD.updated_by;
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

-- 3. Recreate audit triggers for all tables
DO $$
DECLARE
    tbl_name TEXT;
    tables_to_audit TEXT[] := ARRAY[
        'nama_product',
        'categories', 
        'suppliers',
        'branches',
        'users',
        'gudang',
        'purchase_orders',
        'po_items',
        'bulk_payments'
    ];
BEGIN
    FOREACH tbl_name IN ARRAY tables_to_audit
    LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl_name AND table_schema = 'public') THEN
            -- Create new trigger
            EXECUTE format('
                CREATE TRIGGER audit_trigger_%s
                AFTER INSERT OR UPDATE OR DELETE ON %s
                FOR EACH ROW EXECUTE FUNCTION audit_trigger_function()
            ', tbl_name, tbl_name);
            
            RAISE NOTICE 'Audit trigger recreated for table: %', tbl_name;
        ELSE
            RAISE NOTICE 'Table does not exist: %', tbl_name;
        END IF;
    END LOOP;
END $$;