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

  const replaceTallyFromBags = useCallback(
    (
      items: Array<{
        productId: string;
        productName: string;
        productCode: string;
        size: string | null;
        bags: number;
      }>
    ) => {
      let next = emptyTally;
      for (const item of items) {
        const bags = Math.round(item.bags);
        if (bags < 1) continue;
        const existing = next.byProduct.find((p) => p.productId === item.productId);
        const byProduct = existing
          ? next.byProduct.map((p) =>
              p.productId === item.productId
                ? { ...p, bagCount: p.bagCount + bags, baleCount: p.baleCount + 1 }
                : p
            )
          : [
              ...next.byProduct,
              {
                productId: item.productId,
                productName: item.productName,
                productCode: item.productCode,
                size: item.size?.trim() || null,
                bagCount: bags,
                baleCount: 1,
              },
            ];
        next = {
          sessionTotal: next.sessionTotal + bags,
          sessionBales: next.sessionBales + 1,
          byProduct: byProduct.sort((a, b) => b.bagCount - a.bagCount),
        };
      }
      setTally(next);
    },
    []
  );

  return { tally, recordScan, recordBags, resetTally, replaceTallyFromBags };
}

/** @deprecated Use useScanTally */
export const useStockInTally = useScanTally;
