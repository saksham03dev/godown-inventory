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

const DEFAULT_HANDLED_BY = "warehouse-operator";

type ProductRelation = {
  id: string;
  name: string;
  barcode_id: string;
  product_code: string;
  category: string | null;
};

function normalizeProductRelation(
  products: ProductRelation | ProductRelation[] | null
): ProductRelation | null {
  if (!products) return null;
  return Array.isArray(products) ? (products[0] ?? null) : products;
}

async function getGodownStockForProduct(
  productId: string,
  godownId: string
): Promise<number> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_logs")
    .select("transaction_type, quantity")
    .eq("product_id", productId)
    .eq("godown_id", godownId);

  if (error) throw new Error(error.message);

  return (data ?? []).reduce((total, log) => {
    return log.transaction_type === "STOCK_IN"
      ? total + log.quantity
      : total - log.quantity;
  }, 0);
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

export async function fetchGodownInventory(
  godownId: string
): Promise<GodownStockItem[]> {
  const supabase = getSupabaseClient();

  const { data: logs, error: logsError } = await supabase
    .from("inventory_logs")
    .select(
      `
      product_id,
      transaction_type,
      quantity,
      products ( id, name, barcode_id, product_code, category )
    `
    )
    .eq("godown_id", godownId);

  if (logsError) throw new Error(logsError.message);

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

  for (const log of logs ?? []) {
    const product = normalizeProductRelation(
      log.products as ProductRelation | ProductRelation[] | null
    );
    if (!product) continue;

    const existing = stockMap.get(product.id) ?? {
      name: product.name,
      barcode_id: product.barcode_id,
      product_code: product.product_code,
      category: product.category,
      qty: 0,
    };

    existing.qty +=
      log.transaction_type === "STOCK_IN" ? log.quantity : -log.quantity;
    stockMap.set(product.id, existing);
  }

  return Array.from(stockMap.entries())
    .filter(([, v]) => v.qty > 0)
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

export async function fetchRecentLogs(
  limit = 5
): Promise<InventoryLogWithRelations[]> {
  const supabase = getSupabaseClient();
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
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as InventoryLogWithRelations[];
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = getSupabaseClient();

  const [productsResult, godownsResult, logsResult] = await Promise.all([
    supabase.from("products").select("id, total_stock"),
    supabase.from("godowns").select("id, location_name"),
    supabase
      .from("inventory_logs")
      .select("godown_id, transaction_type, quantity"),
  ]);

  if (productsResult.error) throw new Error(productsResult.error.message);
  if (godownsResult.error) throw new Error(godownsResult.error.message);
  if (logsResult.error) throw new Error(logsResult.error.message);

  const products = productsResult.data ?? [];
  const godowns = godownsResult.data ?? [];
  const logs = logsResult.data ?? [];

  const totalActiveProducts = products.filter((p) => p.total_stock > 0).length;
  const totalStockUnits = products.reduce((sum, p) => sum + p.total_stock, 0);

  const godownTotals = new Map<string, number>();
  for (const godown of godowns) {
    godownTotals.set(godown.id, 0);
  }

  for (const log of logs) {
    const current = godownTotals.get(log.godown_id) ?? 0;
    const delta = log.transaction_type === "STOCK_IN" ? log.quantity : -log.quantity;
    godownTotals.set(log.godown_id, Math.max(0, current + delta));
  }

  const distributionSum = Array.from(godownTotals.values()).reduce(
    (a, b) => a + b,
    0
  );

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

  const recentLogs = await fetchRecentLogs(5);

  return {
    totalActiveProducts,
    totalStockUnits,
    godownDistribution,
    recentLogs,
  };
}

export { processScanTransaction } from "@/lib/services/unitScanService";
export type { TransactionType } from "@/lib/services/unitScanService";
