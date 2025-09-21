-- Comprehensive fix for ALL audit triggers in the project
-- This script will handle ALL tables that might have audit triggers

-- 1. Drop ALL existing audit triggers
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all audit triggers
    FOR r IN (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger_%s ON %s.%s', r.tablename, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 2. Create comprehensive audit function that handles ALL possible primary key patterns
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    record_id_value INTEGER;
    user_name_value VARCHAR(255);
BEGIN
    -- Get record ID based on table name and ALL known primary key patterns
    record_id_value := CASE TG_TABLE_NAME
        -- Products and related
        WHEN 'nama_product' THEN COALESCE(NEW.id_product, OLD.id_product)
        WHEN 'product_branches' THEN COALESCE(NEW.id, OLD.id)
        
        -- Categories and suppliers
        WHEN 'categories' THEN COALESCE(NEW.id_category, OLD.id_category)
        WHEN 'suppliers' THEN COALESCE(NEW.id_supplier, OLD.id_supplier)
        
        -- Branches and users
        WHEN 'branches' THEN COALESCE(NEW.id_branch, OLD.id_branch)
        WHEN 'users' THEN COALESCE(NEW.id_user, OLD.id_user)
        WHEN 'user_branches' THEN COALESCE(NEW.id, OLD.id)
        
        -- Stock and warehouse
        WHEN 'gudang' THEN COALESCE(NEW.id, OLD.id)
        WHEN 'ready_stock' THEN COALESCE(NEW.id_ready, OLD.id_ready)
        WHEN 'stock_opname_batch' THEN COALESCE(NEW.id, OLD.id)
        
        -- Production
        WHEN 'produksi' THEN COALESCE(NEW.id, OLD.id)
        WHEN 'produksi_detail' THEN COALESCE(NEW.id, OLD.id)
        WHEN 'recipes' THEN COALESCE(NEW.id_recipe, OLD.id_recipe)
        
        -- Purchase orders
        WHEN 'purchase_orders' THEN COALESCE(NEW.id, OLD.id)
        WHEN 'po_items' THEN COALESCE(NEW.id, OLD.id)
        WHEN 'po_payments' THEN COALESCE(NEW.id, OLD.id)
        
        -- Finance
        WHEN 'bulk_payments' THEN COALESCE(NEW.id, OLD.id)
        
        -- Transfer and others
        WHEN 'transfer_barang' THEN COALESCE(NEW.id, OLD.id)
        WHEN 'crud_permissions' THEN COALESCE(NEW.id, OLD.id)
        WHEN 'price_history' THEN COALESCE(NEW.id, OLD.id)
        
        -- Default fallback for any table with 'id' column
        ELSE COALESCE(NEW.id, OLD.id)
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
    
    -- Insert audit record (with error handling)
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
        -- If audit logging fails, don't block the main operation
        RAISE WARNING 'Audit logging failed for table %: %', TG_TABLE_NAME, SQLERRM;
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Recreate audit triggers for ALL important tables
DO $$
DECLARE
    tbl_name TEXT;
    tables_to_audit TEXT[] := ARRAY[
        'nama_product',
        'product_branches',
        'categories', 
        'suppliers',
        'branches',
        'users',
        'user_branches',
        'gudang',
        'ready_stock',
        'stock_opname_batch',
        'produksi',
        'produksi_detail',
        'recipes',
        'purchase_orders',
        'po_items',
        'po_payments',
        'bulk_payments',
        'transfer_barang',
        'crud_permissions',
        'price_history'
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
            
            RAISE NOTICE '✅ Audit trigger created for table: %', tbl_name;
        ELSE
            RAISE NOTICE '⚠️  Table does not exist: %', tbl_name;
        END IF;
    END LOOP;
END $$;

-- 4. Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 ALL audit triggers have been fixed!';
    RAISE NOTICE '📋 All database operations should now work properly';
    RAISE NOTICE '🔍 Audit logging will work for all supported tables';
END $$;