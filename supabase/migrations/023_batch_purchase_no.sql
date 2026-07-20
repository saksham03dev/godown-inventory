-- Purchase reference number on label batches (alongside source / buyer).

ALTER TABLE stock_batches
  ADD COLUMN IF NOT EXISTS purchase_no TEXT;

NOTIFY pgrst, 'reload schema';
