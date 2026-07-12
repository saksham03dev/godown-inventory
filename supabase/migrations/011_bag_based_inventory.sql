-- Phase 1: Bag-based inventory foundation
-- One bale label = 1000 bags (fixed; enforced in app via BAGS_PER_BALE constant)

-- ---------------------------------------------------------------------------
-- stock_units: track bags remaining in each bale container
-- ---------------------------------------------------------------------------
ALTER TABLE stock_units
  ADD COLUMN IF NOT EXISTS remaining_bags INT NOT NULL DEFAULT 1000
    CHECK (remaining_bags >= 0 AND remaining_bags <= 1000);

ALTER TABLE stock_units
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;

-- Backfill existing rows (all current STOCKED_IN are sealed full bales)
UPDATE stock_units
SET remaining_bags = 1000
WHERE status IN ('LABELLED', 'STOCKED_IN');

UPDATE stock_units
SET remaining_bags = 0
WHERE status = 'STOCKED_OUT';

CREATE INDEX IF NOT EXISTS idx_units_open_bales
  ON stock_units (godown_id, product_id)
  WHERE status = 'STOCKED_IN'
    AND remaining_bags > 0
    AND remaining_bags < 1000;

-- ---------------------------------------------------------------------------
-- Audit + billing channel tags (used fully in later phases)
-- ---------------------------------------------------------------------------
ALTER TABLE inventory_logs
  ADD COLUMN IF NOT EXISTS sale_channel TEXT
    CHECK (
      sale_channel IS NULL
      OR sale_channel IN ('STOCK_IN', 'WHOLESALE', 'RETAIL')
    );

ALTER TABLE bill_items
  ADD COLUMN IF NOT EXISTS sale_channel TEXT
    CHECK (
      sale_channel IS NULL
      OR sale_channel IN ('WHOLESALE', 'RETAIL')
    );

-- Retail allows multiple bill lines per bale over time
DROP INDEX IF EXISTS idx_bill_items_unit_unique;

