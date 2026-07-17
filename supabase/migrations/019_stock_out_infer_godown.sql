-- Stock Out scans infer the bale's current godown, so bulk dispatch needs no
-- godown selector. Keep the quantity-aware implementation from migration 018
-- behind a renamed internal function and expose a stable wrapper.

ALTER FUNCTION process_unit_stock_transaction(TEXT, UUID, TEXT, TEXT, INT)
  RENAME TO process_unit_stock_transaction_at_godown;

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
  v_effective_godown_id UUID := p_godown_id;
BEGIN
  IF p_transaction_type = 'STOCK_OUT' AND v_effective_godown_id IS NULL THEN
    SELECT godown_id
    INTO v_effective_godown_id
    FROM stock_units
    WHERE unit_barcode = trim(p_barcode);
  END IF;

  RETURN process_unit_stock_transaction_at_godown(
    p_barcode,
    v_effective_godown_id,
    p_transaction_type,
    p_handled_by,
    p_bags_qty
  );
END;
$$;
