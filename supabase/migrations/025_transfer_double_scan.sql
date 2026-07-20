-- Two-step godown transfer: dispatch (scan at source) then receive (scan at destination).

ALTER TABLE stock_units DROP CONSTRAINT IF EXISTS stock_units_status_check;
ALTER TABLE stock_units
  ADD CONSTRAINT stock_units_status_check
  CHECK (status IN ('LABELLED', 'STOCKED_IN', 'STOCKED_OUT', 'IN_TRANSIT'));

ALTER TABLE stock_units
  ADD COLUMN IF NOT EXISTS transfer_from_godown_id UUID REFERENCES godowns (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_to_godown_id UUID REFERENCES godowns (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_dispatched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_units_in_transit
  ON stock_units (transfer_to_godown_id)
  WHERE status = 'IN_TRANSIT';

CREATE OR REPLACE FUNCTION dispatch_transfer_bale(
  p_barcode TEXT,
  p_from_godown_id UUID,
  p_to_godown_id UUID,
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
  v_from godowns%ROWTYPE;
  v_to godowns%ROWTYPE;
  v_handler TEXT := NULLIF(trim(COALESCE(p_handled_by, '')), '');
  v_bags_per_bale CONSTANT INT := 1000;
  v_updated INT;
BEGIN
  IF v_barcode IS NULL OR v_barcode = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid barcode scanned.');
  END IF;

  IF p_from_godown_id IS NULL OR p_to_godown_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Select both source and destination godowns.');
  END IF;

  IF p_from_godown_id = p_to_godown_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Source and destination godowns must differ.');
  END IF;

  SELECT * INTO v_from FROM godowns WHERE id = p_from_godown_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Source godown not found.');
  END IF;

  SELECT * INTO v_to FROM godowns WHERE id = p_to_godown_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Destination godown not found.');
  END IF;

  SELECT * INTO v_unit FROM stock_units WHERE unit_barcode = v_barcode FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('No unit found for barcode: %s', v_barcode)
    );
  END IF;

  IF v_unit.status = 'IN_TRANSIT' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Bale is already dispatched — scan at the destination godown to receive.',
      'isUnitScan', true
    );
  END IF;

  IF v_unit.status <> 'STOCKED_IN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Bale must be stocked in at source. Current status: %s.', lower(replace(v_unit.status, '_', ' '))),
      'isUnitScan', true
    );
  END IF;

  IF v_unit.remaining_bags <> v_bags_per_bale OR v_unit.opened_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only sealed full bales (1,000 bags, unopened) can be transferred.',
      'isUnitScan', true
    );
  END IF;

  IF v_unit.godown_id IS DISTINCT FROM p_from_godown_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Bale is not at %s.', v_from.location_name),
      'isUnitScan', true
    );
  END IF;

  v_handler := COALESCE(v_handler, 'system');

  UPDATE stock_units
  SET
    status = 'IN_TRANSIT',
    godown_id = NULL,
    transfer_from_godown_id = p_from_godown_id,
    transfer_to_godown_id = p_to_godown_id,
    transfer_dispatched_at = NOW()
  WHERE id = v_unit.id
    AND status = 'STOCKED_IN'
    AND remaining_bags = v_bags_per_bale
    AND godown_id = p_from_godown_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Dispatch failed — bale was updated by another operation.',
      'isUnitScan', true
    );
  END IF;

  INSERT INTO inventory_logs (
    product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
  ) VALUES (
    v_unit.product_id, p_from_godown_id, 'STOCK_OUT', v_bags_per_bale, v_handler, v_unit.id, 'TRANSFER'
  );

  PERFORM sync_product_total_stock(v_unit.product_id);

  SELECT * INTO v_unit FROM stock_units WHERE id = v_unit.id;
  SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  SELECT * INTO v_batch FROM stock_batches WHERE id = v_unit.batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Dispatched bale #%s (%s) from %s → scan again at %s to receive.',
      v_unit.unit_number,
      COALESCE(v_product.name, 'Product'),
      v_from.location_name,
      v_to.location_name
    ),
    'isUnitScan', true,
    'bagsMoved', v_bags_per_bale,
    'transferPhase', 'dispatch',
    'product', to_jsonb(v_product),
    'stockUnit', to_jsonb(v_unit) || jsonb_build_object(
      'products', jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'product_code', v_product.product_code
      ),
      'stock_batches', jsonb_build_object(
        'id', v_batch.id,
        'batch_code', v_batch.batch_code,
        'source_name', v_batch.source_name
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION receive_transfer_bale(
  p_barcode TEXT,
  p_to_godown_id UUID,
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
  v_from godowns%ROWTYPE;
  v_to godowns%ROWTYPE;
  v_handler TEXT := NULLIF(trim(COALESCE(p_handled_by, '')), '');
  v_bags_per_bale CONSTANT INT := 1000;
  v_updated INT;
  v_dest_stock INT;
BEGIN
  IF v_barcode IS NULL OR v_barcode = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid barcode scanned.');
  END IF;

  IF p_to_godown_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Select the destination godown.');
  END IF;

  SELECT * INTO v_to FROM godowns WHERE id = p_to_godown_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Destination godown not found.');
  END IF;

  SELECT * INTO v_unit FROM stock_units WHERE unit_barcode = v_barcode FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('No unit found for barcode: %s', v_barcode)
    );
  END IF;

  IF v_unit.status <> 'IN_TRANSIT' THEN
    IF v_unit.status = 'STOCKED_IN' AND v_unit.godown_id = p_to_godown_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Bale is already stocked in at this godown.',
        'isUnitScan', true
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Bale is not in transit — scan at the source godown first.',
      'isUnitScan', true
    );
  END IF;

  IF v_unit.transfer_to_godown_id IS DISTINCT FROM p_to_godown_id THEN
    SELECT * INTO v_from FROM godowns WHERE id = v_unit.transfer_to_godown_id;
    RETURN jsonb_build_object(
      'success', false,
      'message', format(
        'This bale is in transit to %s, not %s.',
        COALESCE(v_from.location_name, 'another godown'),
        v_to.location_name
      ),
      'isUnitScan', true
    );
  END IF;

  SELECT * INTO v_from FROM godowns WHERE id = v_unit.transfer_from_godown_id;
  v_handler := COALESCE(v_handler, 'system');

  UPDATE stock_units
  SET
    status = 'STOCKED_IN',
    godown_id = p_to_godown_id,
    transfer_from_godown_id = NULL,
    transfer_to_godown_id = NULL,
    transfer_dispatched_at = NULL
  WHERE id = v_unit.id
    AND status = 'IN_TRANSIT'
    AND transfer_to_godown_id = p_to_godown_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Receive failed — bale was updated by another operation.',
      'isUnitScan', true
    );
  END IF;

  INSERT INTO inventory_logs (
    product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
  ) VALUES (
    v_unit.product_id, p_to_godown_id, 'STOCK_IN', v_bags_per_bale, v_handler, v_unit.id, 'TRANSFER'
  );

  PERFORM sync_product_total_stock(v_unit.product_id);

  SELECT * INTO v_unit FROM stock_units WHERE id = v_unit.id;
  SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  SELECT * INTO v_batch FROM stock_batches WHERE id = v_unit.batch_id;

  SELECT COALESCE(SUM(remaining_bags), 0)::INT INTO v_dest_stock
  FROM stock_units
  WHERE product_id = v_unit.product_id
    AND godown_id = p_to_godown_id
    AND status = 'STOCKED_IN';

  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Received bale #%s (%s) at %s%s.',
      v_unit.unit_number,
      COALESCE(v_product.name, 'Product'),
      v_to.location_name,
      CASE
        WHEN v_from.location_name IS NOT NULL
        THEN format(' (from %s)', v_from.location_name)
        ELSE ''
      END
    ),
    'isUnitScan', true,
    'bagsMoved', v_bags_per_bale,
    'newGodownStock', v_dest_stock,
    'transferPhase', 'receive',
    'product', to_jsonb(v_product),
    'stockUnit', to_jsonb(v_unit) || jsonb_build_object(
      'products', jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'product_code', v_product.product_code
      ),
      'stock_batches', jsonb_build_object(
        'id', v_batch.id,
        'batch_code', v_batch.batch_code,
        'source_name', v_batch.source_name
      ),
      'godowns', jsonb_build_object(
        'id', v_to.id,
        'location_name', v_to.location_name
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION dispatch_transfer_bale(TEXT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispatch_transfer_bale(TEXT, UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION receive_transfer_bale(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION receive_transfer_bale(TEXT, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
