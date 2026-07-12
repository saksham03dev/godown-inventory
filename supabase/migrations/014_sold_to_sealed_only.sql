-- Sold-to stamps only for complete sealed bales (wholesale + retail qty = 1000).
-- Partial retail / open bales (< 1000 bags) never get sold-to and do not require customer name.

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

  -- Complete sealed only: wholesale lines, or retail lines of exactly 1000 bags
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
  v_total := GREATEST(0, v_subtotal + v_tax - v_bill.discount);

  UPDATE bills
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax,
    total = v_total,
    customer_name = v_name,
    status = 'FINALIZED',
    finalized_at = v_now
  WHERE id = p_bill_id;

  -- Wholesale: sealed stocked-out bales linked via bill_id
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

  -- Retail: only complete sealed sales (one line = 1000 bags → bale emptied)
  -- Do not stamp open/partial lines (quantity < 1000).
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

REVOKE ALL ON FUNCTION finalize_bill_stamp_sold_to(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_bill_stamp_sold_to(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
