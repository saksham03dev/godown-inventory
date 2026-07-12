"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchGodowns } from "@/lib/services/inventoryService";
import {
  addUnitsToBill,
  createBillWithUnits,
  fetchBills,
  fetchUnbilledStockedOutUnits,
} from "@/lib/services/billService";
import type {
  AlertState,
  Bill,
  Godown,
  StockUnit,
} from "@/lib/types/database";

export function usePendingBilling(godownId?: string | null) {
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [draftBills, setDraftBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [unitData, godownData, bills] = await Promise.all([
        fetchUnbilledStockedOutUnits(godownId || null),
        fetchGodowns(),
        fetchBills(50),
      ]);
      setUnits(unitData);
      setGodowns(godownData);
      setDraftBills(bills.filter((b) => b.status === "DRAFT"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load pending units"
      );
    } finally {
      setLoading(false);
    }
  }, [godownId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const billSelected = useCallback(
    async (barcodes: string[], customerName?: string) => {
      setMutating(true);
      setAlert(null);
      const name = customerName?.trim() || "Walk-in Customer";
      const result = await createBillWithUnits(barcodes, {
        customer_name: name,
      });
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
    loading,
    mutating,
    error,
    alert,
    refresh,
    billSelected,
    addSelectedToBill,
    dismissAlert,
  };
}
