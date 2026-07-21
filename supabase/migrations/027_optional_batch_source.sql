-- Source and purchase no. are optional when creating label batches.

ALTER TABLE stock_batches
  ALTER COLUMN source_name DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
