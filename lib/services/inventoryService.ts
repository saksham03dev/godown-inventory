import { getSupabaseClient } from "@/lib/supabase/client";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import {
  formatSchemaError,
  isMissingColumnError,
} from "@/lib/utils/schemaErrors";
import type {
  ActivityFeedItem,
  DashboardMetrics,
  Godown,
  GodownDistribution,
  GodownStockItem,
  InventoryLogWithRelations,
  Product,
  TransactionType,
} from "@/lib/types/database";
import { groupInventoryLogsForActivity } from "@/lib/utils/activityGrouping";

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

  const pageSize = 1000;
  const all: UnitRow[] = [];
  let from = 0;
  let useQuality = true;

  for (;;) {
    const select = useQuality ? selectWithQuality : selectWithoutQuality;
    let query = supabase
      .from("stock_units")
      .select(select)
      .eq("status", "STOCKED_IN")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (options?.godownId) {
      query = query.eq("godown_id", options.godownId);
    }

    const result = await query;
    let error = result.error;
    let rows = (result.data ?? []) as UnitRow[];

    if (error && useQuality && isMissingColumnError(error.message, "quality")) {
      useQuality = false;
      continue;
    }

    if (error) throw new Error(formatSchemaError(error.message));

    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function aggregateStockUnits(
  units: Awaited<ReturnType<typeof fetchStockedInUnits>>,
  includeLocations: boolean
): GodownStockItem[] {
  const stockMap = new Map<string, StockAccumulator>();

  for (const unit of units) {
    // Match get_inventory_stock_summary: only bags assigned to a godown.
    if (!unit.godown_id) continue;

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

    if (includeLocations && godown) {
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

/** Recent audit activity only — always bounded. Pulls extra rows so slip groups can collapse. */
export async function fetchRecentLogs(
  limit = 5
): Promise<InventoryLogWithRelations[]> {
  const supabase = getSupabaseClient();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const fetchLimit = Math.min(safeLimit * 8, 80);

  let { data, error } = await supabase
    .from("inventory_logs")
    .select(
      `
      *,
      products ( id, name, barcode_id, product_code, size ),
      godowns!godown_id ( id, location_name ),
      stock_out_slips ( biller_name )
    `
    )
    .order("timestamp", { ascending: false })
    .limit(fetchLimit);

  if (error && /stock_out_slip/i.test(error.message)) {
    ({ data, error } = await supabase
      .from("inventory_logs")
      .select(
        `
      *,
      products ( id, name, barcode_id, product_code, size ),
      godowns!godown_id ( id, location_name )
    `
      )
      .order("timestamp", { ascending: false })
      .limit(fetchLimit));
  }

  if (error) throw new Error(error.message);
  return (data ?? []) as InventoryLogWithRelations[];
}

export async function fetchRecentActivity(
  limit = 5
): Promise<ActivityFeedItem[]> {
  const logs = await fetchRecentLogs(limit);
  return groupInventoryLogsForActivity(
    logs as Parameters<typeof groupInventoryLogsForActivity>[0],
    limit
  );
}

/**
 * Dashboard metrics from the same inventory aggregate as All Godowns
 * (SQL summary RPC, not a capped client fetch of every stock_unit row).
 */
export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const [godowns, inventory, recentLogs] = await Promise.all([
    fetchGodowns(),
    fetchAllGodownInventory(),
    fetchRecentLogs(5),
  ]);

  const recentActivity = groupInventoryLogsForActivity(
    recentLogs as Parameters<typeof groupInventoryLogsForActivity>[0],
    5
  );

  const productIds = new Set<string>();
  const godownTotals = new Map<string, number>();
  for (const godown of godowns) {
    godownTotals.set(godown.id, 0);
  }

  let totalStockBags = 0;
  for (const item of inventory) {
    productIds.add(item.product_id);
    totalStockBags += Number(item.quantity);

    if (item.locations?.length) {
      for (const loc of item.locations) {
        godownTotals.set(
          loc.godown_id,
          (godownTotals.get(loc.godown_id) ?? 0) + Number(loc.quantity)
        );
      }
    }
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
    recentActivity,
  };
}

export { processScanTransaction } from "@/lib/services/unitScanService";
export type { TransactionType } from "@/lib/services/unitScanService";
