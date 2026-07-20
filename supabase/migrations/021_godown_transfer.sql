-- Godown transfer for sealed full bales + extend sale_channel for TRANSFER/RETURN.

ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_sale_channel_check;
ALTER TABLE inventory_logs
  ADD CONSTRAINT inventory_logs_sale_channel_check
  CHECK (
    sale_channel IS NULL
    OR sale_channel IN ('STOCK_IN', 'WHOLESALE', 'RETAIL', 'TRANSFER', 'RETURN')
  );

ALTER TABLE bill_items DROP CONSTRAINT IF EXISTS bill_items_sale_channel_check;
ALTER TABLE bill_items
  ADD CONSTRAINT bill_items_sale_channel_check
  CHECK (
    sale_channel IS NULL
    OR sale_channel IN ('WHOLESALE', 'RETAIL', 'TRANSFER', 'RETURN')
  );

CREATE OR REPLACE FUNCTION transfer_sealed_bale(
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
  v_now TIMESTAMPTZ := NOW();
  v_handler TEXT := NULLIF(trim(COALESCE(p_handled_by, '')), '');
  v_bags_per_bale CONSTANT INT := 1000;
  v_updated INT;
  v_dest_stock INT;
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

  IF v_unit.status <> 'STOCKED_IN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Bale must be stocked in. Current status: %s.', lower(replace(v_unit.status, '_', ' '))),
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
  SET godown_id = p_to_godown_id
  WHERE id = v_unit.id
    AND status = 'STOCKED_IN'
    AND remaining_bags = v_bags_per_bale
    AND godown_id = p_from_godown_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Transfer failed — bale was updated by another operation.',
      'isUnitScan', true
    );
  END IF;

  INSERT INTO inventory_logs (
    product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
  ) VALUES
    (v_unit.product_id, p_from_godown_id, 'STOCK_OUT', v_bags_per_bale, v_handler, v_unit.id, 'TRANSFER'),
    (v_unit.product_id, p_to_godown_id, 'STOCK_IN', v_bags_per_bale, v_handler, v_unit.id, 'TRANSFER');

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
      'Transferred bale #%s (%s) from %s to %s.',
      v_unit.unit_number,
      COALESCE(v_product.name, 'Product'),
      v_from.location_name,
      v_to.location_name
    ),
    'isUnitScan', true,
    'bagsMoved', v_bags_per_bale,
    'newGodownStock', v_dest_stock,
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

REVOKE ALL ON FUNCTION transfer_sealed_bale(TEXT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transfer_sealed_bale(TEXT, UUID, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
