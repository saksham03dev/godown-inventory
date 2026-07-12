-- Phase: Wholesale sold-to snapshot on billed bales
-- Stamps customer onto stock_units at bill finalize so future label scans show buyer.

ALTER TABLE stock_units
  ADD COLUMN IF NOT EXISTS sold_to_customer_name TEXT,
  ADD COLUMN IF NOT EXISTS sold_to_customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS sold_bill_number TEXT,
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

COMMENT ON COLUMN stock_units.sold_to_customer_name IS
  'Wholesale buyer name stamped at bill finalize; immutable for label lookup.';
COMMENT ON COLUMN stock_units.sold_bill_number IS
  'Bill number at finalize for stocked-out bale lookup.';

-- Backfill from already-finalized wholesale bills
UPDATE stock_units u
SET
  sold_to_customer_name = b.customer_name,
  sold_to_customer_phone = b.customer_phone,
  sold_bill_number = b.bill_number,
  sold_at = COALESCE(b.finalized_at, NOW())
FROM bills b
WHERE u.bill_id = b.id
  AND b.status = 'FINALIZED'
  AND u.status = 'STOCKED_OUT'
  AND u.sold_to_customer_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_units_sold_customer
  ON stock_units (sold_to_customer_name)
  WHERE sold_to_customer_name IS NOT NULL;

-- Guard sold-to columns from direct client updates (service_role bypasses)
CREATE OR REPLACE FUNCTION enforce_stock_unit_lifecycle_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT := COALESCE(
    current_setting('request.jwt.claim.role', true),
    current_user
  );
BEGIN
  IF v_role IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'LABELLED'
       AND NEW.godown_id IS NULL
       AND NEW.bill_id IS NULL
       AND NEW.stocked_in_at IS NULL
       AND NEW.stocked_out_at IS NULL
       AND NEW.remaining_bags = 1000
       AND NEW.sold_to_customer_name IS NULL
       AND NEW.sold_bill_number IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Client may only create LABELLED units via label printing';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.godown_id IS DISTINCT FROM OLD.godown_id
       OR NEW.bill_id IS DISTINCT FROM OLD.bill_id
       OR NEW.stocked_in_at IS DISTINCT FROM OLD.stocked_in_at
       OR NEW.stocked_out_at IS DISTINCT FROM OLD.stocked_out_at
       OR NEW.remaining_bags IS DISTINCT FROM OLD.remaining_bags
       OR NEW.opened_at IS DISTINCT FROM OLD.opened_at
       OR NEW.sold_to_customer_name IS DISTINCT FROM OLD.sold_to_customer_name
       OR NEW.sold_to_customer_phone IS DISTINCT FROM OLD.sold_to_customer_phone
       OR NEW.sold_bill_number IS DISTINCT FROM OLD.sold_bill_number
       OR NEW.sold_at IS DISTINCT FROM OLD.sold_at THEN
      RAISE EXCEPTION 'Stock unit lifecycle changes must go through the scan/billing API';
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Atomic finalize: mark bill FINALIZED and stamp sold-to on linked wholesale units
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
  v_stamped INT;
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

  v_name := NULLIF(trim(COALESCE(v_bill.customer_name, '')), '');
  IF v_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Enter customer name before finalizing.'
    );
  END IF;

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

  -- Stamp only wholesale-linked stocked-out units (sale_channel WHOLESALE or null legacy)
  UPDATE stock_units u
  SET
    sold_to_customer_name = v_name,
    sold_to_customer_phone = NULLIF(trim(COALESCE(v_bill.customer_phone, '')), ''),
    sold_bill_number = v_bill.bill_number,
    sold_at = v_now
  WHERE u.bill_id = p_bill_id
    AND u.status = 'STOCKED_OUT'
    AND EXISTS (
      SELECT 1 FROM bill_items bi
      WHERE bi.stock_unit_id = u.id
        AND bi.bill_id = p_bill_id
        AND COALESCE(bi.sale_channel, 'WHOLESALE') = 'WHOLESALE'
    );

  GET DIAGNOSTICS v_stamped = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Bill %s finalized.', v_bill.bill_number),
    'billId', p_bill_id,
    'stampedUnits', v_stamped
  );
END;
$$;

REVOKE ALL ON FUNCTION finalize_bill_stamp_sold_to(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_bill_stamp_sold_to(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
