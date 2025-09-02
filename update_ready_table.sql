-- Add id_branch column to ready table
ALTER TABLE ready ADD COLUMN IF NOT EXISTS id_branch INTEGER REFERENCES branches(id_branch);

-- Update existing records to have a default branch (first branch)
UPDATE ready 
SET id_branch = (SELECT id_branch FROM branches LIMIT 1) 
WHERE id_branch IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_ready_branch ON ready(id_branch);
CREATE INDEX IF NOT EXISTS idx_ready_date_branch ON ready(tanggal_input, id_branch);