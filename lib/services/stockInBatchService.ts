import { apiMutation } from "@/lib/api/clientMutation";
import type { StockInBatchResult } from "@/lib/services/stockInBatchTypes";

export type { StockInBatchFailure, StockInBatchResult } from "@/lib/services/stockInBatchTypes";

export async function uploadStockInBatch(input: {
  uploadId: string;
  godownId: string;
  items: { barcode: string; bagsQty: number }[];
}): Promise<StockInBatchResult> {
  return apiMutation("/api/inventory/stock-in/batch", {
    method: "POST",
    body: input,
  }) as Promise<StockInBatchResult>;
}
