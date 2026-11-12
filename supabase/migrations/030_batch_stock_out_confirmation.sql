-- Confirm a staged stock-out session in one database transaction.
-- A persistent client request ID makes a retry safe after a lost response.

ALTER TABLE stock_out_slips
  ADD COLUMN IF NOT EXISTS client_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_out_slips_client_request_id
  ON stock_out_slips (client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION confirm_stock_out_slip_batch(
  p_client_request_id TEXT,
  p_existing_slip_id UUID,
  p_biller_name TEXT,
  p_bill_no TEXT,
  p_sale_channel TEXT,
  p_created_by UUID,
  p_created_by_label TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id TEXT := NULLIF(trim(COALESCE(p_client_request_id, '')), '');
  v_biller_name TEXT := NULLIF(trim(COALESCE(p_biller_name, '')), '');
  v_bill_no TEXT := NULLIF(trim(COALESCE(p_bill_no, '')), '');
  v_handler TEXT := COALESCE(NULLIF(trim(COALESCE(p_created_by_label, '')), ''), 'system');
  v_now TIMESTAMPTZ := NOW();
  v_item JSONB;
  v_barcode TEXT;
  v_bags_qty INT;
  v_barcodes TEXT[] := ARRAY[]::TEXT[];
  v_product_ids UUID[] := ARRAY[]::UUID[];
  v_unit stock_units%ROWTYPE;
  v_slip stock_out_slips%ROWTYPE;
  v_remaining INT;
  v_product_id UUID;
  v_has_slip BOOLEAN := FALSE;
BEGIN
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing upload ID. Keep the staged list and try again.');
  END IF;

  IF p_sale_channel NOT IN ('WHOLESALE', 'RETAIL') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid sale channel.');
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Scan at least one bale before confirming.');
  END IF;

  -- Serialise duplicate retries for this exact upload ID.
  PERFORM pg_advisory_xact_lock(hashtext(v_request_id));

  SELECT * INTO v_slip
  FROM stock_out_slips
  WHERE client_request_id = v_request_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Stock out was already uploaded.',
      'slipId', v_slip.id,
      'processedBarcodes', (
        SELECT COALESCE(jsonb_agg(trim(value ->> 'barcode')), '[]'::JSONB)
        FROM jsonb_array_elements(p_items)
      )
    );
  END IF;

  -- Validate and lock every bale before changing anything. A validation failure
  -- leaves the entire staged list untouched so the user can correct it safely.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_barcode := trim(COALESCE(v_item ->> 'barcode', ''));
    IF v_barcode = '' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Each line needs a barcode.');
    END IF;
    IF v_barcode = ANY(v_barcodes) THEN
      RETURN jsonb_build_object('success', false, 'message', format('Duplicate barcode in session: %s', v_barcode));
    END IF;
    IF COALESCE(v_item ->> 'bagsQty', '') !~ '^[0-9]+$' THEN
      RETURN jsonb_build_object('success', false, 'message', format('Invalid bag qty for %s.', v_barcode));
    END IF;
    v_bags_qty := (v_item ->> 'bagsQty')::INT;
    IF v_bags_qty < 1 OR v_bags_qty > 1000 THEN
      RETURN jsonb_build_object('success', false, 'message', format('Invalid bag qty for %s (1–1000).', v_barcode));
    END IF;

    SELECT * INTO v_unit
    FROM stock_units
    WHERE unit_barcode = v_barcode
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', format('No unit found for barcode: %s', v_barcode));
    END IF;
    IF v_unit.status <> 'STOCKED_IN' OR v_unit.remaining_bags < v_bags_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Bale %s is no longer available with the staged quantity. Refresh the staged list and try again.', v_barcode)
      );
    END IF;

    v_barcodes := array_append(v_barcodes, v_barcode);
  END LOOP;

  IF p_existing_slip_id IS NOT NULL THEN
    SELECT * INTO v_slip FROM stock_out_slips WHERE id = p_existing_slip_id FOR UPDATE;
    IF FOUND THEN
      v_has_slip := TRUE;
      IF v_slip.sale_channel <> p_sale_channel THEN
        RETURN jsonb_build_object('success', false, 'message', 'That slip does not match this sale mode.');
      END IF;
      IF v_slip.client_request_id IS NOT NULL AND v_slip.client_request_id <> v_request_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'That slip belongs to another upload session.');
      END IF;
      UPDATE stock_out_slips
      SET client_request_id = v_request_id, updated_at = v_now
      WHERE id = v_slip.id;
    END IF;
  END IF;

  IF NOT v_has_slip THEN
    INSERT INTO stock_out_slips (
      biller_name, bill_no, sale_channel, status, created_by, created_by_label,
      confirmed_at, client_request_id
    ) VALUES (
      v_biller_name, v_bill_no, p_sale_channel, 'CONFIRMED', p_created_by, v_handler,
      v_now, v_request_id
    )
    RETURNING * INTO v_slip;
  END IF;

  -- All validation has passed. Update bales, their logs, and the slip locally
  -- inside PostgreSQL instead of making several network calls per bale.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_barcode := trim(v_item ->> 'barcode');
    v_bags_qty := (v_item ->> 'bagsQty')::INT;
    SELECT * INTO v_unit FROM stock_units WHERE unit_barcode = v_barcode;
    v_remaining := v_unit.remaining_bags - v_bags_qty;

    UPDATE stock_units
    SET
      remaining_bags = v_remaining,
      opened_at = CASE
        WHEN v_unit.remaining_bags = 1000 AND v_remaining > 0 THEN v_now
        ELSE opened_at
      END,
      status = CASE WHEN v_remaining = 0 THEN 'STOCKED_OUT' ELSE 'STOCKED_IN' END,
      stocked_out_at = CASE WHEN v_remaining = 0 THEN v_now ELSE stocked_out_at END,
      sold_to_customer_name = CASE WHEN v_biller_name IS NOT NULL THEN v_biller_name ELSE sold_to_customer_name END,
      sold_bill_number = CASE WHEN v_bill_no IS NOT NULL THEN v_bill_no ELSE sold_bill_number END,
      sold_at = CASE WHEN v_biller_name IS NOT NULL OR v_bill_no IS NOT NULL THEN v_now ELSE sold_at END
    WHERE id = v_unit.id;

    INSERT INTO inventory_logs (
      product_id, godown_id, transaction_type, quantity, handled_by,
      stock_unit_id, sale_channel, stock_out_slip_id
    ) VALUES (
      v_unit.product_id, v_unit.godown_id, 'STOCK_OUT', v_bags_qty, v_handler,
      v_unit.id, p_sale_channel, v_slip.id
    );

    INSERT INTO stock_out_slip_units (
      slip_id, stock_unit_id, product_id, unit_number, bags_moved
    ) VALUES (
      v_slip.id, v_unit.id, v_unit.product_id, v_unit.unit_number, v_bags_qty
    );

    INSERT INTO stock_out_slip_lines (slip_id, product_id, bag_count, bale_count)
    VALUES (v_slip.id, v_unit.product_id, v_bags_qty, 1)
    ON CONFLICT (slip_id, product_id) DO UPDATE
    SET
      bag_count = stock_out_slip_lines.bag_count + EXCLUDED.bag_count,
      bale_count = stock_out_slip_lines.bale_count + EXCLUDED.bale_count;

    IF NOT (v_unit.product_id = ANY(v_product_ids)) THEN
      v_product_ids := array_append(v_product_ids, v_unit.product_id);
    END IF;
  END LOOP;

  FOREACH v_product_id IN ARRAY v_product_ids
  LOOP
    PERFORM sync_product_total_stock(v_product_id);
  END LOOP;

  UPDATE stock_out_slips SET updated_at = v_now WHERE id = v_slip.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Stock out uploaded · %s label(s) on slip.', cardinality(v_barcodes)),
    'slipId', v_slip.id,
    'processedBarcodes', to_jsonb(v_barcodes)
  );
END;
$$;

REVOKE ALL ON FUNCTION confirm_stock_out_slip_batch(TEXT, UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_stock_out_slip_batch(TEXT, UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
