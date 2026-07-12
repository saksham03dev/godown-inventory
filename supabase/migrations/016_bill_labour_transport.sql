-- Labour + transportation costs on bills (optional extras added to invoice total)

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS labour_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transportation_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE bills
  ADD CONSTRAINT bills_labour_cost_nonneg CHECK (labour_cost >= 0),
  ADD CONSTRAINT bills_transportation_cost_nonneg CHECK (transportation_cost >= 0);

COMMENT ON COLUMN bills.labour_cost IS 'Optional labour charges added to bill total.';
COMMENT ON COLUMN bills.transportation_cost IS 'Optional transport charges added to bill total.';

-- Helper expression used in RPCs:
-- total = GREATEST(0, subtotal + tax + labour + transport - discount)

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
    bill_id, stock_unit_id, product_id, product_name, product_code,
    unit_barcode, source_name, unit_number, batch_quantity,
    quantity, unit_price, line_total, sale_channel
  ) VALUES (
    p_bill_id, v_unit.id, v_unit.product_id,
    COALESCE(v_product.name, 'Unknown'), COALESCE(v_product.product_code, ''),
    v_unit.unit_barcode, v_batch.source_name, v_unit.unit_number, v_batch.quantity,
    v_bags_per_bale, v_price, v_line_total, 'WHOLESALE'
  )
  RETURNING * INTO v_item;

  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM bill_items WHERE bill_id = p_bill_id;

  v_tax := ROUND(v_subtotal * v_bill.tax_percent / 100, 2);
  v_total := GREATEST(
    0,
    ROUND(
      v_subtotal + v_tax + COALESCE(v_bill.labour_cost, 0)
        + COALESCE(v_bill.transportation_cost, 0) - v_bill.discount,
      2
    )
  );

  UPDATE bills
  SET subtotal = v_subtotal, tax_amount = v_tax, total = v_total
  WHERE id = p_bill_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Added %s bags (1 bale) to bill.', v_bags_per_bale),
    'data', jsonb_build_object('billId', p_bill_id)
  );
END;
$$;

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
    opened_at = CASE WHEN v_was_sealed THEN NOW() ELSE opened_at END,
    status = CASE WHEN v_new_remaining = 0 THEN 'STOCKED_OUT' ELSE 'STOCKED_IN' END,
    stocked_out_at = CASE WHEN v_new_remaining = 0 THEN NOW() ELSE NULL END
  WHERE id = v_unit.id;

  INSERT INTO inventory_logs (
    product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
  ) VALUES (
    v_unit.product_id, v_unit.godown_id, 'STOCK_OUT', p_bags_qty, v_handler, v_unit.id, 'RETAIL'
  );

  PERFORM sync_product_total_stock(v_unit.product_id);

  v_price := COALESCE(NULLIF(p_unit_price, 0), v_product.retail_selling_price, 0);
  v_line_total := ROUND(p_bags_qty * v_price, 2);

  INSERT INTO bill_items (
    bill_id, stock_unit_id, product_id, product_name, product_code,
    unit_barcode, source_name, unit_number, batch_quantity,
    quantity, unit_price, line_total, sale_channel
  ) VALUES (
    p_bill_id, v_unit.id, v_unit.product_id,
    COALESCE(v_product.name, 'Unknown'), COALESCE(v_product.product_code, ''),
    v_unit.unit_barcode, v_batch.source_name, v_unit.unit_number, v_batch.quantity,
    p_bags_qty, v_price, v_line_total, 'RETAIL'
  )
  RETURNING * INTO v_item;

  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM bill_items WHERE bill_id = p_bill_id;
  v_tax := ROUND(v_subtotal * v_bill.tax_percent / 100.0, 2);
  v_total := GREATEST(
    0,
    v_subtotal + v_tax + COALESCE(v_bill.labour_cost, 0)
      + COALESCE(v_bill.transportation_cost, 0) - v_bill.discount
  );

  UPDATE bills
  SET subtotal = v_subtotal, tax_amount = v_tax, total = v_total
  WHERE id = p_bill_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE v_event
      WHEN 'FIRST_OPEN' THEN
        format('Bale %s opened — sold %s bags, %s remaining.', v_unit.unit_barcode, p_bags_qty, v_new_remaining)
      WHEN 'BALE_EMPTY' THEN
        format('Sold %s bags from bale %s — bale empty, removed from open bales.', p_bags_qty, v_unit.unit_barcode)
      ELSE
        format('Sold %s bags from open bale %s — %s remaining.', p_bags_qty, v_unit.unit_barcode, v_new_remaining)
    END,
    'event', v_event,
    'remainingBags', v_new_remaining,
    'bagsSold', p_bags_qty,
    'billId', p_bill_id,
    'unitBarcode', v_unit.unit_barcode
  );
