-- Atomic stock mutations + lock down direct writes on unit/ledger tables.
-- Call these RPCs only via service_role (Next.js API routes).

-- Link logs to units for reconciliation (nullable for legacy rows)
ALTER TABLE inventory_logs
  ADD COLUMN IF NOT EXISTS stock_unit_id UUID REFERENCES stock_units (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_logs_stock_unit ON inventory_logs (stock_unit_id);
CREATE INDEX IF NOT EXISTS idx_units_status_bill ON stock_units (status, bill_id);
CREATE INDEX IF NOT EXISTS idx_units_product_godown_status
  ON stock_units (product_id, godown_id, status);

-- One bill line per unit
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_items_unit_unique
  ON bill_items (stock_unit_id)
  WHERE stock_unit_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Unit stock in / stock out (single transaction, optimistic status guard)
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
      stocked_in_at = v_now
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

    UPDATE products
    SET total_stock = (
      SELECT COUNT(*)::INT FROM stock_units
      WHERE product_id = v_unit.product_id AND status = 'STOCKED_IN'
    )
    WHERE id = v_unit.product_id
    RETURNING * INTO v_product;

  ELSE
    -- STOCK_OUT
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
    SET
      status = 'STOCKED_OUT',
      stocked_out_at = v_now
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

    UPDATE products
    SET total_stock = (
      SELECT COUNT(*)::INT FROM stock_units
      WHERE product_id = v_unit.product_id AND status = 'STOCKED_IN'
    )
    WHERE id = v_unit.product_id
    RETURNING * INTO v_product;
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
        format(
          'Stock In: %s (Unit #%s) from %s',
          COALESCE(v_product.name, 'Product'),
          v_unit.unit_number,
          COALESCE(v_batch.source_name, 'batch')
        )
      ELSE
        format(
          'Stock Out: %s (Unit #%s) — ready for billing',
          COALESCE(v_product.name, 'Product'),
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
-- Attach stocked-out unit to a draft bill (guarded claim of bill_id)
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
    RETURN jsonb_build_object('success', false, 'message', 'This unit is already on another bill.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM bill_items WHERE bill_id = p_bill_id AND stock_unit_id = v_unit.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unit already on this bill.');
  END IF;

  SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  SELECT * INTO v_batch FROM stock_batches WHERE id = v_unit.batch_id;

  v_price := CASE
    WHEN p_unit_price IS NOT NULL AND p_unit_price > 0 THEN p_unit_price
    ELSE COALESCE(v_product.retail_selling_price, 0)
  END;

  UPDATE stock_units
  SET bill_id = p_bill_id
  WHERE id = v_unit.id AND bill_id IS NULL AND status = 'STOCKED_OUT';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This unit was claimed by another bill. Try a different unit.'
    );
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
    line_total
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
    1,
    v_price,
    v_price
  )
  RETURNING * INTO v_item;

  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM bill_items WHERE bill_id = p_bill_id;

  v_tax := ROUND((v_subtotal * v_bill.tax_percent) / 100.0, 2);
  v_total := GREATEST(0, v_subtotal + v_tax - v_bill.discount);

  UPDATE bills
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax,
    total = v_total
  WHERE id = p_bill_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Added %s (Unit #%s) to bill.',
      COALESCE(v_product.name, 'item'),
      v_unit.unit_number
    ),
    'billItemId', v_item.id
  );
END;
$$;

REVOKE ALL ON FUNCTION process_unit_stock_transaction(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION attach_unit_to_bill(UUID, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_unit_stock_transaction(TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION attach_unit_to_bill(UUID, TEXT, NUMERIC) TO service_role;

-- Release unit from a bill line (draft edits / delete bill)
CREATE OR REPLACE FUNCTION release_bill_item_unit(p_bill_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item bill_items%ROWTYPE;
  v_bill bills%ROWTYPE;
  v_subtotal NUMERIC(12, 2);
  v_tax NUMERIC(12, 2);
  v_total NUMERIC(12, 2);
BEGIN
  SELECT * INTO v_item FROM bill_items WHERE id = p_bill_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Line item not found.');
  END IF;

  SELECT * INTO v_bill FROM bills WHERE id = v_item.bill_id FOR UPDATE;
  IF v_bill.status = 'FINALIZED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot edit a finalized bill.');
  END IF;

  IF v_item.stock_unit_id IS NOT NULL THEN
    UPDATE stock_units SET bill_id = NULL WHERE id = v_item.stock_unit_id;
  END IF;

  DELETE FROM bill_items WHERE id = p_bill_item_id;

  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM bill_items WHERE bill_id = v_bill.id;
  v_tax := ROUND((v_subtotal * v_bill.tax_percent) / 100.0, 2);
  v_total := GREATEST(0, v_subtotal + v_tax - v_bill.discount);

  UPDATE bills
  SET subtotal = v_subtotal, tax_amount = v_tax, total = v_total
  WHERE id = v_bill.id;

  RETURN jsonb_build_object('success', true, 'message', 'Item removed from bill.', 'billId', v_bill.id);
END;
$$;

CREATE OR REPLACE FUNCTION release_all_bill_units(p_bill_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE stock_units SET bill_id = NULL WHERE bill_id = p_bill_id;
  DELETE FROM bills WHERE id = p_bill_id;
  RETURN jsonb_build_object('success', true, 'message', 'Bill deleted.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION release_bill_item_unit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_all_bill_units(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_bill_item_unit(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION release_all_bill_units(UUID) TO service_role;

-- Block client-side lifecycle edits on units (status / godown / bill / timestamps).
-- Label printing may still INSERT LABELLED units; service_role bypasses this guard.
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

DROP TRIGGER IF EXISTS trg_stock_unit_lifecycle_guard ON stock_units;
CREATE TRIGGER trg_stock_unit_lifecycle_guard
  BEFORE INSERT OR UPDATE ON stock_units
  FOR EACH ROW
  EXECUTE FUNCTION enforce_stock_unit_lifecycle_guard();

-- Ledger writes only via SECURITY DEFINER RPCs (service_role)
DROP POLICY IF EXISTS "Allow all on inventory_logs" ON inventory_logs;
DROP POLICY IF EXISTS "Allow all inventory_logs" ON inventory_logs;
DROP POLICY IF EXISTS "inventory_logs_select_all" ON inventory_logs;
CREATE POLICY "inventory_logs_select_all" ON inventory_logs
  FOR SELECT USING (true);

-- Keep stock_units readable/writable for label INSERT + non-lifecycle updates;
-- lifecycle columns are enforced by the trigger above.
DROP POLICY IF EXISTS "stock_units_select_all" ON stock_units;
DROP POLICY IF EXISTS "Allow all on stock_units" ON stock_units;
CREATE POLICY "Allow all on stock_units" ON stock_units
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
