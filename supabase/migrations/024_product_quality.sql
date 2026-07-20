-- Product quality grade (e.g. A, B, export) for warehouse visibility.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS quality TEXT;

NOTIFY pgrst, 'reload schema';
