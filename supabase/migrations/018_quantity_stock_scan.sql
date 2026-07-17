-- Quantity-aware stock in/out: partial bags without billing.
-- p_bags_qty NULL = full (stock-in: 1000, stock-out: all remaining).

CREATE OR REPLACE FUNCTION process_unit_stock_transaction(
  p_barcode TEXT,
  p_godown_id UUID,
  p_transaction_type TEXT,
  p_handled_by TEXT DEFAULT 'system',
  p_bags_qty INT DEFAULT NULL
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
  v_bags_per_bale CONSTANT INT := 1000;
  v_qty INT;
  v_prev_remaining INT;
  v_new_remaining INT;
  v_was_sealed BOOLEAN;
  v_effective_godown_id UUID;
BEGIN
  IF v_barcode IS NULL OR v_barcode = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid barcode scanned.');
  END IF;

  IF p_transaction_type NOT IN ('STOCK_IN', 'STOCK_OUT') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid transaction type.');
  END IF;

  IF p_transaction_type = 'STOCK_IN' AND p_godown_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Please select a godown before scanning.');
  END IF;

  SELECT * INTO v_unit FROM stock_units WHERE unit_barcode = v_barcode FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('No unit found for barcode: %s', v_barcode)
    );
  END IF;

  v_effective_godown_id := CASE
    WHEN p_transaction_type = 'STOCK_IN' THEN p_godown_id
    ELSE v_unit.godown_id
  END;

  SELECT * INTO v_godown FROM godowns WHERE id = v_effective_godown_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Godown not found.');
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

    v_qty := COALESCE(p_bags_qty, v_bags_per_bale);
    IF v_qty < 1 OR v_qty > v_bags_per_bale THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Stock-in quantity must be between 1 and %s bags.', v_bags_per_bale),
        'isUnitScan', true
      );
    END IF;

    UPDATE stock_units
    SET
      status = 'STOCKED_IN',
      godown_id = v_effective_godown_id,
      stocked_in_at = v_now,
      remaining_bags = v_qty,
      opened_at = CASE WHEN v_qty < v_bags_per_bale THEN v_now ELSE NULL END
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
      product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
    ) VALUES (
      v_unit.product_id, v_effective_godown_id, 'STOCK_IN', v_qty, v_handler, v_unit.id, 'STOCK_IN'
    );

    PERFORM sync_product_total_stock(v_unit.product_id);
    SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;

  ELSE
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

    IF v_unit.remaining_bags < 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'This bale has no bags remaining.',
        'isUnitScan', true
      );
    END IF;

    v_prev_remaining := v_unit.remaining_bags;
    v_qty := COALESCE(p_bags_qty, v_prev_remaining);
    v_qty := LEAST(v_qty, v_prev_remaining);

    IF v_qty < 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Stock-out quantity must be at least 1 bag.',
        'isUnitScan', true
      );
    END IF;

    v_was_sealed := v_prev_remaining = v_bags_per_bale;
    v_new_remaining := v_prev_remaining - v_qty;

    UPDATE stock_units
    SET
      remaining_bags = v_new_remaining,
      opened_at = CASE
        WHEN v_was_sealed AND v_new_remaining > 0 THEN v_now
        WHEN v_was_sealed AND v_new_remaining = 0 THEN opened_at
        ELSE opened_at
      END,
      status = CASE WHEN v_new_remaining = 0 THEN 'STOCKED_OUT' ELSE 'STOCKED_IN' END,
      stocked_out_at = CASE WHEN v_new_remaining = 0 THEN v_now ELSE stocked_out_at END
    WHERE id = v_unit.id
      AND status = 'STOCKED_IN'
      AND godown_id = v_effective_godown_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Unit was already updated by another scan.',
        'isUnitScan', true
      );
    END IF;

    INSERT INTO inventory_logs (
      product_id, godown_id, transaction_type, quantity, handled_by, stock_unit_id, sale_channel
    ) VALUES (
      v_unit.product_id, v_effective_godown_id, 'STOCK_OUT', v_qty, v_handler, v_unit.id, 'WHOLESALE'
    );

    PERFORM sync_product_total_stock(v_unit.product_id);
    SELECT * INTO v_product FROM products WHERE id = v_unit.product_id;
  END IF;

  SELECT * INTO v_unit FROM stock_units WHERE id = v_unit.id;

  SELECT COALESCE(SUM(remaining_bags), 0)::INT INTO v_godown_stock
  FROM stock_units
  WHERE product_id = v_unit.product_id
    AND godown_id = v_effective_godown_id
    AND status = 'STOCKED_IN';

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE
      WHEN p_transaction_type = 'STOCK_IN' THEN
        format(
          'Stock In: %s — +%s bags (bale #%s, %s)',
          COALESCE(v_product.name, 'Product'),
          v_qty,
          v_unit.unit_number,
          COALESCE(v_batch.source_name, 'batch')
        )
      ELSE
        format(
          'Stock Out: %s — -%s bags (bale #%s)%s',
          COALESCE(v_product.name, 'Product'),
          v_qty,
          v_unit.unit_number,
          CASE WHEN v_unit.remaining_bags > 0
            THEN format(' — %s bags left', v_unit.remaining_bags)
            ELSE ''
          END
        )
    END,
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
