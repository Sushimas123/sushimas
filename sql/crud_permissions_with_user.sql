-- Add user_id column to existing crud_permissions table
ALTER TABLE crud_permissions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id_user);

-- Update unique constraint to include user_id
ALTER TABLE crud_permissions DROP CONSTRAINT IF EXISTS crud_permissions_role_page_key;
ALTER TABLE crud_permissions ADD CONSTRAINT crud_permissions_user_role_page_key UNIQUE(user_id, role, page);

-- Create index for user-specific permissions
CREATE INDEX IF NOT EXISTS idx_crud_permissions_user ON crud_permissions(user_id, role, page);