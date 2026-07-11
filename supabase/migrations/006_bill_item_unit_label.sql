-- Store unit position within batch on bill line items (e.g. 1/20)
ALTER TABLE bill_items
  ADD COLUMN IF NOT EXISTS unit_number INT,
  ADD COLUMN IF NOT EXISTS batch_quantity INT;

NOTIFY pgrst, 'reload schema';
