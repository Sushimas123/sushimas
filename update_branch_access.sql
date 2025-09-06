-- Update user_branches table to ensure proper branch assignments
-- This script should be run after the main permissions table script

-- Create user_branches table if not exists
CREATE TABLE IF NOT EXISTS user_branches (
  id SERIAL PRIMARY KEY,
  id_user INTEGER NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
  kode_branch VARCHAR(10) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(id_user, kode_branch)
);

-- Sample branch assignments (adjust based on your actual users and branches)
-- Admin and Manager typically don't need specific branch assignments (they see all)
-- PIC Branch and Staff need specific branch assignments

-- Example: Assign PIC Branch users to specific branches
-- Replace with actual user IDs and branch codes from your database

-- INSERT INTO user_branches (id_user, kode_branch) VALUES
-- (3, 'BR001'), -- PIC Branch user assigned to Branch 001
-- (4, 'BR002'), -- PIC Branch user assigned to Branch 002
-- (5, 'BR001'), -- Staff user assigned to Branch 001
-- (6, 'BR002'); -- Staff user assigned to Branch 002

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_branches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_branches_updated_at 
    BEFORE UPDATE ON user_branches 
    FOR EACH ROW 
    EXECUTE FUNCTION update_user_branches_updated_at();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_branches_user_id ON user_branches(id_user);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch_code ON user_branches(kode_branch);
CREATE INDEX IF NOT EXISTS idx_user_branches_active ON user_branches(is_active);