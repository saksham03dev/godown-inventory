-- Inventory Management System — Supabase Schema
-- Run this in the Supabase SQL Editor after creating your project.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Products ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  product_code  TEXT NOT NULL UNIQUE,
  barcode_id    TEXT NOT NULL UNIQUE,
  total_stock   INT  NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
  size          TEXT,
  special_note  TEXT,
  description   TEXT,
  category      TEXT,
  retail_selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (retail_selling_price >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode_id);
CREATE INDEX IF NOT EXISTS idx_products_product_code ON products (product_code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

-- ─── Godowns (Warehouses) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS godowns (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_name  TEXT NOT NULL UNIQUE,
  capacity       INT  NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  address        TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Inventory Logs (Transactional Ledger) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id       UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  godown_id        UUID NOT NULL REFERENCES godowns (id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('STOCK_IN', 'STOCK_OUT')),
  quantity         INT  NOT NULL CHECK (quantity > 0),
  handled_by       TEXT NOT NULL DEFAULT 'system',
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_product   ON inventory_logs (product_id);
CREATE INDEX IF NOT EXISTS idx_logs_godown    ON inventory_logs (godown_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON inventory_logs (timestamp DESC);

-- ─── Row Level Security (enable when auth is added) ──────────────────────────
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE godowns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs  ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development (replace with auth-scoped policies in prod)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Allow all on products') THEN
    CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'godowns' AND policyname = 'Allow all on godowns') THEN
    CREATE POLICY "Allow all on godowns" ON godowns FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_logs' AND policyname = 'Allow all on inventory_logs') THEN
    CREATE POLICY "Allow all on inventory_logs" ON inventory_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── Seed Data (optional) ─────────────────────────────────────────────────────
INSERT INTO godowns (location_name, capacity) VALUES
  ('Godown A', 5000),
  ('Godown B', 3000),
  ('Godown C', 2000)
ON CONFLICT (location_name) DO NOTHING;

INSERT INTO products (name, product_code, barcode_id, total_stock, size, special_note, description, category) VALUES
  ('Widget Pro',    'WDG-001', '8901234567890', 120, 'Large',  'Handle with care',       'Premium widget',        'Electronics'),
  ('Bolt Pack M8',  'BLT-M8',  '8901234567891',  85, 'M8',     NULL,                     'M8 stainless bolts',    'Hardware'),
  ('Cable HDMI 2m', 'CBL-HD2', '8901234567892',  45, '2 metre','Fragile packaging',      'High-speed HDMI cable', 'Electronics'),
  ('Paint White 5L','PNT-W5L', '8901234567893',  30, '5 Litre',NULL,                     'Interior emulsion',     'Supplies')
ON CONFLICT (barcode_id) DO NOTHING;
