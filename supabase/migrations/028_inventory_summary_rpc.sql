-- Aggregated inventory summary (bags per product per godown) for fast inventory views.

CREATE OR REPLACE FUNCTION get_inventory_stock_summary(p_godown_id uuid DEFAULT NULL)
RETURNS TABLE (
  product_id uuid,
  godown_id uuid,
  godown_name text,
  total_bags numeric,
  open_bales bigint,
  product_name text,
  product_code text,
  barcode_id text,
  size text,
  quality text,
  category text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    su.product_id,
    su.godown_id,
    g.location_name AS godown_name,
    COALESCE(SUM(su.remaining_bags), 0) AS total_bags,
    COUNT(*) FILTER (
      WHERE su.remaining_bags > 0 AND su.remaining_bags < 1000
    )::bigint AS open_bales,
    p.name AS product_name,
    p.product_code,
    p.barcode_id,
    p.size,
    p.quality,
    p.category
  FROM stock_units su
  INNER JOIN products p ON p.id = su.product_id
  LEFT JOIN godowns g ON g.id = su.godown_id
  WHERE su.status = 'STOCKED_IN'
    AND su.godown_id IS NOT NULL
    AND (p_godown_id IS NULL OR su.godown_id = p_godown_id)
  GROUP BY
    su.product_id,
    su.godown_id,
    g.location_name,
    p.name,
    p.product_code,
    p.barcode_id,
    p.size,
    p.quality,
    p.category
  ORDER BY p.name, g.location_name;
$$;

REVOKE ALL ON FUNCTION get_inventory_stock_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_inventory_stock_summary(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
