-- Batch unit barcodes + billing tables

CREATE TABLE IF NOT EXISTS stock_batches (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  batch_code   TEXT NOT NULL UNIQUE,
  source_name  TEXT NOT NULL,
  quantity     INT  NOT NULL CHECK (quantity > 0),
  notes        TEXT,
  created_by   TEXT NOT NULL DEFAULT 'system',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_product ON stock_batches (product_id);
CREATE INDEX IF NOT EXISTS idx_batches_created ON stock_batches (created_at DESC);

CREATE TABLE IF NOT EXISTS stock_units (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id        UUID NOT NULL REFERENCES stock_batches (id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  unit_barcode    TEXT NOT NULL UNIQUE,
  unit_number     INT  NOT NULL CHECK (unit_number > 0),
  status          TEXT NOT NULL DEFAULT 'LABELLED'
                    CHECK (status IN ('LABELLED', 'STOCKED_IN', 'STOCKED_OUT')),
  godown_id       UUID REFERENCES godowns (id) ON DELETE SET NULL,
  stocked_in_at   TIMESTAMPTZ,
  stocked_out_at  TIMESTAMPTZ,
  bill_id         UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_units_barcode ON stock_units (unit_barcode);
CREATE INDEX IF NOT EXISTS idx_units_status  ON stock_units (status);
CREATE INDEX IF NOT EXISTS idx_units_product ON stock_units (product_id);
CREATE INDEX IF NOT EXISTS idx_units_godown  ON stock_units (godown_id);

CREATE TABLE IF NOT EXISTS bills (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_number     TEXT NOT NULL UNIQUE,
  customer_name   TEXT NOT NULL DEFAULT 'Walk-in Customer',
  customer_phone  TEXT,
  customer_address TEXT,
  notes           TEXT,
  subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_percent     NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'FINALIZED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bills_status ON bills (status);
CREATE INDEX IF NOT EXISTS idx_bills_created ON bills (created_at DESC);

CREATE TABLE IF NOT EXISTS bill_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id       UUID NOT NULL REFERENCES bills (id) ON DELETE CASCADE,
  stock_unit_id UUID REFERENCES stock_units (id) ON DELETE SET NULL,
  product_id    UUID NOT NULL REFERENCES products (id),
  product_name  TEXT NOT NULL,
  product_code  TEXT NOT NULL,
  unit_barcode  TEXT NOT NULL,
  source_name   TEXT,
  quantity      INT  NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_total    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items (bill_id);

ALTER TABLE stock_units
  DROP CONSTRAINT IF EXISTS stock_units_bill_id_fkey;

ALTER TABLE stock_units
  ADD CONSTRAINT stock_units_bill_id_fkey
  FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE SET NULL;

ALTER TABLE stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_units   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_batches' AND policyname = 'Allow all on stock_batches') THEN
    CREATE POLICY "Allow all on stock_batches" ON stock_batches FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_units' AND policyname = 'Allow all on stock_units') THEN
    CREATE POLICY "Allow all on stock_units" ON stock_units FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bills' AND policyname = 'Allow all on bills') THEN
    CREATE POLICY "Allow all on bills" ON bills FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bill_items' AND policyname = 'Allow all on bill_items') THEN
    CREATE POLICY "Allow all on bill_items" ON bill_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
