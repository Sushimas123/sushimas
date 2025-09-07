-- Add missing updated_at column to gudang table
ALTER TABLE gudang ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have updated_at value
UPDATE gudang SET updated_at = NOW() WHERE updated_at IS NULL;

-- Add trigger to automatically update updated_at on record changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_gudang_updated_at ON gudang;
CREATE TRIGGER update_gudang_updated_at
    BEFORE UPDATE ON gudang
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();