"use client";

import { useCallback, useState } from "react";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import type { ScanTallyState } from "@/lib/types/scan";
import type { ScanTransactionResult } from "@/lib/types/database";

const emptyTally: ScanTallyState = { sessionTotal: 0, sessionBales: 0, byProduct: [] };

export function useScanTally() {
  const [tally, setTally] = useState<ScanTallyState>(emptyTally);

  const recordScan = useCallback((result: ScanTransactionResult) => {
    if (!result.success || !result.product) return;

    const bags = result.bagsMoved ?? BAGS_PER_BALE;
    const productId = result.product.id;

    setTally((prev) => {
      const existing = prev.byProduct.find((p) => p.productId === productId);
      let byProduct;

      if (existing) {
        byProduct = prev.byProduct.map((p) =>
          p.productId === productId
            ? {
                ...p,
                bagCount: p.bagCount + bags,
                baleCount: p.baleCount + 1,
              }
            : p
        );
      } else {
        byProduct = [
          ...prev.byProduct,
          {
            productId,
            productName: result.product!.name,
            productCode: result.product!.product_code,
            bagCount: bags,
            baleCount: 1,
          },
        ];
      }

      return {
        sessionTotal: prev.sessionTotal + bags,
        sessionBales: prev.sessionBales + 1,
        byProduct: byProduct.sort((a, b) => b.bagCount - a.bagCount),
      };
    });
  }, []);

  const resetTally = useCallback(() => setTally(emptyTally), []);

  return { tally, recordScan, resetTally };
}

/** @deprecated Use useScanTally */
export const useStockInTally = useScanTally;
