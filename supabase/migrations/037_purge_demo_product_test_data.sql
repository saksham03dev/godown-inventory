-- Remove all DEMO test data from inventory, labels, slips, and bills.
-- Keeps the row in products (total_stock reset to 0) for future testing.

DO $$
DECLARE
  v_demo_id UUID;
  v_deleted_slips INT := 0;
  v_deleted_bills INT := 0;
  v_deleted_batches INT := 0;
BEGIN
  SELECT id
  INTO v_demo_id
  FROM products
  WHERE upper(trim(product_code)) = 'DEMO'
     OR upper(trim(name)) = 'DEMO'
  ORDER BY created_at
  LIMIT 1;

  IF v_demo_id IS NULL THEN
    RAISE NOTICE 'purge_demo: no product with product_code or name DEMO — nothing to do.';
    RETURN;
  END IF;

  -- Stock-out slips (session bills) that include DEMO anywhere
  WITH doomed AS (
    SELECT DISTINCT slip_id AS id
    FROM (
      SELECT slip_id FROM stock_out_slip_lines WHERE product_id = v_demo_id
      UNION
      SELECT slip_id FROM stock_out_slip_units WHERE product_id = v_demo_id
      UNION
      SELECT sosu.slip_id
      FROM stock_out_slip_units sosu
      JOIN stock_units su ON su.id = sosu.stock_unit_id
      WHERE su.product_id = v_demo_id
    ) x
  ),
  removed AS (
    DELETE FROM stock_out_slips s
    USING doomed d
    WHERE s.id = d.id
    RETURNING s.id
  )
  SELECT count(*)::INT INTO v_deleted_slips FROM removed;

  -- Customer bills that include DEMO on any line
  WITH doomed AS (
    SELECT DISTINCT bill_id AS id
    FROM bill_items
    WHERE product_id = v_demo_id
  ),
  removed AS (
    DELETE FROM bills b
    USING doomed d
    WHERE b.id = d.id
    RETURNING b.id
  )
  SELECT count(*)::INT INTO v_deleted_bills FROM removed;

  -- Ledger and return audit tied to DEMO
  DELETE FROM inventory_logs
  WHERE product_id = v_demo_id
     OR stock_unit_id IN (SELECT id FROM stock_units WHERE product_id = v_demo_id);

  DELETE FROM stock_return_events
  WHERE stock_unit_id IN (SELECT id FROM stock_units WHERE product_id = v_demo_id);

  -- Orphan slip rows (if any slip was only partially cleaned)
  DELETE FROM stock_out_slip_units
  WHERE product_id = v_demo_id
     OR stock_unit_id IN (SELECT id FROM stock_units WHERE product_id = v_demo_id);

  DELETE FROM stock_out_slip_lines WHERE product_id = v_demo_id;

  DELETE FROM stock_out_slips s
  WHERE NOT EXISTS (
    SELECT 1 FROM stock_out_slip_lines l WHERE l.slip_id = s.id
  );

  -- Labels (batches) and bales — batches cascade-delete units
  WITH removed AS (
    DELETE FROM stock_batches
    WHERE product_id = v_demo_id
    RETURNING id
  )
  SELECT count(*)::INT INTO v_deleted_batches FROM removed;

  DELETE FROM stock_units WHERE product_id = v_demo_id;

  UPDATE products
  SET total_stock = 0
  WHERE id = v_demo_id;

  PERFORM sync_product_total_stock(v_demo_id);

  RAISE NOTICE
    'purge_demo: product % — slips %, bills %, label batches %, stock cleared; product row kept.',
    v_demo_id,
    v_deleted_slips,
    v_deleted_bills,
    v_deleted_batches;
END $$;