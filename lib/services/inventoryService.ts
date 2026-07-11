import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  DashboardMetrics,
  Godown,
  GodownDistribution,
  GodownStockItem,
  InventoryLogWithRelations,
  Product,
  TransactionType,
} from "@/lib/types/database";

type ProductRelation = {
  id: string;
  name: string;
  barcode_id: string;
  product_code: string;
  category: string | null;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatSchemaError(message: string): string {
  if (
    message.includes("product_code") &&
    (message.includes("schema cache") || message.includes("column"))
  ) {
    return (
      "Database is missing the product_code column. Run supabase/migrations/002_product_godown_management.sql in the Supabase SQL Editor, then retry."
    );
  }
  return message;
}

export async function fetchProducts(): Promise<Product[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name");

  if (error) throw new Error(formatSchemaError(error.message));
  return data ?? [];
}

export async function fetchGodowns(): Promise<Godown[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("godowns")
    .select("*")
    .order("location_name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchProductByBarcode(
  barcodeId: string
): Promise<Product | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("barcode_id", barcodeId.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * In-godown stock from stock_units only (STOCKED_IN).
 * inventory_logs are audit trail, not quantity source.
 */
export async function fetchGodownInventory(
  godownId: string
): Promise<GodownStockItem[]> {
  const supabase = getSupabaseClient();

  const { data: units, error } = await supabase
    .from("stock_units")
    .select(
      `
      product_id,
      products ( id, name, barcode_id, product_code, category )
    `
    )
    .eq("godown_id", godownId)
    .eq("status", "STOCKED_IN");

  if (error) throw new Error(error.message);

  const stockMap = new Map<
    string,
    {
      name: string;
      barcode_id: string;
      product_code: string;
      category: string | null;
      qty: number;
    }
  >();

  for (const unit of units ?? []) {
    const product = normalizeRelation(
      unit.products as ProductRelation | ProductRelation[] | null
    );
    if (!product) continue;

    const existing = stockMap.get(product.id) ?? {
      name: product.name,
      barcode_id: product.barcode_id,
      product_code: product.product_code,
      category: product.category,
      qty: 0,
    };
    existing.qty += 1;
    stockMap.set(product.id, existing);
  }

  return Array.from(stockMap.entries())
    .map(([product_id, v]) => ({
      product_id,
      product_name: v.name,
      product_code: v.product_code,
      barcode_id: v.barcode_id,
      category: v.category,
      quantity: v.qty,
    }))
    .sort((a, b) => a.product_name.localeCompare(b.product_name));
}

/** Recent audit activity only — always bounded. */
export async function fetchRecentLogs(
  limit = 5
): Promise<InventoryLogWithRelations[]> {
  const supabase = getSupabaseClient();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const { data, error } = await supabase
    .from("inventory_logs")
    .select(
      `
      *,
      products ( id, name, barcode_id ),
      godowns ( id, location_name )
    `
    )
    .order("timestamp", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);
  return (data ?? []) as InventoryLogWithRelations[];
}

/**
 * Dashboard metrics from stock_units (STOCKED_IN).
 * Does not load the full inventory_logs history.
 */
export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = getSupabaseClient();

  const [godownsResult, unitsResult, recentLogs] = await Promise.all([
    supabase.from("godowns").select("id, location_name"),
    supabase
      .from("stock_units")
      .select("godown_id, product_id")
      .eq("status", "STOCKED_IN"),
    fetchRecentLogs(5),
  ]);

  if (godownsResult.error) throw new Error(godownsResult.error.message);
  if (unitsResult.error) throw new Error(unitsResult.error.message);

  const godowns = godownsResult.data ?? [];
  const units = unitsResult.data ?? [];

  const productIds = new Set<string>();
  const godownTotals = new Map<string, number>();
  for (const godown of godowns) {
    godownTotals.set(godown.id, 0);
  }

  for (const unit of units) {
    if (unit.product_id) productIds.add(unit.product_id);
    if (!unit.godown_id) continue;
    godownTotals.set(
      unit.godown_id,
      (godownTotals.get(unit.godown_id) ?? 0) + 1
    );
  }

  const totalStockUnits = units.length;
  const distributionSum = totalStockUnits;

  const godownDistribution: GodownDistribution[] = godowns.map((g) => {
    const total_units = godownTotals.get(g.id) ?? 0;
    return {
      godown_id: g.id,
      location_name: g.location_name,
      total_units,
      percentage:
        distributionSum > 0
          ? Math.round((total_units / distributionSum) * 100)
          : 0,
    };
  });

  return {
    totalActiveProducts: productIds.size,
    totalStockUnits,
    godownDistribution: godownDistribution.sort((a, b) =>
      a.location_name.localeCompare(b.location_name)
    ),
    recentLogs,
  };
}

export { processScanTransaction } from "@/lib/services/unitScanService";
export type { TransactionType } from "@/lib/services/unitScanService";
