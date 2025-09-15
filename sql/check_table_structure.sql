-- Check table structures to get correct column names

-- 1. Check product_branch_settings table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'product_branch_settings' 
ORDER BY ordinal_position;

-- 2. Check branches table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'branches' 
ORDER BY ordinal_position;

-- 3. Sample data from product_branch_settings
SELECT * FROM product_branch_settings LIMIT 3;