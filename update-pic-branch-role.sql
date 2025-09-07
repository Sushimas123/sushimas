-- Update pic branch to pic_branch in both tables

-- Update crud_permissions table
UPDATE crud_permissions 
SET role = 'pic_branch' 
WHERE role = 'pic branch';

-- Update user_permissions table  
UPDATE user_permissions 
SET role = 'pic_branch' 
WHERE role = 'pic branch';

-- Also update any other tables that might have this role
UPDATE users 
SET role = 'pic_branch' 
WHERE role = 'pic branch';