-- ---------------------------------------------------------------------------
-- products.total_stock = sum of bags in STOCKED_IN units
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_product_total_stock(p_product_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bags INT;
BEGIN
  SELECT COALESCE(SUM(remaining_bags), 0)::INT INTO v_bags
  FROM stock_units
  WHERE product_id = p_product_id
    AND status = 'STOCKED_IN';

  UPDATE products SET total_stock = v_bags WHERE id = p_product_id;
  RETURN v_bags;
END;
$$;

UPDATE products p
SET total_stock = COALESCE((
  SELECT SUM(u.remaining_bags)::INT
  FROM stock_units u
  WHERE u.product_id = p.id
    AND u.status = 'STOCKED_IN'
), 0);

-- ---------------------------------------------------------------------------
-- Stock in / wholesale stock out (bags: +1000 / -1000 on sealed bales only)
-- ---------------------------------------------------------------------------
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
  v_bags_per_bale CONSTANT INT := 1000;
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
    SET
      status = 'STOCKED_IN',
      godown_id = p_godown_id,
      stocked_in_at = v_now,
      remaining_bags = v_bags_per_bale,
      opened_at = NULL
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
      product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
    ) VALUES (
      v_unit.product_id, p_godown_id, 'STOCK_IN', v_bags_per_bale, v_handler, v_unit.id, 'STOCK_IN'
    );

    PERFORM sync_product_total_stock(v_unit.product_id);
    SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;

  ELSE
    -- WHOLESALE STOCK_OUT: sealed bales only (remaining_bags must equal 1000)
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

    IF v_unit.remaining_bags < v_bags_per_bale THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format(
          'This bale is open (%s bags left). Use Retail billing to sell partial quantities.',
          v_unit.remaining_bags
        ),
        'isUnitScan', true
      );
    END IF;

    UPDATE stock_units
    SET
      status = 'STOCKED_OUT',
      stocked_out_at = v_now,
      remaining_bags = 0
    WHERE id = v_unit.id
      AND status = 'STOCKED_IN'
      AND godown_id = p_godown_id
      AND remaining_bags = v_bags_per_bale;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Unit was already stocked out by another scan.',
        'isUnitScan', true
      );
    END IF;

    INSERT INTO inventory_logs (
      product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
    ) VALUES (
      v_unit.product_id, p_godown_id, 'STOCK_OUT', v_bags_per_bale, v_handler, v_unit.id, 'WHOLESALE'
    );

    PERFORM sync_product_total_stock(v_unit.product_id);
    SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  END IF;

  SELECT * INTO v_unit FROM stock_units WHERE id = v_unit.id;

  SELECT COALESCE(SUM(remaining_bags), 0)::INT INTO v_godown_stock
  FROM stock_units
  WHERE product_id = v_unit.product_id
    AND godown_id = p_godown_id
    AND status = 'STOCKED_IN';

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE
      WHEN p_transaction_type = 'STOCK_IN' THEN
        format(
          'Stock In: %s — +%s bags (bale #%s, %s)',
          COALESCE(v_product.name, 'Product'),
          v_bags_per_bale,
          v_unit.unit_number,
          COALESCE(v_batch.source_name, 'batch')
        )
      ELSE
        format(
          'Wholesale Out: %s — -%s bags (bale #%s) — ready for billing',
          COALESCE(v_product.name, 'Product'),
          v_bags_per_bale,
          v_unit.unit_number
        )
    END,
    'isUnitScan', true,
    'newGodownStock', v_godown_stock,
    'product', to_jsonb(v_product),
    'stockUnit', to_jsonb(v_unit) || jsonb_build_object(
      'products', jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'product_code', v_product.product_code,
        'size', v_product.size,
        'retail_selling_price', v_product.retail_selling_price
      ),
      'stock_batches', jsonb_build_object(
        'id', v_batch.id,
        'batch_code', v_batch.batch_code,
        'source_name', v_batch.source_name,
        'quantity', v_batch.quantity
      ),
      'godowns', jsonb_build_object(
        'id', v_godown.id,
        'location_name', v_godown.location_name
      )
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Wholesale bill attach: 1000 bags @ per-bag price
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION attach_unit_to_bill(
  p_bill_id UUID,
  p_unit_barcode TEXT,
  p_unit_price NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barcode TEXT := trim(p_unit_barcode);
  v_bill bills%ROWTYPE;
  v_unit stock_units%ROWTYPE;
  v_product products%ROWTYPE;
  v_batch stock_batches%ROWTYPE;
  v_price NUMERIC(12, 2);
  v_item bill_items%ROWTYPE;
  v_updated INT;
  v_subtotal NUMERIC(12, 2);
  v_tax NUMERIC(12, 2);
  v_total NUMERIC(12, 2);
  v_bags_per_bale CONSTANT INT := 1000;
  v_line_total NUMERIC(12, 2);
BEGIN
  IF p_bill_id IS NULL OR v_barcode IS NULL OR v_barcode = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bill and unit barcode are required.');
  END IF;

  SELECT * INTO v_bill FROM bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bill not found.');
  END IF;
  IF v_bill.status = 'FINALIZED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot modify a finalized bill.');
  END IF;

  SELECT * INTO v_unit FROM stock_units WHERE unit_barcode = v_barcode FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unit barcode not recognized.');
  END IF;

  IF v_unit.status <> 'STOCKED_OUT' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only stocked-out units can be added to a bill. Scan at Stock Out first.'
    );
  END IF;

  IF v_unit.bill_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unit is already on another bill.');
  END IF;

  SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  SELECT * INTO v_batch FROM stock_batches WHERE id = v_unit.batch_id;

  v_price := COALESCE(NULLIF(p_unit_price, 0), v_product.retail_selling_price, 0);
  v_line_total := ROUND(v_bags_per_bale * v_price, 2);

  UPDATE stock_units
  SET bill_id = p_bill_id
  WHERE id = v_unit.id AND bill_id IS NULL AND status = 'STOCKED_OUT';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unit was claimed by another bill.');
  END IF;

  INSERT INTO bill_items (
    bill_id,
    stock_unit_id,
    product_id,
    product_name,
    product_code,
    unit_barcode,
    source_name,
    unit_number,
    batch_quantity,
    quantity,
    unit_price,
    line_total,
    sale_channel
  ) VALUES (
    p_bill_id,
    v_unit.id,
    v_unit.product_id,
    COALESCE(v_product.name, 'Unknown'),
    COALESCE(v_product.product_code, ''),
    v_unit.unit_barcode,
    v_batch.source_name,
    v_unit.unit_number,
    v_batch.quantity,
    v_bags_per_bale,
    v_price,
    v_line_total,
    'WHOLESALE'
  )
  RETURNING * INTO v_item;

  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM bill_items WHERE bill_id = p_bill_id;

  v_tax := ROUND(v_subtotal * v_bill.tax_percent / 100, 2);
  v_total := GREATEST(0, ROUND(v_subtotal + v_tax - v_bill.discount, 2));

  UPDATE bills
  SET subtotal = v_subtotal, tax_amount = v_tax, total = v_total
  WHERE id = p_bill.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Added %s bags (1 bale) to bill.', v_bags_per_bale),
    'data', jsonb_build_object('billId', p_bill_id)
  );
END;
$$;

-- Guard remaining_bags / opened_at lifecycle (service_role bypasses)
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
       AND NEW.stocked_out_at IS NULL
       AND NEW.remaining_bags = 1000 THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Client may only create LABELLED units via label printing';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.godown_id IS DISTINCT FROM OLD.godown_id
       OR NEW.bill_id IS DISTINCT FROM OLD.bill_id
       OR NEW.stocked_in_at IS DISTINCT FROM OLD.stocked_in_at
       OR NEW.stocked_out_at IS DISTINCT FROM OLD.stocked_out_at
       OR NEW.remaining_bags IS DISTINCT FROM OLD.remaining_bags
       OR NEW.opened_at IS DISTINCT FROM OLD.opened_at THEN
      RAISE EXCEPTION 'Stock unit lifecycle changes must go through the scan/billing API';
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

NOTIFY pgrst, 'reload schema';
