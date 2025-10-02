-- Cek function handle_new_user yang bermasalah
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- Drop trigger yang bermasalah sementara
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop function yang bermasalah
DROP FUNCTION IF EXISTS handle_new_user();

-- Buat function baru yang lebih simple
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Hanya log, jangan insert ke tabel users
  -- Karena kita akan handle manual di aplikasi
  RAISE LOG 'New user created: %', NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Buat trigger baru (optional, bisa di-skip)
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user();