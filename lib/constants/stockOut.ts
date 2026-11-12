export type StockOutSaleMode = "wholesale" | "retail";

export const STOCK_OUT_MODE_STORAGE_KEY = "store-ims-stock-out-mode";
export const STOCK_OUT_STAGED_STORAGE_KEY = "store-ims-stock-out-staged";
export const STOCK_OUT_QUEUE_STORAGE_KEY = "store-ims-stock-out-queue";
/** Pending bales uploaded together once the list reaches this size. */
export const STOCK_OUT_UPLOAD_BATCH_SIZE = 4;
/** A smaller leftover list uploads on this interval so the slip moves during the session. */
export const STOCK_OUT_UPLOAD_INTERVAL_MS = 2000;

export const RETURN_REASONS = [
  "Customer return",
  "Damaged",
  "Wrong item",
  "Other",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];
