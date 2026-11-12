-- One staged stock-out list is one confirm. Scanning is not split into groups of 12.
-- Re-deploy confirm_stock_out_slip_batch without the per-call length cap.
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
  v_items JSONB := '[]'::JSONB;
  v_stored JSONB := NULL;
  v_request_slip_id UUID := NULL;
  v_slip_id UUID := NULL;
  v_slip stock_out_slips%ROWTYPE;
  v_unit stock_units%ROWTYPE;
  v_on_slip UUID;
  v_log_id UUID;
  v_log_qty INT;
  v_plan JSONB := '[]'::JSONB;
  v_action JSONB;
  v_result JSONB := '[]'::JSONB;
  v_saved JSONB := '[]'::JSONB;
  v_product_ids UUID[] := ARRAY[]::UUID[];
  v_product_id UUID;
  v_remaining INT;
  v_updated INT;
  v_fail_count INT := 0;
  v_fail_detail TEXT := '';
  v_reason TEXT;
  v_message TEXT;
  v_covers BOOLEAN := FALSE;
BEGIN
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Missing upload ID. Keep the staged list and try again.'
    );
  END IF;

  IF p_sale_channel NOT IN ('WHOLESALE', 'RETAIL') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid sale channel.');
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Scan at least one bale before confirming.');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_barcode := trim(COALESCE(v_item ->> 'barcode', ''));
    IF v_barcode = '' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Each line needs a barcode.');
    END IF;
    IF v_barcode = ANY(v_barcodes) THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Duplicate barcode in session: %s', v_barcode)
      );
    END IF;
    IF COALESCE(v_item ->> 'bagsQty', '') !~ '^[0-9]+$' THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Invalid bag qty for %s.', v_barcode)
      );
    END IF;
    v_bags_qty := (v_item ->> 'bagsQty')::INT;
    IF v_bags_qty < 1 OR v_bags_qty > 1000 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Invalid bag qty for %s (1–1000).', v_barcode)
      );
    END IF;
    v_barcodes := array_append(v_barcodes, v_barcode);
    v_items := v_items || jsonb_build_array(
      jsonb_build_object('barcode', v_barcode, 'bagsQty', v_bags_qty)
    );
  END LOOP;

  -- One in-flight upload for this id. A second tap waits, then sees the saved result.
  PERFORM pg_advisory_xact_lock(hashtext(v_request_id));

  SELECT slip_id, processed_barcodes
  INTO v_request_slip_id, v_stored
  FROM stock_out_confirm_requests
  WHERE client_request_id = v_request_id;

  IF v_request_slip_id IS NOT NULL
     AND p_existing_slip_id IS NOT NULL
     AND p_existing_slip_id IS DISTINCT FROM v_request_slip_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'That slip belongs to another upload session.'
    );
  END IF;

  IF v_request_slip_id IS NOT NULL THEN
    SELECT * INTO v_slip
    FROM stock_out_slips
    WHERE id = v_request_slip_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Upload session could not be resumed. Keep the staged list and try again.'
      );
    END IF;
    v_slip_id := v_slip.id;
  ELSIF p_existing_slip_id IS NOT NULL THEN
    SELECT * INTO v_slip
    FROM stock_out_slips
    WHERE id = p_existing_slip_id
    FOR UPDATE;
    IF FOUND THEN
      v_slip_id := v_slip.id;
    END IF;
  END IF;

  IF v_slip_id IS NOT NULL AND v_slip.sale_channel IS DISTINCT FROM p_sale_channel THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'That slip does not match this sale mode.'
    );
  END IF;

  v_covers := v_stored IS NOT NULL;
  IF v_covers THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
    LOOP
      IF NOT (v_stored @> jsonb_build_array(v_item ->> 'barcode')) THEN
        v_covers := FALSE;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Same list as a confirmed upload: do not stock anything out again.
  IF v_covers AND v_slip_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Stock out was already uploaded.',
      'slipId', v_slip_id,
      'processedBarcodes', (
        SELECT COALESCE(jsonb_agg(value ->> 'barcode'), '[]'::JSONB)
        FROM jsonb_array_elements(v_items)
      )
    );
  END IF;

  -- Lock every bale that exists, in barcode order, before deciding what to write.
  FOR v_unit IN
    SELECT *
    FROM stock_units
    WHERE unit_barcode = ANY(v_barcodes)
    ORDER BY unit_barcode
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_barcode := v_item ->> 'barcode';
    v_bags_qty := (v_item ->> 'bagsQty')::INT;
    v_reason := NULL;

    IF v_stored IS NOT NULL AND (v_stored @> jsonb_build_array(v_barcode)) THEN
      IF NOT (v_result @> jsonb_build_array(v_barcode)) THEN
        v_result := v_result || jsonb_build_array(v_barcode);
      END IF;
      CONTINUE;
    END IF;

    SELECT * INTO v_unit
    FROM stock_units
    WHERE unit_barcode = v_barcode;

    IF NOT FOUND THEN
      v_reason := 'no label for this barcode';
    ELSIF v_slip_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM stock_out_slip_units
      WHERE slip_id = v_slip_id
        AND stock_unit_id = v_unit.id
    ) THEN
      IF NOT (v_result @> jsonb_build_array(v_barcode)) THEN
        v_result := v_result || jsonb_build_array(v_barcode);
      END IF;
    ELSIF v_unit.status = 'IN_TRANSIT' THEN
      v_reason := 'in transit';
    ELSIF v_unit.status = 'LABELLED' THEN
      v_reason := 'not stocked in yet';
    ELSIF v_unit.godown_id IS NULL THEN
      v_reason := 'no godown on the bale';
    ELSIF v_unit.status = 'STOCKED_IN' AND v_unit.remaining_bags >= v_bags_qty THEN
      v_plan := v_plan || jsonb_build_array(jsonb_build_object(
        'action', 'stock_out',
        'barcode', v_barcode,
        'bagsQty', v_bags_qty,
        'unitId', v_unit.id,
        'productId', v_unit.product_id,
        'unitNumber', v_unit.unit_number,
        'godownId', v_unit.godown_id,
        'remaining', v_unit.remaining_bags
      ));
    ELSIF v_unit.status = 'STOCKED_OUT' AND v_unit.remaining_bags = 0 AND NOT EXISTS (
      SELECT 1 FROM stock_out_slip_units WHERE stock_unit_id = v_unit.id
    ) THEN
      SELECT id, quantity
      INTO v_log_id, v_log_qty
      FROM inventory_logs
      WHERE stock_unit_id = v_unit.id
        AND transaction_type = 'STOCK_OUT'
        AND stock_out_slip_id IS NULL
      ORDER BY timestamp DESC
      LIMIT 1;

      IF v_log_id IS NOT NULL AND v_log_qty IS DISTINCT FROM v_bags_qty THEN
        v_reason := 'already stocked out for a different quantity';
      ELSE
        v_plan := v_plan || jsonb_build_array(jsonb_build_object(
          'action', 'attach',
          'barcode', v_barcode,
          'bagsQty', v_bags_qty,
          'unitId', v_unit.id,
          'productId', v_unit.product_id,
          'unitNumber', v_unit.unit_number,
          'godownId', v_unit.godown_id,
          'logId', v_log_id
        ));
      END IF;
    ELSIF v_unit.status = 'STOCKED_OUT' THEN
      v_reason := 'already stocked out';
    ELSIF v_unit.status = 'STOCKED_IN' THEN
      v_reason := 'staged quantity is no longer available';
    ELSE
      v_reason := 'cannot be stocked out';
    END IF;

    IF v_reason IS NOT NULL THEN
      v_fail_count := v_fail_count + 1;
      IF v_fail_count <= 3 THEN
        v_fail_detail := v_fail_detail || format(' %s (%s).', v_barcode, v_reason);
      END IF;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_plan) = 0 AND jsonb_array_length(v_result) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format(
        'Could not upload %s bale(s):%s Nothing new was stocked out.',
        v_fail_count,
        v_fail_detail
      ),
      'processedBarcodes', '[]'::JSONB
    );
  END IF;

  FOR v_action IN SELECT value FROM jsonb_array_elements(v_plan)
  LOOP
    v_barcode := v_action ->> 'barcode';
    v_bags_qty := (v_action ->> 'bagsQty')::INT;

    IF v_action ->> 'action' = 'stock_out' THEN
      v_remaining := (v_action ->> 'remaining')::INT - v_bags_qty;
      UPDATE stock_units
      SET
        remaining_bags = v_remaining,
        opened_at = CASE
          WHEN (v_action ->> 'remaining')::INT = 1000 AND v_remaining > 0 THEN v_now
          ELSE opened_at
        END,
        status = CASE WHEN v_remaining = 0 THEN 'STOCKED_OUT' ELSE 'STOCKED_IN' END,
        stocked_out_at = CASE WHEN v_remaining = 0 THEN v_now ELSE stocked_out_at END,
        sold_to_customer_name = CASE
          WHEN v_biller_name IS NOT NULL THEN v_biller_name
          ELSE sold_to_customer_name
        END,
        sold_bill_number = CASE
          WHEN v_bill_no IS NOT NULL THEN v_bill_no
          ELSE sold_bill_number
        END,
        sold_at = CASE
          WHEN v_biller_name IS NOT NULL OR v_bill_no IS NOT NULL THEN v_now
          ELSE sold_at
        END
      WHERE id = (v_action ->> 'unitId')::UUID
        AND status = 'STOCKED_IN'
        AND remaining_bags >= v_bags_qty;

      GET DIAGNOSTICS v_updated = ROW_COUNT;
      IF v_updated = 0 THEN
        v_fail_count := v_fail_count + 1;
        IF v_fail_count <= 3 THEN
          v_fail_detail := v_fail_detail || format(' %s (changed before save).', v_barcode);
        END IF;
        CONTINUE;
      END IF;

      IF v_slip_id IS NULL THEN
        INSERT INTO stock_out_slips (
          biller_name, bill_no, sale_channel, status, created_by, created_by_label,
          confirmed_at, client_request_id
        ) VALUES (
          v_biller_name, v_bill_no, p_sale_channel, 'CONFIRMED', p_created_by, v_handler,
          v_now, v_request_id
        )
        RETURNING * INTO v_slip;
        v_slip_id := v_slip.id;
      END IF;

      INSERT INTO inventory_logs (
        product_id, godown_id, transaction_type, quantity, handled_by,
        stock_unit_id, sale_channel, stock_out_slip_id
      ) VALUES (
        (v_action ->> 'productId')::UUID,
        (v_action ->> 'godownId')::UUID,
        'STOCK_OUT',
        v_bags_qty,
        v_handler,
        (v_action ->> 'unitId')::UUID,
        p_sale_channel,
        v_slip_id
      );

      v_product_id := (v_action ->> 'productId')::UUID;
      IF NOT (v_product_id = ANY(v_product_ids)) THEN
        v_product_ids := array_append(v_product_ids, v_product_id);
      END IF;
    ELSE
      IF v_slip_id IS NULL THEN
        INSERT INTO stock_out_slips (
          biller_name, bill_no, sale_channel, status, created_by, created_by_label,
          confirmed_at, client_request_id
        ) VALUES (
          v_biller_name, v_bill_no, p_sale_channel, 'CONFIRMED', p_created_by, v_handler,
          v_now, v_request_id
        )
        RETURNING * INTO v_slip;
        v_slip_id := v_slip.id;
      END IF;

      UPDATE inventory_logs
      SET
        stock_out_slip_id = v_slip_id,
        sale_channel = COALESCE(sale_channel, p_sale_channel)
      WHERE stock_unit_id = (v_action ->> 'unitId')::UUID
        AND transaction_type = 'STOCK_OUT'
        AND stock_out_slip_id IS NULL;

      IF v_biller_name IS NOT NULL OR v_bill_no IS NOT NULL THEN
        UPDATE stock_units
        SET
          sold_to_customer_name = COALESCE(v_biller_name, sold_to_customer_name),
          sold_bill_number = COALESCE(v_bill_no, sold_bill_number),
          sold_at = COALESCE(sold_at, v_now)
        WHERE id = (v_action ->> 'unitId')::UUID;
      END IF;
    END IF;

    INSERT INTO stock_out_slip_units (
      slip_id, stock_unit_id, product_id, unit_number, bags_moved
    ) VALUES (
      v_slip_id,
      (v_action ->> 'unitId')::UUID,
      (v_action ->> 'productId')::UUID,
      (v_action ->> 'unitNumber')::INT,
      v_bags_qty
    )
    ON CONFLICT (slip_id, stock_unit_id) DO NOTHING;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      INSERT INTO stock_out_slip_lines (slip_id, product_id, bag_count, bale_count)
      VALUES (v_slip_id, (v_action ->> 'productId')::UUID, v_bags_qty, 1)
      ON CONFLICT (slip_id, product_id) DO UPDATE
      SET
        bag_count = stock_out_slip_lines.bag_count + EXCLUDED.bag_count,
        bale_count = stock_out_slip_lines.bale_count + EXCLUDED.bale_count;
    END IF;

    IF NOT (v_result @> jsonb_build_array(v_barcode)) THEN
      v_result := v_result || jsonb_build_array(v_barcode);
    END IF;
  END LOOP;

  IF v_product_ids IS NOT NULL THEN
    FOREACH v_product_id IN ARRAY v_product_ids
    LOOP
      PERFORM sync_product_total_stock(v_product_id);
    END LOOP;
  END IF;

  IF v_slip_id IS NOT NULL AND jsonb_array_length(v_result) > 0 THEN
    UPDATE stock_out_slips
    SET
      biller_name = COALESCE(biller_name, v_biller_name),
      bill_no = COALESCE(bill_no, v_bill_no),
      client_request_id = COALESCE(client_request_id, v_request_id),
      updated_at = v_now
    WHERE id = v_slip_id;

    v_saved := COALESCE(v_stored, '[]'::JSONB);
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_result)
    LOOP
      IF NOT (v_saved @> jsonb_build_array(v_item #>> '{}')) THEN
        v_saved := v_saved || jsonb_build_array(v_item #>> '{}');
      END IF;
    END LOOP;

    INSERT INTO stock_out_confirm_requests (client_request_id, slip_id, processed_barcodes)
    VALUES (v_request_id, v_slip_id, v_saved)
    ON CONFLICT (client_request_id) DO UPDATE
    SET
      processed_barcodes = EXCLUDED.processed_barcodes,
      slip_id = EXCLUDED.slip_id;
  END IF;

  IF v_fail_count = 0 THEN
    v_message := format(
      'Stock out uploaded · %s label(s) on slip.',
      jsonb_array_length(v_result)
    );
  ELSE
    v_message := format(
      'Could not upload %s bale(s):%s%s',
      v_fail_count,
      v_fail_detail,
      CASE
        WHEN jsonb_array_length(v_result) > 0 THEN
          format(' %s bale(s) were uploaded.', jsonb_array_length(v_result))
        ELSE ' Nothing new was stocked out.'
      END
    );
  END IF;

  RETURN jsonb_build_object(
    'success', v_fail_count = 0 AND jsonb_array_length(v_result) > 0,
    'message', v_message,
    'slipId', v_slip_id,
    'processedBarcodes', v_result
  );
END;
$$;

REVOKE ALL ON FUNCTION confirm_stock_out_slip_batch(TEXT, UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_stock_out_slip_batch(TEXT, UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
