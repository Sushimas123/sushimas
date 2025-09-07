-- Add updated_at column to ready table
ALTER TABLE ready ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add is_active column to ready table
ALTER TABLE ready ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create trigger function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_ready_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ready table
DROP TRIGGER IF EXISTS trigger_update_ready_updated_at ON ready;
CREATE TRIGGER trigger_update_ready_updated_at
    BEFORE UPDATE ON ready
    FOR EACH ROW
    EXECUTE FUNCTION update_ready_updated_at();

-- Update existing records to have updated_at and is_active values
UPDATE ready SET updated_at = NOW(), is_active = TRUE WHERE updated_at IS NULL OR is_active IS NULL;