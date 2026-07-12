import { apiMutation } from "@/lib/api/clientMutation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import type {
  CreateBatchInput,
  MutationResult,
  ProductGodownBreakdown,
  StockBatch,
  StockBatchWithUnits,
  StockUnit,
  UpdateBatchInput,
} from "@/lib/types/database";

export async function fetchBatches(limit = 20): Promise<StockBatch[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("stock_batches")
    .select(
      `
      *,
      products ( id, name, product_code, size )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as StockBatch[];
}

export async function fetchBatchWithUnits(
  batchId: string
): Promise<StockBatchWithUnits | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("stock_batches")
    .select(
      `
      *,
      products ( id, name, product_code, size, retail_selling_price ),
      stock_units ( * )
    `
    )
    .eq("id", batchId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const batch = data as StockBatchWithUnits;
  batch.stock_units = (batch.stock_units ?? []).sort(
    (a, b) => a.unit_number - b.unit_number
  );
  return batch;
}

export async function createStockBatch(
  input: CreateBatchInput
): Promise<MutationResult<StockBatchWithUnits>> {
  return apiMutation<StockBatchWithUnits>("/api/batches", { body: input });
}

export async function updateStockBatch(
  batchId: string,
  input: UpdateBatchInput
): Promise<MutationResult<StockBatch>> {
  return apiMutation<StockBatch>(`/api/batches/${batchId}`, {
    method: "PATCH",
    body: input,
  });
}

export async function fetchStockUnitByBarcode(
  barcode: string
): Promise<StockUnit | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("stock_units")
    .select(
      `
      *,
      products ( id, name, product_code, size, retail_selling_price, barcode_id, special_note, category ),
      stock_batches ( id, batch_code, source_name, quantity, notes ),
      godowns ( id, location_name )
    `
    )
    .eq("unit_barcode", barcode.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as StockUnit | null;
}

/** Stocked-in units for a product in a godown, grouped by batch (source). */
export async function fetchProductGodownBreakdown(
  productId: string,
  godownId: string
): Promise<ProductGodownBreakdown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("stock_units")
    .select(
      `
      *,
      products ( id, name, product_code, size, retail_selling_price ),
      stock_batches ( id, product_id, batch_code, source_name, quantity, notes, created_by, created_at ),
      godowns ( id, location_name )
    `
    )
    .eq("product_id", productId)
    .eq("godown_id", godownId)
    .eq("status", "STOCKED_IN")
    .order("unit_number", { ascending: true });

  if (error) throw new Error(error.message);

  const units = (data ?? []) as StockUnit[];
  const byBatch = new Map<string, ProductGodownBreakdown["batches"][number]>();

  for (const unit of units) {
    const batchRow = unit.stock_batches as StockBatch | null | undefined;
    if (!batchRow?.id) continue;

    let group = byBatch.get(batchRow.id);
    if (!group) {
      group = {
        batch: {
          id: batchRow.id,
          product_id: batchRow.product_id ?? productId,
          batch_code: batchRow.batch_code,
          source_name: batchRow.source_name,
          quantity: batchRow.quantity,
          notes: batchRow.notes ?? null,
          created_by: batchRow.created_by ?? "system",
          created_at: batchRow.created_at ?? unit.created_at,
        },
        in_godown_bags: 0,
        in_godown_bales: 0,
        units: [],
      };
      byBatch.set(batchRow.id, group);
    }
    group.units.push(unit);
    group.in_godown_bales += 1;
    group.in_godown_bags += Number(unit.remaining_bags ?? BAGS_PER_BALE);
  }

  const batches = Array.from(byBatch.values()).sort((a, b) =>
    a.batch.source_name.localeCompare(b.batch.source_name)
  );

  const total_bags = units.reduce(
    (sum, u) => sum + Number(u.remaining_bags ?? BAGS_PER_BALE),
    0
  );

  return {
    product_id: productId,
    godown_id: godownId,
    batches,
    total_bags,
    total_bales: units.length,
  };
}
