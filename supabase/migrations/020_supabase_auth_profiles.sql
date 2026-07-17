-- Migrate portal auth to Supabase Auth + profiles (no password hashes in app tables).
-- profiles.id = auth.users.id. Passwords live only in auth.users.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Clear legacy portal rows (system unused; passwords must not remain in app tables)
TRUNCATE TABLE portal_users;

ALTER TABLE portal_users DROP COLUMN IF EXISTS password_hash;

-- Drop unused portal_users — profiles is the sole staff directory
DROP TABLE IF EXISTS portal_users CASCADE;

-- Backfill username from email local-part where missing (existing auth profiles)
UPDATE profiles
SET username = lower(split_part(COALESCE(email, id::text), '@', 1))
WHERE username IS NULL OR username = '';

ALTER TABLE profiles
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON profiles (lower(username));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles (is_active);

-- Auth signup / Admin createUser → profile row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
  v_role user_role;
BEGIN
  v_username := lower(trim(COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(COALESCE(NEW.email, ''), '@', 1),
    NEW.id::text
  )));
  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    v_username
  );
  BEGIN
    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee');
  EXCEPTION WHEN OTHERS THEN
    v_role := 'employee';
  END;

  INSERT INTO public.profiles (id, email, username, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    v_username,
    v_full_name,
    v_role,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(NULLIF(EXCLUDED.username, ''), profiles.username),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    role = EXCLUDED.role,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: authenticated can read active profiles for display; writes via service role only
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE profiles FROM anon;
GRANT SELECT ON TABLE profiles TO authenticated;
GRANT ALL ON TABLE profiles TO service_role;

NOTIFY pgrst, 'reload schema';
