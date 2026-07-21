"use client";

import { useCallback, useEffect, useState } from "react";
import { useCatalogGodowns } from "@/contexts/CatalogCacheContext";
import {
  addUnitsToBill,
  createBillWithUnits,
  fetchBills,
  fetchUnbilledStockedOutUnits,
} from "@/lib/services/billService";
import type { AlertState, Bill, StockUnit } from "@/lib/types/database";

export function usePendingBilling(godownId?: string | null) {
  const { godowns, loading: godownsLoading } = useCatalogGodowns();
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [draftBills, setDraftBills] = useState<Bill[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const refresh = useCallback(async () => {
    setDataLoading(true);
    setError(null);
    try {
      const [unitData, bills] = await Promise.all([
        fetchUnbilledStockedOutUnits(godownId || null),
        fetchBills(50),
      ]);
      setUnits(unitData);
      setDraftBills(bills.filter((b) => b.status === "DRAFT"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load pending units"
      );
    } finally {
      setDataLoading(false);
    }
  }, [godownId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const billSelected = useCallback(async (barcodes: string[]) => {
    setMutating(true);
    setAlert(null);
    const result = await createBillWithUnits(barcodes);
    if (result.success && result.data) {
      setAlert({ type: "success", message: result.message });
    } else {
      setAlert({ type: "error", message: result.message });
    }
    setMutating(false);
    return result;
  }, []);

  const addSelectedToBill = useCallback(
    async (billId: string, barcodes: string[]) => {
      setMutating(true);
      setAlert(null);
      const result = await addUnitsToBill(billId, barcodes);
      if (result.success && result.data) {
        setAlert({ type: "success", message: result.message });
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    []
  );

  const dismissAlert = useCallback(() => setAlert(null), []);

  return {
    units,
    godowns,
    draftBills,
    loading: godownsLoading || dataLoading,
    mutating,
    error,
    alert,
    refresh,
    billSelected,
    addSelectedToBill,
    dismissAlert,
  };
}
