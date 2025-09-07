-- Add unique constraint to crud_permissions table
ALTER TABLE crud_permissions 
ADD CONSTRAINT crud_permissions_role_page_unique 
UNIQUE (role, page);