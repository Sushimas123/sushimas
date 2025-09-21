-- Complete Audit System Setup
-- Run this to ensure all audit infrastructure is in place

-- 1. Create audit_log table if not exists
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT')),
    user_id INTEGER,
    user_name VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- 3. Generic audit trigger function
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

-- 4. Add audit triggers to important tables
DO $$
DECLARE
    tbl_name TEXT;
    tables_to_audit TEXT[] := ARRAY[
        'nama_product',
        'categories', 
        'recipes',
        'suppliers',
        'branches',
        'users',
        'ready_stock',
        'gudang',
        'produksi',
        'produksi_detail',
        'stock_opname_batch',
        'purchase_orders',
        'po_items',
        'bulk_payments',
        'po_payments',
        'transfer_barang',
        'crud_permissions'
    ];
BEGIN
    FOREACH tbl_name IN ARRAY tables_to_audit
    LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl_name AND table_schema = 'public') THEN
            -- Drop existing trigger if exists
            EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger_%s ON %s', tbl_name, tbl_name);
            
            -- Create new trigger
            EXECUTE format('
                CREATE TRIGGER audit_trigger_%s
                AFTER INSERT OR UPDATE OR DELETE ON %s
                FOR EACH ROW EXECUTE FUNCTION audit_trigger_function()
            ', tbl_name, tbl_name);
            
            RAISE NOTICE 'Audit trigger added to table: %', tbl_name;
        ELSE
            RAISE NOTICE 'Table does not exist: %', tbl_name;
        END IF;
    END LOOP;
END $$;

-- 5. Create view for better audit log display
CREATE OR REPLACE VIEW audit_log_view AS
SELECT 
    al.*,
    u.nama_lengkap as user_full_name,
    u.email as user_email,
    CASE 
        WHEN al.action = 'INSERT' THEN '➕ Created'
        WHEN al.action = 'UPDATE' THEN '✏️ Updated' 
        WHEN al.action = 'DELETE' THEN '🗑️ Deleted'
        WHEN al.action = 'EXPORT' THEN '📤 Exported'
        WHEN al.action = 'IMPORT' THEN '📥 Imported'
        ELSE al.action
    END as action_display,
    CASE 
        WHEN al.table_name = 'nama_product' THEN '📦 Products'
        WHEN al.table_name = 'purchase_orders' THEN '🛒 Purchase Orders'
        WHEN al.table_name = 'users' THEN '👥 Users'
        WHEN al.table_name = 'suppliers' THEN '🏢 Suppliers'
        WHEN al.table_name = 'categories' THEN '📂 Categories'
        WHEN al.table_name = 'branches' THEN '🏪 Branches'
        WHEN al.table_name = 'bulk_payments' THEN '💰 Bulk Payments'
        ELSE INITCAP(REPLACE(al.table_name, '_', ' '))
    END as table_display
FROM audit_log al
LEFT JOIN users u ON al.user_id = u.id_user
ORDER BY al.created_at DESC;

-- 6. Function to clean old audit logs (optional)
CREATE OR REPLACE FUNCTION clean_old_audit_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Grant permissions
GRANT SELECT, INSERT ON audit_log TO PUBLIC;
GRANT SELECT ON audit_log_view TO PUBLIC;

COMMENT ON TABLE audit_log IS 'Audit trail for tracking all database changes';
COMMENT ON FUNCTION audit_trigger_function() IS 'Generic trigger function for audit logging';
COMMENT ON FUNCTION clean_old_audit_logs(INTEGER) IS 'Function to clean audit logs older than specified days';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Complete audit system setup finished!';
    RAISE NOTICE '📊 Audit triggers added to all important tables';
    RAISE NOTICE '🔍 Use audit_log_view for better display';
    RAISE NOTICE '🧹 Use clean_old_audit_logs(90) to clean old logs';
END $$;