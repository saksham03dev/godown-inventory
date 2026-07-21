-- Manual godown correction when a bale was stocked in at the wrong warehouse.

ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_sale_channel_check;
ALTER TABLE inventory_logs
  ADD CONSTRAINT inventory_logs_sale_channel_check
  CHECK (
    sale_channel IS NULL
    OR sale_channel IN ('STOCK_IN', 'WHOLESALE', 'RETAIL', 'TRANSFER', 'RETURN', 'CORRECTION')
  );

CREATE OR REPLACE FUNCTION correct_unit_godown(
  p_barcode TEXT,
  p_to_godown_id UUID,
  p_handled_by TEXT DEFAULT 'system',
  p_reason TEXT DEFAULT NULL
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
  v_reason TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
  v_qty INT;
  v_updated INT;
  v_godown_stock INT;
BEGIN
  IF v_barcode IS NULL OR v_barcode = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid barcode.');
  END IF;

  IF p_to_godown_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Select the correct godown.');
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

  IF v_unit.status <> 'STOCKED_IN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format(
        'Only stocked-in bales can be relocated. Current status: %s.',
        lower(replace(v_unit.status, '_', ' '))
      ),
      'isUnitScan', true
    );
  END IF;

  IF v_unit.godown_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Bale is not assigned to a godown (may be in transit). Use Transfer receive instead.',
      'isUnitScan', true
    );
  END IF;

  IF v_unit.godown_id = p_to_godown_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Bale is already at %s.', v_to.location_name),
      'isUnitScan', true
    );
  END IF;

  IF v_unit.bill_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Cannot relocate a bale linked to a bill.',
      'isUnitScan', true
    );
  END IF;

  v_qty := COALESCE(v_unit.remaining_bags, 0);
  IF v_qty < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Bale has no remaining bags.',
      'isUnitScan', true
    );
  END IF;

  SELECT * INTO v_from FROM godowns WHERE id = v_unit.godown_id;
  v_handler := COALESCE(v_handler, 'system');

  UPDATE stock_units
  SET
    godown_id = p_to_godown_id,
    transfer_from_godown_id = NULL,
    transfer_to_godown_id = NULL,
    transfer_dispatched_at = NULL
  WHERE id = v_unit.id
    AND status = 'STOCKED_IN'
    AND godown_id = v_from.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Relocation failed — bale was updated by another operation.',
      'isUnitScan', true
    );
  END IF;

  INSERT INTO inventory_logs (
    product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
  ) VALUES (
    v_unit.product_id, v_from.id, 'STOCK_OUT', v_qty, v_handler, v_unit.id, 'CORRECTION'
  );

  INSERT INTO inventory_logs (
    product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
  ) VALUES (
    v_unit.product_id, p_to_godown_id, 'STOCK_IN', v_qty, v_handler, v_unit.id, 'CORRECTION'
  );

  PERFORM sync_product_total_stock(v_unit.product_id);

  SELECT * INTO v_unit FROM stock_units WHERE id = v_unit.id;
  SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  SELECT * INTO v_batch FROM stock_batches WHERE id = v_unit.batch_id;

  SELECT COALESCE(SUM(remaining_bags), 0)::INT INTO v_godown_stock
  FROM stock_units
  WHERE product_id = v_unit.product_id
    AND godown_id = p_to_godown_id
    AND status = 'STOCKED_IN';

  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Corrected location: bale #%s moved from %s to %s (%s bags)%s',
      v_unit.unit_number,
      v_from.location_name,
      v_to.location_name,
      v_qty,
      CASE WHEN v_reason IS NOT NULL THEN format(' — %s', v_reason) ELSE '' END
    ),
    'isUnitScan', true,
    'bagsMoved', v_qty,
    'newGodownStock', v_godown_stock,
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

REVOKE ALL ON FUNCTION correct_unit_godown(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION correct_unit_godown(TEXT, UUID, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
