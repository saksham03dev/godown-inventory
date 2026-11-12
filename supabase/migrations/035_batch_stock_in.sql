-- Background stock-in batches. The phone accepts a label locally, then uploads
-- a few bales in one transaction. The same upload id can be retried after a
-- dropped reply without stocking a bale in twice.

CREATE TABLE IF NOT EXISTS stock_in_confirm_requests (
  client_request_id TEXT PRIMARY KEY,
  godown_id UUID NOT NULL REFERENCES godowns(id),
  processed_barcodes JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_in_confirm_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE stock_in_confirm_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE stock_in_confirm_requests TO service_role;

CREATE OR REPLACE FUNCTION confirm_stock_in_batch(
  p_client_request_id TEXT,
  p_godown_id UUID,
  p_handled_by TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id TEXT := NULLIF(trim(COALESCE(p_client_request_id, '')), '');
  v_handler TEXT := COALESCE(NULLIF(trim(COALESCE(p_handled_by, '')), ''), 'system');
  v_now TIMESTAMPTZ := NOW();
  v_bags_per_bale CONSTANT INT := 1000;
  v_item JSONB;
  v_barcode TEXT;
  v_bags_qty INT;
  v_barcodes TEXT[] := ARRAY[]::TEXT[];
  v_items JSONB := '[]'::JSONB;
  v_stored JSONB := '[]'::JSONB;
  v_saved JSONB := '[]'::JSONB;
  v_failed JSONB := '[]'::JSONB;
  v_unit stock_units%ROWTYPE;
  v_godown godowns%ROWTYPE;
  v_updated INT;
  v_product_ids UUID[] := ARRAY[]::UUID[];
  v_product_id UUID;
  v_covers BOOLEAN := FALSE;
BEGIN
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing upload ID.');
  END IF;

  IF p_godown_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pick a warehouse first.');
  END IF;

  SELECT * INTO v_godown FROM godowns WHERE id = p_godown_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Godown not found.');
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No bales to stock in.');
  END IF;

  IF jsonb_array_length(p_items) > 12 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Too many bales in one upload.');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_barcode := trim(COALESCE(v_item ->> 'barcode', ''));
    IF v_barcode = '' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Each line needs a barcode.');
    END IF;
    IF v_barcode = ANY(v_barcodes) THEN
      RETURN jsonb_build_object('success', false, 'message', format('Duplicate barcode in upload: %s', v_barcode));
    END IF;
    IF COALESCE(v_item ->> 'bagsQty', '') !~ '^[0-9]+$' THEN
      RETURN jsonb_build_object('success', false, 'message', format('Invalid bag qty for %s.', v_barcode));
    END IF;
    v_bags_qty := (v_item ->> 'bagsQty')::INT;
    IF v_bags_qty < 1 OR v_bags_qty > v_bags_per_bale THEN
      RETURN jsonb_build_object('success', false, 'message', format('Invalid bag qty for %s (1–1000).', v_barcode));
    END IF;
    v_barcodes := array_append(v_barcodes, v_barcode);
    v_items := v_items || jsonb_build_array(jsonb_build_object('barcode', v_barcode, 'bagsQty', v_bags_qty));
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtext('stock-in:' || v_request_id));

  SELECT processed_barcodes INTO v_stored
  FROM stock_in_confirm_requests
  WHERE client_request_id = v_request_id;

  v_stored := COALESCE(v_stored, '[]'::JSONB);

  v_covers := TRUE;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    IF NOT (v_stored @> jsonb_build_array(v_item ->> 'barcode')) THEN
      v_covers := FALSE;
      EXIT;
    END IF;
  END LOOP;

  IF v_covers AND jsonb_array_length(v_stored) > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Stock in was already uploaded.',
      'savedBarcodes', (
        SELECT COALESCE(jsonb_agg(value ->> 'barcode'), '[]'::JSONB)
        FROM jsonb_array_elements(v_items)
      ),
      'failed', '[]'::JSONB
    );
  END IF;

  FOR v_unit IN
    SELECT * FROM stock_units
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

    IF v_stored @> jsonb_build_array(v_barcode) THEN
      v_saved := v_saved || jsonb_build_array(v_barcode);
      CONTINUE;
    END IF;

    SELECT * INTO v_unit FROM stock_units WHERE unit_barcode = v_barcode;
    IF NOT FOUND THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object('barcode', v_barcode, 'message', 'Unknown barcode.'));
      CONTINUE;
    END IF;

    IF v_unit.status <> 'LABELLED' THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'barcode', v_barcode,
        'message', format('Unit already %s.', lower(replace(v_unit.status, '_', ' ')))
      ));
      CONTINUE;
    END IF;

    UPDATE stock_units
    SET
      status = 'STOCKED_IN',
      godown_id = p_godown_id,
      stocked_in_at = v_now,
      remaining_bags = v_bags_qty,
      opened_at = CASE WHEN v_bags_qty < v_bags_per_bale THEN v_now ELSE NULL END
    WHERE id = v_unit.id AND status = 'LABELLED';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'barcode', v_barcode,
        'message', 'Unit was already stocked in by another scan.'
      ));
      CONTINUE;
    END IF;

    INSERT INTO inventory_logs (
      product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
    ) VALUES (
      v_unit.product_id, p_godown_id, 'STOCK_IN', v_bags_qty, v_handler, v_unit.id, 'STOCK_IN'
    );

    IF NOT (v_unit.product_id = ANY(v_product_ids)) THEN
      v_product_ids := array_append(v_product_ids, v_unit.product_id);
    END IF;
    v_saved := v_saved || jsonb_build_array(v_barcode);
  END LOOP;

  IF v_product_ids IS NOT NULL THEN
    FOREACH v_product_id IN ARRAY v_product_ids
    LOOP
      PERFORM sync_product_total_stock(v_product_id);
    END LOOP;
  END IF;

  IF jsonb_array_length(v_saved) > 0 THEN
    v_stored := COALESCE(v_stored, '[]'::JSONB);
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_saved)
    LOOP
      IF NOT (v_stored @> jsonb_build_array(v_item #>> '{}')) THEN
        v_stored := v_stored || jsonb_build_array(v_item #>> '{}');
      END IF;
    END LOOP;

    INSERT INTO stock_in_confirm_requests (client_request_id, godown_id, processed_barcodes)
    VALUES (v_request_id, p_godown_id, v_stored)
    ON CONFLICT (client_request_id) DO UPDATE
    SET processed_barcodes = EXCLUDED.processed_barcodes;
  END IF;

  RETURN jsonb_build_object(
    'success', jsonb_array_length(v_failed) = 0 AND jsonb_array_length(v_saved) > 0,
    'message', CASE
      WHEN jsonb_array_length(v_failed) = 0 THEN format('Stocked in %s label(s).', jsonb_array_length(v_saved))
      WHEN jsonb_array_length(v_saved) = 0 THEN 'Could not stock in these labels.'
      ELSE format('Stocked in %s label(s). %s could not be saved.', jsonb_array_length(v_saved), jsonb_array_length(v_failed))
    END,
    'savedBarcodes', v_saved,
    'failed', v_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION confirm_stock_in_batch(TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_stock_in_batch(TEXT, UUID, TEXT, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
