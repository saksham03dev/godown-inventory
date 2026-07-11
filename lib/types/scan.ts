export type ScanMode = "STOCK_IN" | "STOCK_OUT" | "VIEW_LABEL";

export interface ScanProductTally {
  productId: string;
  productName: string;
  productCode: string;
  count: number;
}

export interface ScanTallyState {
  sessionTotal: number;
  byProduct: ScanProductTally[];
}

/** @deprecated Use ScanProductTally */
export type StockInProductTally = ScanProductTally;
/** @deprecated Use ScanTallyState */
export type StockInTallyState = ScanTallyState;
