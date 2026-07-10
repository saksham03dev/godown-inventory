"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addUnitToBill,
  createBill,
  deleteBill,
  fetchBillWithItems,
  fetchBills,
  finalizeBill,
  removeBillItem,
  updateBill,
  updateBillItem,
} from "@/lib/services/billService";
import type {
  AlertState,
  Bill,
  BillInput,
  BillItemInput,
  BillWithItems,
} from "@/lib/types/database";

export function useBilling() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [activeBill, setActiveBill] = useState<BillWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const refreshBills = useCallback(async () => {
    try {
      const data = await fetchBills();
      setBills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bills");
    }
  }, []);

  const loadBill = useCallback(async (billId: string) => {
    try {
      const bill = await fetchBillWithItems(billId);
      setActiveBill(bill);
      return bill;
    } catch (err) {
      setAlert({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load bill",
      });
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await refreshBills();
    setLoading(false);
  }, [refreshBills]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startNewBill = useCallback(async (input?: BillInput) => {
    setMutating(true);
    setAlert(null);
    const result = await createBill(input);
    if (result.success && result.data) {
      const full = await fetchBillWithItems(result.data.id);
      setActiveBill(full);
      setAlert({ type: "success", message: result.message });
      await refreshBills();
    } else {
      setAlert({ type: "error", message: result.message });
    }
    setMutating(false);
    return result;
  }, [refreshBills]);

  const saveBill = useCallback(
    async (billId: string, input: BillInput) => {
      setMutating(true);
      setAlert(null);
      const result = await updateBill(billId, input);
      if (result.success && result.data) {
        setActiveBill(result.data);
        setAlert({ type: "success", message: result.message });
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    []
  );

  const scanToBill = useCallback(
    async (billId: string, barcode: string, unitPrice = 0) => {
      setMutating(true);
      setAlert(null);
      const result = await addUnitToBill(billId, barcode, unitPrice);
      if (result.success && result.data) {
        setActiveBill(result.data);
        setAlert({ type: "success", message: result.message });
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    []
  );

  const editItem = useCallback(
    async (itemId: string, input: BillItemInput) => {
      setMutating(true);
      const result = await updateBillItem(itemId, input);
      if (result.success && result.data) {
        setActiveBill(result.data);
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    []
  );

  const removeItem = useCallback(async (itemId: string) => {
    setMutating(true);
    const result = await removeBillItem(itemId);
    if (result.success && result.data) {
      setActiveBill(result.data);
      setAlert({ type: "success", message: result.message });
    } else {
      setAlert({ type: "error", message: result.message });
    }
    setMutating(false);
    return result;
  }, []);

  const finalize = useCallback(async (billId: string) => {
    setMutating(true);
    const result = await finalizeBill(billId);
    if (result.success && result.data) {
      setActiveBill(result.data);
      setAlert({ type: "success", message: result.message });
      await refreshBills();
    } else {
      setAlert({ type: "error", message: result.message });
    }
    setMutating(false);
    return result;
  }, [refreshBills]);

  const removeBill = useCallback(
    async (billId: string) => {
      setMutating(true);
      const result = await deleteBill(billId);
      if (result.success) {
        if (activeBill?.id === billId) setActiveBill(null);
        setAlert({ type: "success", message: result.message });
        await refreshBills();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [activeBill, refreshBills]
  );

  const dismissAlert = useCallback(() => setAlert(null), []);

  return {
    bills,
    activeBill,
    loading,
    mutating,
    error,
    alert,
    refresh,
    startNewBill,
    loadBill,
    saveBill,
    scanToBill,
    editItem,
    removeItem,
    finalize,
    removeBill,
    dismissAlert,
  };
}
