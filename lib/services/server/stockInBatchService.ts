import { createServiceClient } from "@/lib/supabase/service";
import type { StockInBatchResult } from "@/lib/services/stockInBatchTypes";

function asBarcodeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function asFailures(value: unknown): { barcode: string; message: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { barcode?: unknown; message?: unknown };
    const barcode = typeof row.barcode === "string" ? row.barcode : "";
    if (!barcode) return [];
    return [{
      barcode,
      message: typeof row.message === "string" ? row.message : "Could not stock in this label.",
    }];
  });
}

export async function confirmStockInBatchServer(input: {
  uploadId: string;
  godownId: string;
  handledBy: string;
  items: { barcode: string; bagsQty: number }[];
}): Promise<StockInBatchResult> {
  const uploadId = input.uploadId.trim();
  if (!uploadId) return { success: false, message: "Missing upload ID." };
  if (!input.godownId) return { success: false, message: "Pick a warehouse first." };
  if (!input.items.length) return { success: false, message: "No bales to stock in." };

  const supabase = createServiceClient({ requireServiceRole: true });
  const { data, error } = await supabase.rpc("confirm_stock_in_batch", {
    p_client_request_id: uploadId,
    p_godown_id: input.godownId,
    p_handled_by: input.handledBy,
    p_items: input.items.map((item) => ({
      barcode: item.barcode,
      bagsQty: item.bagsQty,
    })),
  });

  if (error) return { success: false, message: error.message };

  const result = (data ?? {}) as {
    success?: unknown;
    message?: unknown;
    savedBarcodes?: unknown;
    failed?: unknown;
  };

  return {
    success: result.success === true,
    message: typeof result.message === "string" ? result.message : "Stock in upload finished.",
    savedBarcodes: asBarcodeList(result.savedBarcodes),
    failed: asFailures(result.failed),
  };
}
