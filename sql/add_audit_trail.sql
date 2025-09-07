-- Add audit trail columns to main tables
-- Run this script to add audit tracking to your database

-- Users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id_user),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id_user);

-- Ready table
ALTER TABLE ready 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id_user),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id_user);

-- Gudang table
ALTER TABLE gudang 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id_user),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id_user);

-- Produksi table
ALTER TABLE produksi 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id_user),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id_user);

-- Produksi Detail table
ALTER TABLE produksi_detail 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id_user),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id_user);

-- Categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id_user),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id_user);

-- Branches table
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id_user),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id_user);

-- Supplier table
ALTER TABLE supplier 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id_user),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id_user);

-- Recipes table
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id_user),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id_user);

-- Product Name table
ALTER TABLE nama_product 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id_user),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id_user);

-- Create audit log table for tracking all activities
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    user_id INTEGER REFERENCES users(id_user),
    user_name VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);