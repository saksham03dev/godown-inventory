import { getSupabaseClient } from "@/lib/supabase/client";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import {
  formatSchemaError,
  isMissingColumnError,
} from "@/lib/utils/schemaErrors";
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
  size: string | null;
  quality?: string | null;
  category: string | null;
};

type GodownRelation = {
  id: string;
  location_name: string;
};

type StockAccumulator = {
  name: string;
  barcode_id: string;
  product_code: string;
  size: string | null;
  quality: string | null;
  category: string | null;
  qty: number;
  open_bales: number;
  locations: Map<
    string,
    { godown_name: string; quantity: number; open_bales: number }
  >;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toStockItem(
  product_id: string,
  v: StockAccumulator,
  includeLocations: boolean
): GodownStockItem {
  const item: GodownStockItem = {
    product_id,
    product_name: v.name,
    product_code: v.product_code,
    barcode_id: v.barcode_id,
    size: v.size,
    quality: v.quality,
    category: v.category,
    quantity: v.qty,
    open_bales: v.open_bales,
  };

  if (includeLocations && v.locations.size > 0) {
    item.locations = Array.from(v.locations.entries())
      .map(([godown_id, loc]) => ({
        godown_id,
        godown_name: loc.godown_name,
        quantity: loc.quantity,
        open_bales: loc.open_bales,
      }))
      .sort((a, b) => a.godown_name.localeCompare(b.godown_name));
  }

  return item;
}

type InventorySummaryRow = {
  product_id: string;
  godown_id: string;
  godown_name: string | null;
  total_bags: number;
  open_bales: number;
  product_name: string;
  product_code: string;
  barcode_id: string;
  size: string | null;
  quality: string | null;
  category: string | null;
};

function mapSummaryRows(
  rows: InventorySummaryRow[],
  includeLocations: boolean
): GodownStockItem[] {
  if (!includeLocations) {
    return rows
      .map((row) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        product_code: row.product_code,
        barcode_id: row.barcode_id,
        size: row.size,
        quality: row.quality,
        category: row.category,
        quantity: Number(row.total_bags),
        open_bales: Number(row.open_bales),
      }))
      .sort((a, b) => a.product_name.localeCompare(b.product_name));
  }

  const byProduct = new Map<string, GodownStockItem>();

  for (const row of rows) {
    let item = byProduct.get(row.product_id);
    if (!item) {
      item = {
        product_id: row.product_id,
        product_name: row.product_name,
        product_code: row.product_code,
        barcode_id: row.barcode_id,
        size: row.size,
        quality: row.quality,
        category: row.category,
        quantity: 0,
        open_bales: 0,
        locations: [],
      };
      byProduct.set(row.product_id, item);
    }

    item.quantity += Number(row.total_bags);
    item.open_bales += Number(row.open_bales);

    if (row.godown_id && row.godown_name) {
      item.locations!.push({
        godown_id: row.godown_id,
        godown_name: row.godown_name,
        quantity: Number(row.total_bags),
        open_bales: Number(row.open_bales),
      });
    }
  }

  return Array.from(byProduct.values()).sort((a, b) =>
    a.product_name.localeCompare(b.product_name)
  );
}

async function fetchInventorySummary(
  godownId?: string
): Promise<GodownStockItem[] | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_inventory_stock_summary", {
    p_godown_id: godownId ?? null,
  });

  if (error) {
    if (
      error.message.includes("get_inventory_stock_summary") ||
      isMissingColumnError(error.message, "quality")
    ) {
      return null;
    }
    throw new Error(formatSchemaError(error.message));
  }

  return mapSummaryRows((data ?? []) as InventorySummaryRow[], !godownId);
}

async function fetchStockedInUnits(options?: { godownId?: string }) {
  const supabase = getSupabaseClient();

  type UnitRow = {
    product_id: string;
    godown_id: string | null;
    remaining_bags: number | null;
    products: ProductRelation | ProductRelation[] | null;
    godowns: GodownRelation | GodownRelation[] | null;
  };

  const selectWithQuality = `
      product_id,
      godown_id,
      remaining_bags,
      products ( id, name, barcode_id, product_code, size, quality, category ),
      godowns!godown_id ( id, location_name )
    `;

  const selectWithoutQuality = `
      product_id,
      godown_id,
      remaining_bags,
      products ( id, name, barcode_id, product_code, size, category ),
      godowns!godown_id ( id, location_name )
    `;

  let query = supabase
    .from("stock_units")
    .select(selectWithQuality)
    .eq("status", "STOCKED_IN");

  if (options?.godownId) {
    query = query.eq("godown_id", options.godownId);
  }

  let result = await query;
  let units = result.data as UnitRow[] | null;
  let error = result.error;

  if (error && isMissingColumnError(error.message, "quality")) {
    let fallbackQuery = supabase
      .from("stock_units")
      .select(selectWithoutQuality)
      .eq("status", "STOCKED_IN");

    if (options?.godownId) {
      fallbackQuery = fallbackQuery.eq("godown_id", options.godownId);
    }

    const fallback = await fallbackQuery;
    units = fallback.data as UnitRow[] | null;
    error = fallback.error;
  }

  if (error) throw new Error(formatSchemaError(error.message));
  return units ?? [];
}

