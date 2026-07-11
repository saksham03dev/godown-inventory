-- Lock down: anon/authenticated may only SELECT.
-- All mutations go through Next.js API routes using SUPABASE_SERVICE_ROLE_KEY.

-- ---------------------------------------------------------------------------
-- portal_users: no public writes; login list uses service-role API
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE portal_users FROM anon, authenticated;
GRANT ALL ON TABLE portal_users TO service_role;

DROP POLICY IF EXISTS "Public can list active portal users" ON portal_users;
DROP POLICY IF EXISTS "Allow portal user inserts" ON portal_users;
DROP POLICY IF EXISTS "Allow portal user updates" ON portal_users;
DROP POLICY IF EXISTS "Allow portal user deletes" ON portal_users;

-- Optional: allow nothing for anon (service_role bypasses RLS)
-- Keep RLS enabled with no anon policies = deny all for anon

-- ---------------------------------------------------------------------------
-- Helper: replace open FOR ALL policies with SELECT-only
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products',
    'godowns',
    'inventory_logs',
    'stock_batches',
    'stock_units',
    'bills',
    'bill_items'
  ]
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE %I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE %I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE %I TO service_role', t);
  END LOOP;
END $$;

-- products
DROP POLICY IF EXISTS "Allow all on products" ON products;
DROP POLICY IF EXISTS "products_select_all" ON products;
CREATE POLICY "products_select_all" ON products
  FOR SELECT TO anon, authenticated USING (true);

-- godowns
DROP POLICY IF EXISTS "Allow all on godowns" ON godowns;
DROP POLICY IF EXISTS "godowns_select_all" ON godowns;
CREATE POLICY "godowns_select_all" ON godowns
  FOR SELECT TO anon, authenticated USING (true);

-- inventory_logs (already select-only in 008; reinforce)
DROP POLICY IF EXISTS "Allow all on inventory_logs" ON inventory_logs;
DROP POLICY IF EXISTS "Allow all inventory_logs" ON inventory_logs;
DROP POLICY IF EXISTS "inventory_logs_select_all" ON inventory_logs;
CREATE POLICY "inventory_logs_select_all" ON inventory_logs
  FOR SELECT TO anon, authenticated USING (true);

-- stock_batches
DROP POLICY IF EXISTS "Allow all on stock_batches" ON stock_batches;
DROP POLICY IF EXISTS "stock_batches_select_all" ON stock_batches;
CREATE POLICY "stock_batches_select_all" ON stock_batches
  FOR SELECT TO anon, authenticated USING (true);

-- stock_units (lifecycle trigger still blocks anon status/godown/bill edits)
DROP POLICY IF EXISTS "Allow all on stock_units" ON stock_units;
DROP POLICY IF EXISTS "stock_units_select_all" ON stock_units;
CREATE POLICY "stock_units_select_all" ON stock_units
  FOR SELECT TO anon, authenticated USING (true);

-- bills
DROP POLICY IF EXISTS "Allow all on bills" ON bills;
DROP POLICY IF EXISTS "bills_select_all" ON bills;
CREATE POLICY "bills_select_all" ON bills
  FOR SELECT TO anon, authenticated USING (true);

-- bill_items
DROP POLICY IF EXISTS "Allow all on bill_items" ON bill_items;
DROP POLICY IF EXISTS "bill_items_select_all" ON bill_items;
CREATE POLICY "bill_items_select_all" ON bill_items
  FOR SELECT TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';
