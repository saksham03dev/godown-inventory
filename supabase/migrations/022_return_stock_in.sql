-- Return stock: restore bags via STOCK_IN audit with sale_channel RETURN.

CREATE TABLE IF NOT EXISTS stock_return_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_unit_id UUID NOT NULL REFERENCES stock_units (id) ON DELETE CASCADE,
  godown_id UUID NOT NULL REFERENCES godowns (id) ON DELETE RESTRICT,
  bags_qty INT NOT NULL CHECK (bags_qty > 0 AND bags_qty <= 1000),
  reason TEXT,
  handled_by TEXT NOT NULL DEFAULT 'system',
  original_bill_id UUID REFERENCES bills (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_return_events_unit ON stock_return_events (stock_unit_id);
CREATE INDEX IF NOT EXISTS idx_stock_return_events_created ON stock_return_events (created_at DESC);

ALTER TABLE stock_return_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE stock_return_events FROM anon, authenticated;
GRANT ALL ON TABLE stock_return_events TO service_role;

CREATE OR REPLACE FUNCTION process_return_stock_in(
  p_barcode TEXT,
  p_godown_id UUID,
  p_bags_qty INT DEFAULT NULL,
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
  v_godown godowns%ROWTYPE;
  v_bill bills%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_handler TEXT := NULLIF(trim(COALESCE(p_handled_by, '')), '');
  v_bags_per_bale CONSTANT INT := 1000;
  v_qty INT;
  v_new_remaining INT;
  v_updated INT;
  v_godown_stock INT;
  v_original_bill_id UUID;
BEGIN
  IF v_barcode IS NULL OR v_barcode = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid barcode scanned.');
  END IF;

  IF p_godown_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Please select a godown for returned stock.');
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

  IF v_unit.status = 'LABELLED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Use Stock In for new labels. This bale has not been received yet.',
      'isUnitScan', true
    );
  END IF;

  v_handler := COALESCE(v_handler, 'system');
  v_qty := COALESCE(p_bags_qty, v_bags_per_bale);

  IF v_qty < 1 OR v_qty > v_bags_per_bale THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Return quantity must be between 1 and %s bags.', v_bags_per_bale),
      'isUnitScan', true
    );
  END IF;

  IF v_unit.bill_id IS NOT NULL THEN
    SELECT * INTO v_bill FROM bills WHERE id = v_unit.bill_id;
    IF FOUND AND v_bill.status = 'DRAFT' THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Remove this bale from the open draft bill before processing a return.',
        'isUnitScan', true
      );
    END IF;
  END IF;

  IF v_unit.status = 'STOCKED_OUT' THEN
    v_original_bill_id := v_unit.bill_id;

    IF v_qty > v_bags_per_bale THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Cannot return more than %s bags to an empty bale.', v_bags_per_bale),
        'isUnitScan', true
      );
    END IF;

    UPDATE stock_units
    SET
      status = 'STOCKED_IN',
      godown_id = p_godown_id,
      remaining_bags = v_qty,
      stocked_out_at = NULL,
      stocked_in_at = COALESCE(stocked_in_at, v_now),
      opened_at = CASE WHEN v_qty < v_bags_per_bale THEN COALESCE(opened_at, v_now) ELSE NULL END,
      bill_id = NULL,
      sold_to_customer_name = NULL,
      sold_to_customer_phone = NULL,
      sold_bill_number = NULL,
      sold_at = NULL
    WHERE id = v_unit.id AND status = 'STOCKED_OUT';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Return failed — bale status changed during processing.',
        'isUnitScan', true
      );
    END IF;

    v_new_remaining := v_qty;

  ELSE
    v_original_bill_id := v_unit.bill_id;

    -- STOCKED_IN open or sealed bale: add bags back
    IF v_unit.remaining_bags >= v_bags_per_bale THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'This bale is already full. Cannot add more bags.',
        'isUnitScan', true
      );
    END IF;

    v_new_remaining := LEAST(v_bags_per_bale, v_unit.remaining_bags + v_qty);
    IF v_new_remaining = v_unit.remaining_bags THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Return quantity would not increase stock on this bale.',
        'isUnitScan', true
      );
    END IF;

    v_qty := v_new_remaining - v_unit.remaining_bags;

    UPDATE stock_units
    SET
      remaining_bags = v_new_remaining,
      godown_id = p_godown_id,
      status = 'STOCKED_IN',
      stocked_out_at = NULL,
      opened_at = CASE
        WHEN v_new_remaining < v_bags_per_bale THEN COALESCE(opened_at, v_now)
        ELSE NULL
      END
    WHERE id = v_unit.id AND status = 'STOCKED_IN';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Return failed — bale was updated by another operation.',
        'isUnitScan', true
      );
    END IF;
  END IF;

  INSERT INTO inventory_logs (
    product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
  ) VALUES (
    v_unit.product_id, p_godown_id, 'STOCK_IN', v_qty, v_handler, v_unit.id, 'RETURN'
  );

  INSERT INTO stock_return_events (
    stock_unit_id, godown_id, bags_qty, reason, handled_by, original_bill_id
  ) VALUES (
    v_unit.id, p_godown_id, v_qty, NULLIF(trim(COALESCE(p_reason, '')), ''), v_handler, v_original_bill_id
  );

  PERFORM sync_product_total_stock(v_unit.product_id);

  SELECT * INTO v_unit FROM stock_units WHERE id = v_unit.id;
  SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  SELECT * INTO v_batch FROM stock_batches WHERE id = v_unit.batch_id;

  SELECT COALESCE(SUM(remaining_bags), 0)::INT INTO v_godown_stock
  FROM stock_units
  WHERE product_id = v_unit.product_id
    AND godown_id = p_godown_id
    AND status = 'STOCKED_IN';

  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Return: %s — +%s bags to %s (bale #%s, %s bags now in bale)',
      COALESCE(v_product.name, 'Product'),
      v_qty,
      v_godown.location_name,
      v_unit.unit_number,
      v_unit.remaining_bags
    ),
    'isUnitScan', true,
    'bagsMoved', v_qty,
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
        'source_name', v_batch.source_name
      ),
      'godowns', jsonb_build_object(
        'id', v_godown.id,
        'location_name', v_godown.location_name
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION process_return_stock_in(TEXT, UUID, INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_return_stock_in(TEXT, UUID, INT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
