-- Godown inventory queries: filter by location + in-stock status
CREATE INDEX IF NOT EXISTS idx_units_godown_status
  ON stock_units (godown_id, status);

-- Audit log lookups by product within a godown (reports, not qty source)
CREATE INDEX IF NOT EXISTS idx_logs_product_godown
  ON inventory_logs (product_id, godown_id);

-- Optional: keep products.total_stock aligned with in-warehouse units
-- (denormalized cache; STOCKED_IN counts are the warehouse truth)
CREATE OR REPLACE FUNCTION sync_product_total_stock(p_product_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_count
  FROM stock_units
  WHERE product_id = p_product_id
    AND status = 'STOCKED_IN';

  UPDATE products SET total_stock = v_count WHERE id = p_product_id;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION sync_product_total_stock(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sync_product_total_stock(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