END;
$$;

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
  v_total := GREATEST(
    0,
    v_subtotal + v_tax + COALESCE(v_bill.labour_cost, 0)
      + COALESCE(v_bill.transportation_cost, 0) - v_bill.discount
  );

  UPDATE bills
  SET subtotal = v_subtotal, tax_amount = v_tax, total = v_total
  WHERE id = v_bill.id;

  RETURN jsonb_build_object('success', true, 'message', 'Item removed from bill.', 'billId', v_bill.id);
END;
$$;

CREATE OR REPLACE FUNCTION finalize_bill_stamp_sold_to(p_bill_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill bills%ROWTYPE;
  v_subtotal NUMERIC(12, 2);
  v_tax NUMERIC(12, 2);
  v_total NUMERIC(12, 2);
  v_name TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_stamped INT := 0;
  v_stamped_retail INT := 0;
  v_needs_sold_to BOOLEAN := FALSE;
  v_bags_per_bale CONSTANT INT := 1000;
BEGIN
  IF p_bill_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bill id is required.');
  END IF;

  SELECT * INTO v_bill FROM bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bill not found.');
  END IF;
  IF v_bill.status = 'FINALIZED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bill is already finalized.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM bill_items WHERE bill_id = p_bill_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Add at least one item before finalizing.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM bill_items
    WHERE bill_id = p_bill_id
      AND (
        COALESCE(sale_channel, 'WHOLESALE') = 'WHOLESALE'
        OR (sale_channel = 'RETAIL' AND quantity = v_bags_per_bale)
      )
  ) INTO v_needs_sold_to;

  v_name := NULLIF(trim(COALESCE(v_bill.customer_name, '')), '');

  IF v_needs_sold_to AND v_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Enter customer name before finalizing (required for complete sealed bale sales).'
    );
  END IF;

  v_name := COALESCE(v_name, 'Walk-in Customer');

  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM bill_items WHERE bill_id = p_bill_id;
  v_tax := ROUND((v_subtotal * v_bill.tax_percent) / 100.0, 2);
  v_total := GREATEST(
    0,
    v_subtotal + v_tax + COALESCE(v_bill.labour_cost, 0)
      + COALESCE(v_bill.transportation_cost, 0) - v_bill.discount
  );

  UPDATE bills
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax,
    total = v_total,
    customer_name = v_name,
    status = 'FINALIZED',
    finalized_at = v_now
  WHERE id = p_bill_id;

  UPDATE stock_units u
  SET
    sold_to_customer_name = v_name,
    sold_to_customer_phone = NULLIF(trim(COALESCE(v_bill.customer_phone, '')), ''),
    sold_bill_number = v_bill.bill_number,
    sold_at = v_now
  WHERE u.bill_id = p_bill_id
    AND u.status = 'STOCKED_OUT'
    AND u.remaining_bags = 0
    AND EXISTS (
      SELECT 1 FROM bill_items bi
      WHERE bi.stock_unit_id = u.id
        AND bi.bill_id = p_bill_id
        AND COALESCE(bi.sale_channel, 'WHOLESALE') = 'WHOLESALE'
        AND bi.quantity = v_bags_per_bale
    );

  GET DIAGNOSTICS v_stamped = ROW_COUNT;

  UPDATE stock_units u
  SET
    sold_to_customer_name = v_name,
    sold_to_customer_phone = NULLIF(trim(COALESCE(v_bill.customer_phone, '')), ''),
    sold_bill_number = v_bill.bill_number,
    sold_at = v_now
  FROM bill_items bi
  WHERE bi.bill_id = p_bill_id
    AND bi.stock_unit_id = u.id
    AND bi.sale_channel = 'RETAIL'
    AND bi.quantity = v_bags_per_bale
    AND u.status = 'STOCKED_OUT'
    AND u.remaining_bags = 0;

  GET DIAGNOSTICS v_stamped_retail = ROW_COUNT;
  v_stamped := v_stamped + v_stamped_retail;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Bill %s finalized.', v_bill.bill_number),
    'billId', p_bill_id,
    'stampedUnits', v_stamped,
    'needsSoldTo', v_needs_sold_to
  );
END;
$$;

REVOKE ALL ON FUNCTION attach_unit_to_bill(UUID, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_retail_bill_line(UUID, TEXT, INT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_bill_item_unit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION finalize_bill_stamp_sold_to(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION attach_unit_to_bill(UUID, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION process_retail_bill_line(UUID, TEXT, INT, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION release_bill_item_unit(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION finalize_bill_stamp_sold_to(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
