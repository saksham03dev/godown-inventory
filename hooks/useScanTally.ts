"use client";

import { useCallback, useState } from "react";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import type { ScanTallyState } from "@/lib/types/scan";
import type { ScanTransactionResult } from "@/lib/types/database";

const emptyTally: ScanTallyState = { sessionTotal: 0, sessionBales: 0, byProduct: [] };

export function useScanTally() {
  const [tally, setTally] = useState<ScanTallyState>(emptyTally);

  const recordBags = useCallback(
    (input: {
      productId: string;
      productName: string;
      productCode: string;
      size: string | null;
      bags: number;
    }) => {
      const bags = Math.round(input.bags);
      if (bags < 1) return;

      setTally((prev) => {
        const existing = prev.byProduct.find(
          (p) => p.productId === input.productId
        );
        let byProduct;

        if (existing) {
          byProduct = prev.byProduct.map((p) =>
            p.productId === input.productId
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
              productId: input.productId,
              productName: input.productName,
              productCode: input.productCode,
              size: input.size?.trim() || null,
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
    },
    []
  );

  const recordScan = useCallback(
    (result: ScanTransactionResult) => {
      if (!result.success || !result.product) return;
      recordBags({
        productId: result.product.id,
        productName: result.product.name,
        productCode: result.product.product_code,
        size: result.product.size,
        bags: result.bagsMoved ?? BAGS_PER_BALE,
      });
    },
    [recordBags]
  );

  const resetTally = useCallback(() => setTally(emptyTally), []);

  return { tally, recordScan, recordBags, resetTally };
}

/** @deprecated Use useScanTally */
export const useStockInTally = useScanTally;
