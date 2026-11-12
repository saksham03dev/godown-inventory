import type { MutationResult } from "@/lib/types/database";

export interface StockInBatchFailure {
  barcode: string;
  message: string;
}

export interface StockInBatchResult extends MutationResult {
  savedBarcodes?: string[];
  failed?: StockInBatchFailure[];
}
