-- MANUAL ROLLBACK ONLY — do not run via npm run db:push
-- Use only in emergency to undo migration 011_bag_based_inventory.sql
--
-- Preconditions (must all be true):
--   • No open bales (every STOCKED_IN unit has remaining_bags = 1000)
--   • No retail partial sales have occurred
--   • Wholesale bills still use 1 bale = 1 line (quantity may be 1000 if 011 billing ran)
--
-- Run in Supabase SQL Editor after redeploying git tag pre-bag-inventory-phase1

-- Restore unit-count total_stock
UPDATE products p
SET total_stock = COALESCE((
  SELECT COUNT(*)::INT
  FROM stock_units u
  WHERE u.product_id = p.id AND u.status = 'STOCKED_IN'
), 0);

-- Restore sync helper (unit count)
CREATE OR REPLACE FUNCTION sync_product_total_stock(p_product_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_count
  FROM stock_units
  WHERE product_id = p_product_id
    AND status = 'STOCKED_IN';

  UPDATE products SET total_stock = v_count WHERE id = p_product_id;
  RETURN v_count;
END;
$$;

-- Restore pre-011 stock RPC (quantity = 1 per scan)
CREATE OR REPLACE FUNCTION process_unit_stock_transaction(
  p_barcode TEXT,
  p_godown_id UUID,
  p_transaction_type TEXT,
  p_handled_by TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barcode TEXT := trim(p_barcode);
  v_unit stock_units%ROWTYPE;
  v_product products%ROWTYPE;
  v_batch stock_batches%ROWTYPE;
  v_godown godowns%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_updated INT;
  v_godown_stock INT;
  v_handler TEXT := NULLIF(trim(COALESCE(p_handled_by, '')), '');
BEGIN
  IF v_barcode IS NULL OR v_barcode = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid barcode scanned.');
  END IF;

  IF p_godown_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Please select a godown before scanning.');
  END IF;

  IF p_transaction_type NOT IN ('STOCK_IN', 'STOCK_OUT') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid transaction type.');
  END IF;

  SELECT * INTO v_godown FROM godowns WHERE id = p_godown_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Godown not found.');
  END IF;

  SELECT * INTO v_unit FROM stock_units WHERE unit_barcode = v_barcode FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('No unit found for barcode: %s', v_barcode)
    );
  END IF;

  SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  SELECT * INTO v_batch FROM stock_batches WHERE id = v_unit.batch_id;
  v_handler := COALESCE(v_handler, 'system');

  IF p_transaction_type = 'STOCK_IN' THEN
    IF v_unit.status <> 'LABELLED' THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Unit already %s.', lower(replace(v_unit.status, '_', ' '))),
        'isUnitScan', true
      );
    END IF;

    UPDATE stock_units
    SET status = 'STOCKED_IN', godown_id = p_godown_id, stocked_in_at = v_now
    WHERE id = v_unit.id AND status = 'LABELLED';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Unit was already stocked in by another scan. Try the next label.',
        'isUnitScan', true
      );
    END IF;

    INSERT INTO inventory_logs (
      product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id
    ) VALUES (
      v_unit.product_id, p_godown_id, 'STOCK_IN', 1, v_handler, v_unit.id
    );

    PERFORM sync_product_total_stock(v_unit.product_id);
    SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;

  ELSE
    IF v_unit.status = 'LABELLED' THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Unit not stocked in yet. Scan at Stock In first.',
        'isUnitScan', true
      );
    END IF;

    IF v_unit.status = 'STOCKED_OUT' THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Unit already stocked out.',
        'isUnitScan', true
      );
    END IF;

    IF v_unit.godown_id IS DISTINCT FROM p_godown_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'This unit is not in the selected godown.',
        'isUnitScan', true
      );
    END IF;

    UPDATE stock_units
    SET status = 'STOCKED_OUT', stocked_out_at = v_now
    WHERE id = v_unit.id AND status = 'STOCKED_IN' AND godown_id = p_godown_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Unit was already stocked out by another scan.',
        'isUnitScan', true
      );
    END IF;

    INSERT INTO inventory_logs (
      product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id
    ) VALUES (
      v_unit.product_id, p_godown_id, 'STOCK_OUT', 1, v_handler, v_unit.id
    );

    PERFORM sync_product_total_stock(v_unit.product_id);
    SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  END IF;

  SELECT * INTO v_unit FROM stock_units WHERE id = v_unit.id;

  SELECT COUNT(*)::INT INTO v_godown_stock
  FROM stock_units
  WHERE product_id = v_unit.product_id
    AND godown_id = p_godown_id
    AND status = 'STOCKED_IN';

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE
      WHEN p_transaction_type = 'STOCK_IN' THEN
        format('Stock In: %s (Unit #%s) from %s', COALESCE(v_product.name, 'Product'), v_unit.unit_number, COALESCE(v_batch.source_name, 'batch'))
      ELSE
        format('Stock Out: %s (Unit #%s) — ready for billing', COALESCE(v_product.name, 'Product'), v_unit.unit_number)
    END,
    'isUnitScan', true,
    'newGodownStock', v_godown_stock,
    'product', to_jsonb(v_product),
    'stockUnit', to_jsonb(v_unit)
  );
END;
$$;

-- Fix bill lines created with quantity=1000 back to 1 (wholesale only, post-011)
UPDATE bill_items
SET quantity = 1, line_total = unit_price
WHERE sale_channel = 'WHOLESALE' AND quantity = 1000;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_items_unit_unique
  ON bill_items (stock_unit_id)
  WHERE stock_unit_id IS NOT NULL;

ALTER TABLE bill_items DROP COLUMN IF EXISTS sale_channel;
ALTER TABLE inventory_logs DROP COLUMN IF EXISTS sale_channel;

DROP INDEX IF EXISTS idx_units_open_bales;

ALTER TABLE stock_units DROP COLUMN IF EXISTS opened_at;
ALTER TABLE stock_units DROP COLUMN IF EXISTS remaining_bags;

-- Restore lifecycle guard without bag columns
CREATE OR REPLACE FUNCTION enforce_stock_unit_lifecycle_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT := COALESCE(
    current_setting('request.jwt.claim.role', true),
    current_user
  );
BEGIN
  IF v_role IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'LABELLED'
       AND NEW.godown_id IS NULL
       AND NEW.bill_id IS NULL
       AND NEW.stocked_in_at IS NULL
       AND NEW.stocked_out_at IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Client may only create LABELLED units via label printing';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.godown_id IS DISTINCT FROM OLD.godown_id
       OR NEW.bill_id IS DISTINCT FROM OLD.bill_id
       OR NEW.stocked_in_at IS DISTINCT FROM OLD.stocked_in_at
       OR NEW.stocked_out_at IS DISTINCT FROM OLD.stocked_out_at THEN
      RAISE EXCEPTION 'Stock unit lifecycle changes must go through the scan/billing API';
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

NOTIFY pgrst, 'reload schema';
