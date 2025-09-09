-- Add lock columns to gudang table
ALTER TABLE gudang 
ADD COLUMN is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN locked_by_so VARCHAR(50),
ADD COLUMN locked_date TIMESTAMP;

-- Create index for better performance
CREATE INDEX idx_gudang_is_locked ON gudang(is_locked);
CREATE INDEX idx_gudang_locked_by_so ON gudang(locked_by_so);