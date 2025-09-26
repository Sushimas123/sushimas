-- Add notes column to ready table
ALTER TABLE ready ADD COLUMN notes TEXT;

-- Add comment to the column
COMMENT ON COLUMN ready.notes IS 'Catatan atau keterangan tambahan untuk ready stock';