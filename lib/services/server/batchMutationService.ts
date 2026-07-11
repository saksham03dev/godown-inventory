import { createServiceClient } from "@/lib/supabase/service";
import {
  generateBatchCode,
  generateUnitBarcode,
} from "@/lib/utils/barcode";
import type {
  CreateBatchInput,
  MutationResult,
  StockBatch,
  StockBatchWithUnits,
  StockUnit,
  UpdateBatchInput,
} from "@/lib/types/database";

function db() {
  return createServiceClient({ requireServiceRole: true });
}

export async function createStockBatchServer(
  input: CreateBatchInput,
  createdBy: string
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

    const supabase = db();
    const batch_code = generateBatchCode();

    const { data: batch, error: batchError } = await supabase
      .from("stock_batches")
      .insert({
        product_id: input.product_id,
        batch_code,
        source_name,
        quantity: input.quantity,
        notes: input.notes?.trim() || null,
        created_by: createdBy,
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

export async function updateStockBatchServer(
  batchId: string,
  input: UpdateBatchInput
): Promise<MutationResult<StockBatch>> {
  try {
    const source_name = input.source_name.trim();
    if (!source_name) {
      return { success: false, message: "Source / buyer name is required." };
    }

    const { data, error } = await db()
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
