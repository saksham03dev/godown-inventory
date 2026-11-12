export type StockOutSaleMode = "wholesale" | "retail";

export const STOCK_OUT_MODE_STORAGE_KEY = "store-ims-stock-out-mode";
export const STOCK_OUT_STAGED_STORAGE_KEY = "store-ims-stock-out-staged";
/** Max bales per confirm — one list, one database transaction (see migration 031). */
export const STOCK_OUT_CONFIRM_CHUNK_SIZE = 12;

export const RETURN_REASONS = [
  "Customer return",
  "Damaged",
  "Wrong item",
  "Other",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];
