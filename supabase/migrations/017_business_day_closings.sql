-- Business-day closings: finalized bills of a calendar day (Asia/Kolkata) are archived at day end.
-- Drafts / pending stay open across days.

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS business_date DATE;

COMMENT ON COLUMN bills.business_date IS
  'Store-local calendar day (Asia/Kolkata) when bill was finalized. Null while DRAFT.';

CREATE INDEX IF NOT EXISTS idx_bills_business_date
  ON bills (business_date)
  WHERE business_date IS NOT NULL;

-- Backfill finalized bills
UPDATE bills
SET business_date = (finalized_at AT TIME ZONE 'Asia/Kolkata')::date
WHERE status = 'FINALIZED'
  AND finalized_at IS NOT NULL
  AND business_date IS NULL;

CREATE TABLE IF NOT EXISTS daily_bill_closings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_date     DATE NOT NULL UNIQUE,
  closed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by         TEXT,
  bill_count        INT NOT NULL DEFAULT 0,
  wholesale_count   INT NOT NULL DEFAULT 0,
  retail_count      INT NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labour_total      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  transport_total   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_closings_date
  ON daily_bill_closings (business_date DESC);

ALTER TABLE daily_bill_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_bill_closings_select_all" ON daily_bill_closings;
CREATE POLICY "daily_bill_closings_select_all" ON daily_bill_closings
  FOR SELECT USING (true);

-- Stamp business_date on finalize (extend existing finalize RPC)
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
  v_biz_date DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
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
  v_total := GREATEST(
    0,
    v_subtotal + v_tax + COALESCE(v_bill.labour_cost, 0)
      + COALESCE(v_bill.transportation_cost, 0) - v_bill.discount
  );

  UPDATE bills
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax,
    total = v_total,
    customer_name = v_name,
    status = 'FINALIZED',
    finalized_at = v_now,
    business_date = v_biz_date
  WHERE id = p_bill_id;

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
    'needsSoldTo', v_needs_sold_to,
    'businessDate', v_biz_date
  );
END;
$$;

-- Close one business day: snapshot finalized bills into daily_bill_closings
CREATE OR REPLACE FUNCTION close_business_day(
  p_business_date DATE,
  p_closed_by TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_count INT := 0;
  v_wholesale INT := 0;
  v_retail INT := 0;
  v_total NUMERIC(12, 2) := 0;
  v_labour NUMERIC(12, 2) := 0;
  v_transport NUMERIC(12, 2) := 0;
  v_id UUID;
BEGIN
  IF p_business_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Business date is required.');
  END IF;

  IF p_business_date >= v_today THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Cannot close today or a future day. Wait until the next calendar day.'
    );
  END IF;

  IF EXISTS (SELECT 1 FROM daily_bill_closings WHERE business_date = p_business_date) THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', format('Day %s already closed.', p_business_date),
      'alreadyClosed', true,
      'businessDate', p_business_date
    );
  END IF;

  -- Ensure all finalized bills that day have business_date set
  UPDATE bills
  SET business_date = p_business_date
  WHERE status = 'FINALIZED'
    AND business_date IS NULL
    AND finalized_at IS NOT NULL
    AND (finalized_at AT TIME ZONE 'Asia/Kolkata')::date = p_business_date;

  SELECT
    COUNT(*)::INT,
    COALESCE(SUM(total), 0),
    COALESCE(SUM(labour_cost), 0),
    COALESCE(SUM(transportation_cost), 0)
  INTO v_count, v_total, v_labour, v_transport
  FROM bills
  WHERE status = 'FINALIZED' AND business_date = p_business_date;

  SELECT COUNT(DISTINCT b.id)::INT INTO v_wholesale
  FROM bills b
  JOIN bill_items bi ON bi.bill_id = b.id
  WHERE b.status = 'FINALIZED'
    AND b.business_date = p_business_date
    AND COALESCE(bi.sale_channel, 'WHOLESALE') = 'WHOLESALE';

  SELECT COUNT(DISTINCT b.id)::INT INTO v_retail
  FROM bills b
  JOIN bill_items bi ON bi.bill_id = b.id
  WHERE b.status = 'FINALIZED'
    AND b.business_date = p_business_date
    AND bi.sale_channel = 'RETAIL';

  INSERT INTO daily_bill_closings (
    business_date, closed_by, bill_count, wholesale_count, retail_count,
    total_amount, labour_total, transport_total
  ) VALUES (
    p_business_date,
    NULLIF(trim(COALESCE(p_closed_by, '')), ''),
    v_count,
    v_wholesale,
    v_retail,
    v_total,
    v_labour,
    v_transport
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Closed %s — %s finalized bill(s), total ₹%s.',
      p_business_date, v_count, v_total
    ),
    'closingId', v_id,
    'businessDate', p_business_date,
    'billCount', v_count,
    'totalAmount', v_total
  );
END;
$$;

-- Auto-close every past day that has finalized bills but no closing yet
CREATE OR REPLACE FUNCTION ensure_past_business_days_closed(
  p_closed_by TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_day DATE;
  v_closed INT := 0;
  v_result JSONB;
BEGIN
  -- Backfill business_date for any stray finalized bills
  UPDATE bills
  SET business_date = (finalized_at AT TIME ZONE 'Asia/Kolkata')::date
  WHERE status = 'FINALIZED'
    AND finalized_at IS NOT NULL
    AND business_date IS NULL;

  FOR v_day IN
    SELECT DISTINCT business_date
    FROM bills
    WHERE status = 'FINALIZED'
      AND business_date IS NOT NULL
      AND business_date < v_today
      AND business_date NOT IN (SELECT business_date FROM daily_bill_closings)
    ORDER BY business_date
  LOOP
    v_result := close_business_day(v_day, p_closed_by);
    IF (v_result->>'success')::boolean THEN
      v_closed := v_closed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Ensured past days closed (%s newly closed).', v_closed),
    'closedCount', v_closed,
    'today', v_today
  );
END;
$$;

REVOKE ALL ON FUNCTION close_business_day(DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION ensure_past_business_days_closed(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION close_business_day(DATE, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION ensure_past_business_days_closed(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION finalize_bill_stamp_sold_to(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
