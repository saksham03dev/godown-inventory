-- Phase 4: Retail billing — scan bale + bag qty on draft bill (deducts inventory atomically)

-- ---------------------------------------------------------------------------
-- Restore bags when a retail bill line is removed or bill deleted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION restore_retail_bill_item_stock(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item bill_items%ROWTYPE;
  v_unit stock_units%ROWTYPE;
  v_bags_per_bale CONSTANT INT := 1000;
  v_new_remaining INT;
BEGIN
  SELECT * INTO v_item FROM bill_items WHERE id = p_item_id;
  IF NOT FOUND OR v_item.sale_channel IS DISTINCT FROM 'RETAIL' THEN
    RETURN;
  END IF;
  IF v_item.stock_unit_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_unit FROM stock_units WHERE id = v_item.stock_unit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_new_remaining := LEAST(v_bags_per_bale, v_unit.remaining_bags + v_item.quantity);

  UPDATE stock_units
  SET
    remaining_bags = v_new_remaining,
    status = 'STOCKED_IN',
    stocked_out_at = NULL,
    opened_at = CASE
      WHEN v_new_remaining = v_bags_per_bale THEN NULL
      ELSE COALESCE(opened_at, NOW())
    END
  WHERE id = v_unit.id;

  PERFORM sync_product_total_stock(v_unit.product_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Retail: deduct bags from STOCKED_IN bale and add bill line
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_retail_bill_line(
  p_bill_id UUID,
  p_unit_barcode TEXT,
  p_bags_qty INT,
  p_unit_price NUMERIC DEFAULT 0,
  p_handled_by TEXT DEFAULT 'system'
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
  v_line_total NUMERIC(12, 2);
  v_item bill_items%ROWTYPE;
  v_subtotal NUMERIC(12, 2);
  v_tax NUMERIC(12, 2);
  v_total NUMERIC(12, 2);
  v_bags_per_bale CONSTANT INT := 1000;
  v_prev_remaining INT;
  v_new_remaining INT;
  v_was_sealed BOOLEAN;
  v_event TEXT;
  v_handler TEXT := NULLIF(trim(COALESCE(p_handled_by, '')), '');
BEGIN
  IF p_bill_id IS NULL OR v_barcode IS NULL OR v_barcode = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bill and bale barcode are required.');
  END IF;

  IF p_bags_qty IS NULL OR p_bags_qty < 1 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Minimum sale is 1 bag.');
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
    RETURN jsonb_build_object('success', false, 'message', 'Bale barcode not recognized.');
  END IF;

  IF v_unit.status <> 'STOCKED_IN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Bale must be stocked in. Use wholesale flow for full bale sales.'
    );
  END IF;

  IF v_unit.remaining_bags < p_bags_qty THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Only %s bag(s) left in this bale.', v_unit.remaining_bags)
    );
  END IF;

  SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  SELECT * INTO v_batch FROM stock_batches WHERE id = v_unit.batch_id;
  v_handler := COALESCE(v_handler, 'system');

  v_prev_remaining := v_unit.remaining_bags;
  v_new_remaining := v_prev_remaining - p_bags_qty;
  v_was_sealed := v_prev_remaining = v_bags_per_bale;

  IF v_was_sealed THEN
    v_event := 'FIRST_OPEN';
  ELSIF v_new_remaining = 0 THEN
    v_event := 'BALE_EMPTY';
  ELSE
    v_event := 'DEDUCT_OPEN';
  END IF;

  UPDATE stock_units
  SET
    remaining_bags = v_new_remaining,
    opened_at = CASE
      WHEN v_was_sealed THEN NOW()
      ELSE opened_at
    END,
    status = CASE WHEN v_new_remaining = 0 THEN 'STOCKED_OUT' ELSE 'STOCKED_IN' END,
    stocked_out_at = CASE WHEN v_new_remaining = 0 THEN NOW() ELSE NULL END
  WHERE id = v_unit.id;

  INSERT INTO inventory_logs (
    product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
  ) VALUES (
    v_unit.product_id,
    v_unit.godown_id,
    'STOCK_OUT',
    p_bags_qty,
    v_handler,
    v_unit.id,
    'RETAIL'
  );

  PERFORM sync_product_total_stock(v_unit.product_id);

  v_price := COALESCE(NULLIF(p_unit_price, 0), v_product.retail_selling_price, 0);
  v_line_total := ROUND(p_bags_qty * v_price, 2);

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
    p_bags_qty,
    v_price,
    v_line_total,
    'RETAIL'
  )
  RETURNING * INTO v_item;

  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM bill_items WHERE bill_id = p_bill_id;
  v_tax := ROUND(v_subtotal * v_bill.tax_percent / 100.0, 2);
  v_total := GREATEST(0, v_subtotal + v_tax - v_bill.discount);

  UPDATE bills
  SET subtotal = v_subtotal, tax_amount = v_tax, total = v_total
  WHERE id = p_bill_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE v_event
      WHEN 'FIRST_OPEN' THEN
        format(
          'Bale %s opened — sold %s bags, %s remaining.',
          v_unit.unit_barcode, p_bags_qty, v_new_remaining
        )
      WHEN 'BALE_EMPTY' THEN
        format(
          'Sold %s bags from bale %s — bale empty, removed from open bales.',
          p_bags_qty, v_unit.unit_barcode
        )
      ELSE
        format(
          'Sold %s bags from open bale %s — %s remaining.',
          p_bags_qty, v_unit.unit_barcode, v_new_remaining
        )
    END,
    'event', v_event,
    'remainingBags', v_new_remaining,
    'bagsSold', p_bags_qty,
    'billId', p_bill_id,
    'unitBarcode', v_unit.unit_barcode
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Release bill line — restore retail stock or unlink wholesale unit
-- ---------------------------------------------------------------------------
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

  IF v_item.sale_channel = 'RETAIL' THEN
    PERFORM restore_retail_bill_item_stock(p_bill_item_id);
  ELSIF v_item.stock_unit_id IS NOT NULL THEN
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

-- ---------------------------------------------------------------------------
-- Delete draft bill — restore all retail deductions first
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_all_bill_units(p_bill_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item bill_items%ROWTYPE;
BEGIN
  FOR v_item IN
    SELECT * FROM bill_items
    WHERE bill_id = p_bill_id AND sale_channel = 'RETAIL'
  LOOP
    PERFORM restore_retail_bill_item_stock(v_item.id);
  END LOOP;

  UPDATE stock_units SET bill_id = NULL WHERE bill_id = p_bill_id;
  DELETE FROM bills WHERE id = p_bill_id;

  RETURN jsonb_build_object('success', true, 'message', 'Bill deleted.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION restore_retail_bill_item_stock(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_retail_bill_line(UUID, TEXT, INT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restore_retail_bill_item_stock(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION process_retail_bill_line(UUID, TEXT, INT, NUMERIC, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
