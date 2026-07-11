"use client";

import { useCallback, useState } from "react";
import type {
  StockInProductTally,
  StockInTallyState,
} from "@/lib/types/scan";
import type { ScanTransactionResult } from "@/lib/types/database";

const emptyTally: StockInTallyState = { sessionTotal: 0, byProduct: [] };

export function useStockInTally() {
  const [tally, setTally] = useState<StockInTallyState>(emptyTally);

  const recordStockIn = useCallback((result: ScanTransactionResult) => {
    if (!result.success || !result.product) return;

    const units = result.isUnitScan ? 1 : 1;
    const productId = result.product.id;

    setTally((prev) => {
      const existing = prev.byProduct.find((p) => p.productId === productId);
      let byProduct: StockInProductTally[];

      if (existing) {
        byProduct = prev.byProduct.map((p) =>
          p.productId === productId
            ? { ...p, count: p.count + units }
            : p
        );
      } else {
        byProduct = [
          ...prev.byProduct,
          {
            productId,
            productName: result.product!.name,
            productCode: result.product!.product_code,
            count: units,
          },
        ];
      }

      return {
        sessionTotal: prev.sessionTotal + units,
        byProduct: byProduct.sort((a, b) => b.count - a.count),
      };
    });
  }, []);

  const resetTally = useCallback(() => setTally(emptyTally), []);

  return { tally, recordStockIn, resetTally };
}
