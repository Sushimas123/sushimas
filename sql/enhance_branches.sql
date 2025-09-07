-- Enhance branches table for future development
-- Run this to prepare branches for advanced features

-- Add missing columns for branch management
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS kode_pos VARCHAR(10),
ADD COLUMN IF NOT EXISTS tanggal_berdiri DATE,
ADD COLUMN IF NOT EXISTS parent_branch_id INTEGER REFERENCES branches(id_branch),
ADD COLUMN IF NOT EXISTS branch_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'IDR',
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS delivery_radius INTEGER DEFAULT 10, -- km
ADD COLUMN IF NOT EXISTS max_staff INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS monthly_target DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active', -- active, maintenance, closed
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create branch settings table
CREATE TABLE IF NOT EXISTS branch_settings (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id_branch) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    data_type VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, setting_key)
);

-- Create branch transfers table
CREATE TABLE IF NOT EXISTS branch_transfers (
    id SERIAL PRIMARY KEY,
    transfer_no VARCHAR(50) UNIQUE NOT NULL,
    from_branch_id INTEGER REFERENCES branches(id_branch),
    to_branch_id INTEGER REFERENCES branches(id_branch),
    product_id INTEGER,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2),
    total_value DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, shipped, received, cancelled
    request_date DATE DEFAULT CURRENT_DATE,
    approved_date DATE,
    shipped_date DATE,
    received_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id_user),
    approved_by INTEGER REFERENCES users(id_user),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create branch notifications table
CREATE TABLE IF NOT EXISTS branch_notifications (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id_branch),
    notification_type VARCHAR(50) NOT NULL, -- low_stock, maintenance, alert, info
    title VARCHAR(200) NOT NULL,
    message TEXT,
    priority VARCHAR(10) DEFAULT 'medium', -- low, medium, high, critical
    is_read BOOLEAN DEFAULT FALSE,
    read_by INTEGER REFERENCES users(id_user),
    read_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add branch_id to audit_log for branch-specific tracking
ALTER TABLE audit_log 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id_branch);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_branch_settings_branch_id ON branch_settings(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_transfers_from_branch ON branch_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_transfers_to_branch ON branch_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_transfers_status ON branch_transfers(status);
CREATE INDEX IF NOT EXISTS idx_branch_notifications_branch_id ON branch_notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_notifications_unread ON branch_notifications(branch_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_log_branch_id ON audit_log(branch_id);

-- Insert default branch settings
INSERT INTO branch_settings (branch_id, setting_key, setting_value, data_type)
SELECT 
    id_branch,
    'auto_reorder',
    'true',
    'boolean'
FROM branches 
WHERE NOT EXISTS (
    SELECT 1 FROM branch_settings 
    WHERE branch_id = branches.id_branch AND setting_key = 'auto_reorder'
);

INSERT INTO branch_settings (branch_id, setting_key, setting_value, data_type)
SELECT 
    id_branch,
    'low_stock_threshold',
    '10',
    'number'
FROM branches 
WHERE NOT EXISTS (
    SELECT 1 FROM branch_settings 
    WHERE branch_id = branches.id_branch AND setting_key = 'low_stock_threshold'
);