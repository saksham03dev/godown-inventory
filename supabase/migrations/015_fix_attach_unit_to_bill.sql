-- Fix typo in attach_unit_to_bill: p_bill.id → p_bill_id
-- Caused: "missing FROM-clause entry for table p_bill" on Pending Sales attach

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
    v_bags_per_bale,
    v_price,
    v_line_total,
    'WHOLESALE'
  )
  RETURNING * INTO v_item;

  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM bill_items WHERE bill_id = p_bill_id;

  v_tax := ROUND(v_subtotal * v_bill.tax_percent / 100, 2);
  v_total := GREATEST(0, ROUND(v_subtotal + v_tax - v_bill.discount, 2));

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

REVOKE ALL ON FUNCTION attach_unit_to_bill(UUID, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION attach_unit_to_bill(UUID, TEXT, NUMERIC) TO service_role;

NOTIFY pgrst, 'reload schema';
