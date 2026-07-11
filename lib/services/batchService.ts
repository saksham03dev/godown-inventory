import { getSupabaseClient } from "@/lib/supabase/client";
import {
  generateBatchCode,
  generateUnitBarcode,
} from "@/lib/utils/barcode";
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
  try {
    const source_name = input.source_name.trim();
    if (!input.product_id) {
      return { success: false, message: "Select a product." };
    }
    if (!source_name) {
      return { success: false, message: "Source / buyer name is required." };
    }
    if (input.quantity < 1 || input.quantity > 500) {
      return {
        success: false,
        message: "Batch quantity must be between 1 and 500.",
      };
    }

    const supabase = getSupabaseClient();
    const batch_code = generateBatchCode();

    const { data: batch, error: batchError } = await supabase
      .from("stock_batches")
      .insert({
        product_id: input.product_id,
        batch_code,
        source_name,
        quantity: input.quantity,
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();

    if (batchError) throw new Error(batchError.message);

    const units = Array.from({ length: input.quantity }, (_, i) => ({
      batch_id: batch.id,
      product_id: input.product_id,
      unit_barcode: generateUnitBarcode(batch_code, i + 1),
      unit_number: i + 1,
      status: "LABELLED" as const,
    }));

    const { data: createdUnits, error: unitsError } = await supabase
      .from("stock_units")
      .insert(units)
      .select();

    if (unitsError) throw new Error(unitsError.message);

    const { data: product } = await supabase
      .from("products")
      .select("id, name, product_code, size")
      .eq("id", input.product_id)
      .single();

    return {
      success: true,
      message: `Created batch ${batch_code} with ${input.quantity} unit label(s).`,
      data: {
        ...batch,
        products: product,
        stock_units: (createdUnits ?? []) as StockUnit[],
      },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to create batch.",
    };
  }
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

/**
 * Stocked-in units for a product in a godown, grouped by batch (source).
 */
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
        in_godown_count: 0,
        units: [],
      };
      byBatch.set(batchRow.id, group);
    }
    group.units.push(unit);
    group.in_godown_count += 1;
  }

  const batches = Array.from(byBatch.values()).sort((a, b) =>
    a.batch.source_name.localeCompare(b.batch.source_name)
  );

  return {
    product_id: productId,
    godown_id: godownId,
    batches,
    total_units: units.length,
  };
}

export async function updateStockBatch(
  batchId: string,
  input: UpdateBatchInput
): Promise<MutationResult<StockBatch>> {
  try {
    const source_name = input.source_name.trim();
    if (!source_name) {
      return { success: false, message: "Source / buyer name is required." };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("stock_batches")
      .update({
        source_name,
        notes: input.notes?.trim() || null,
      })
      .eq("id", batchId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      success: true,
      message: `Batch ${data.batch_code} updated.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to update batch.",
    };
  }
}
