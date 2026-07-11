export type ScanMode = "STOCK_IN" | "STOCK_OUT" | "VIEW_LABEL";

export interface StockInProductTally {
  productId: string;
  productName: string;
  productCode: string;
  count: number;
}

export interface StockInTallyState {
  sessionTotal: number;
  byProduct: StockInProductTally[];
}
