export type StockOutSaleMode = "wholesale" | "retail";

export const STOCK_OUT_MODE_STORAGE_KEY = "store-ims-stock-out-mode";

export const RETURN_REASONS = [
  "Customer return",
  "Damaged",
  "Wrong item",
  "Other",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];
