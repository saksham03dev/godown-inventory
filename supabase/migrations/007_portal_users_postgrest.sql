-- Ensure portal_users is reachable via PostgREST (Supabase JS) on Netlify.
-- Grants allow the anon/authenticated roles used by the publishable key.

GRANT SELECT, INSERT, UPDATE, DELETE ON portal_users TO anon, authenticated, service_role;

ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

-- Login page needs to list active users (safe columns only selected in app code).
DROP POLICY IF EXISTS "Public can list active portal users" ON portal_users;
CREATE POLICY "Public can list active portal users"
  ON portal_users FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Server API routes using the publishable key also need write access for admin user mgmt.
-- Prefer SUPABASE_SERVICE_ROLE_KEY in production; these policies keep publishable-key deploys working.
DROP POLICY IF EXISTS "Allow portal user inserts" ON portal_users;
CREATE POLICY "Allow portal user inserts"
  ON portal_users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal user updates" ON portal_users;
CREATE POLICY "Allow portal user updates"
  ON portal_users FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal user deletes" ON portal_users;
CREATE POLICY "Allow portal user deletes"
  ON portal_users FOR DELETE
  TO anon, authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
