-- Fix: product_code column + schema cache reload
-- Run this entire script in Supabase → SQL Editor → Run

-- 1. Add missing columns (safe if already exists)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_code TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS special_note TEXT;

ALTER TABLE godowns
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Backfill product_code from barcode_id for existing rows
UPDATE products
SET product_code = UPPER(REPLACE(COALESCE(barcode_id, id::text), '-', ''))
WHERE product_code IS NULL OR product_code = '';

-- 3. Enforce NOT NULL + unique index (only when backfill is complete)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM products WHERE product_code IS NULL) THEN
    ALTER TABLE products ALTER COLUMN product_code SET NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_code
  ON products (product_code);

-- 4. Reload PostgREST schema cache (fixes "could not find column in schema cache")
NOTIFY pgrst, 'reload schema';
