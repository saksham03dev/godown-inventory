export type ScanMode = "STOCK_IN" | "STOCK_OUT" | "VIEW_LABEL";

export interface ScanProductTally {
  productId: string;
  productName: string;
  productCode: string;
  /** Bags added this session for this product. */
  bagCount: number;
  /** Bale labels scanned this session. */
  baleCount: number;
}

export interface ScanTallyState {
  /** Total bags this session. */
  sessionTotal: number;
  /** Total bale labels scanned this session. */
  sessionBales: number;
  byProduct: ScanProductTally[];
}

/** @deprecated Use ScanProductTally */
export type StockInProductTally = ScanProductTally;
/** @deprecated Use ScanTallyState */
export type StockInTallyState = ScanTallyState;