function aggregateStockUnits(
  units: Awaited<ReturnType<typeof fetchStockedInUnits>>,
  includeLocations: boolean
): GodownStockItem[] {
  const stockMap = new Map<string, StockAccumulator>();

  for (const unit of units) {
    const product = normalizeRelation(
      unit.products as ProductRelation | ProductRelation[] | null
    );
    if (!product) continue;

    const godown = normalizeRelation(
      unit.godowns as GodownRelation | GodownRelation[] | null
    );
    const bags = Number(unit.remaining_bags ?? 0);
    const isOpenBale = bags > 0 && bags < BAGS_PER_BALE;

    const existing = stockMap.get(product.id) ?? {
      name: product.name,
      barcode_id: product.barcode_id,
      product_code: product.product_code,
      size: product.size,
      quality: product.quality ?? null,
      category: product.category,
      qty: 0,
      open_bales: 0,
      locations: new Map(),
    };

    existing.qty += bags;
    if (isOpenBale) {
      existing.open_bales += 1;
    }

    if (includeLocations && unit.godown_id && godown) {
      const loc = existing.locations.get(unit.godown_id) ?? {
        godown_name: godown.location_name,
        quantity: 0,
        open_bales: 0,
      };
      loc.quantity += bags;
      if (isOpenBale) {
        loc.open_bales += 1;
      }
      existing.locations.set(unit.godown_id, loc);
    }

    stockMap.set(product.id, existing);
  }

  return Array.from(stockMap.entries())
    .map(([product_id, v]) => toStockItem(product_id, v, includeLocations))
    .sort((a, b) => a.product_name.localeCompare(b.product_name));
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
 * In-godown stock from stock_units (STOCKED_IN remaining_bags sum).
 * inventory_logs are audit trail, not quantity source.
 */
export async function fetchGodownInventory(
  godownId: string
): Promise<GodownStockItem[]> {
  const summary = await fetchInventorySummary(godownId);
  if (summary) return summary;

  const units = await fetchStockedInUnits({ godownId });
  return aggregateStockUnits(units, false);
}

/** Stock across all godowns with per-location breakdown on each item. */
export async function fetchAllGodownInventory(): Promise<GodownStockItem[]> {
  const summary = await fetchInventorySummary();
  if (summary) return summary;

  const units = await fetchStockedInUnits();
  return aggregateStockUnits(units, true);
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
      godowns!godown_id ( id, location_name )
    `
    )
    .order("timestamp", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);
  return (data ?? []) as InventoryLogWithRelations[];
}

/**
 * Dashboard metrics from stock_units (STOCKED_IN bag totals).
 * Does not load the full inventory_logs history.
 */
export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = getSupabaseClient();

  const [godownsResult, unitsResult, recentLogs] = await Promise.all([
    supabase.from("godowns").select("id, location_name"),
    supabase
      .from("stock_units")
      .select("godown_id, product_id, remaining_bags")
      .eq("status", "STOCKED_IN"),
    fetchRecentLogs(5),
  ]);

  if (godownsResult.error) throw new Error(godownsResult.error.message);
  if (unitsResult.error) throw new Error(formatSchemaError(unitsResult.error.message));

  const godowns = godownsResult.data ?? [];
  const units = unitsResult.data ?? [];

  const productIds = new Set<string>();
  const godownTotals = new Map<string, number>();
  for (const godown of godowns) {
    godownTotals.set(godown.id, 0);
  }

  let totalStockBags = 0;
  for (const unit of units) {
    const bags = Number(unit.remaining_bags ?? 0);
    totalStockBags += bags;
    if (unit.product_id) productIds.add(unit.product_id);
    if (!unit.godown_id) continue;
    godownTotals.set(
      unit.godown_id,
      (godownTotals.get(unit.godown_id) ?? 0) + bags
    );
  }

  const godownDistribution: GodownDistribution[] = godowns.map((g) => {
    const total_bags = godownTotals.get(g.id) ?? 0;
    return {
      godown_id: g.id,
      location_name: g.location_name,
      total_bags,
      percentage:
        totalStockBags > 0
          ? Math.round((total_bags / totalStockBags) * 100)
          : 0,
    };
  });

  return {
    totalActiveProducts: productIds.size,
    totalStockBags,
    godownDistribution: godownDistribution.sort((a, b) =>
      a.location_name.localeCompare(b.location_name)
    ),
    recentLogs,
  };
}

export { processScanTransaction } from "@/lib/services/unitScanService";
export type { TransactionType } from "@/lib/services/unitScanService";
