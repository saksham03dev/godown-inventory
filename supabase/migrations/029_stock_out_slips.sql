-- Stock-out slips: session documents grouping stock-out scans

CREATE TABLE IF NOT EXISTS stock_out_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  biller_name TEXT,
  bill_no TEXT,
  sale_channel TEXT NOT NULL CHECK (sale_channel IN ('WHOLESALE', 'RETAIL')),
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_label TEXT,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_out_slips_confirmed_at
  ON stock_out_slips (confirmed_at DESC);

CREATE TABLE IF NOT EXISTS stock_out_slip_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id UUID NOT NULL REFERENCES stock_out_slips(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  bag_count INT NOT NULL CHECK (bag_count > 0),
  bale_count INT NOT NULL DEFAULT 1 CHECK (bale_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slip_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_out_slip_lines_slip
  ON stock_out_slip_lines (slip_id);

CREATE TABLE IF NOT EXISTS stock_out_slip_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id UUID NOT NULL REFERENCES stock_out_slips(id) ON DELETE CASCADE,
  stock_unit_id UUID NOT NULL REFERENCES stock_units(id),
  product_id UUID NOT NULL REFERENCES products(id),
  unit_number INT NOT NULL,
  bags_moved INT NOT NULL CHECK (bags_moved > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slip_id, stock_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_out_slip_units_slip
  ON stock_out_slip_units (slip_id);

ALTER TABLE inventory_logs
  ADD COLUMN IF NOT EXISTS stock_out_slip_id UUID REFERENCES stock_out_slips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_logs_slip
  ON inventory_logs (stock_out_slip_id)
  WHERE stock_out_slip_id IS NOT NULL;

-- RLS: select for authenticated; mutations via service role API
ALTER TABLE stock_out_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_out_slip_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_out_slip_units ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON TABLE stock_out_slips FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE stock_out_slip_lines FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE stock_out_slip_units FROM anon, authenticated;

GRANT SELECT ON TABLE stock_out_slips TO anon, authenticated;
GRANT SELECT ON TABLE stock_out_slip_lines TO anon, authenticated;
GRANT SELECT ON TABLE stock_out_slip_units TO anon, authenticated;
GRANT ALL ON TABLE stock_out_slips TO service_role;
GRANT ALL ON TABLE stock_out_slip_lines TO service_role;
GRANT ALL ON TABLE stock_out_slip_units TO service_role;

DROP POLICY IF EXISTS "stock_out_slips_select_all" ON stock_out_slips;
CREATE POLICY "stock_out_slips_select_all" ON stock_out_slips
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "stock_out_slip_lines_select_all" ON stock_out_slip_lines;
CREATE POLICY "stock_out_slip_lines_select_all" ON stock_out_slip_lines
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "stock_out_slip_units_select_all" ON stock_out_slip_units;
CREATE POLICY "stock_out_slip_units_select_all" ON stock_out_slip_units
  FOR SELECT TO anon, authenticated USING (true);
