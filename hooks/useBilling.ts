"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addRetailLineToBill,
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
  RetailBillLineResult,
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
    async (billId: string, input: BillInput, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setMutating(true);
        setAlert(null);
      }
      const result = await updateBill(billId, input);
      if (result.success && result.data) {
        if (silent) {
          // Don't replace line items — a scan may have landed during autosave
          setActiveBill((prev) => {
            if (!prev || prev.id !== result.data!.id) return result.data!;
            const tax_percent = result.data!.tax_percent;
            const discount = result.data!.discount;
            const subtotal = prev.bill_items.reduce(
              (sum, i) => sum + Number(i.line_total),
              0
            );
            const tax_amount = Number(((subtotal * tax_percent) / 100).toFixed(2));
            const total = Number(
              Math.max(0, subtotal + tax_amount - discount).toFixed(2)
            );
            return {
              ...prev,
              customer_name: result.data!.customer_name,
              customer_phone: result.data!.customer_phone,
              customer_address: result.data!.customer_address,
              notes: result.data!.notes,
              tax_percent,
              discount,
              subtotal,
              tax_amount,
              total,
            };
          });
        } else {
          setActiveBill(result.data);
          setAlert({ type: "success", message: result.message });
        }
      } else if (!silent) {
        setAlert({ type: "error", message: result.message });
      }
      if (!silent) setMutating(false);
      return result;
    },
    []
  );

  const scanToBill = useCallback(
    async (billId: string, barcode: string, unitPrice = 0) => {
      const result = await addUnitToBill(billId, barcode, unitPrice);
      if (result.success && result.data) {
        setActiveBill(result.data);
      }
      return result;
    },
    []
  );

  const retailLineToBill = useCallback(
    async (
      billId: string,
      barcode: string,
      bagsQty: number,
      unitPrice = 0
    ): Promise<RetailBillLineResult> => {
      const result = await addRetailLineToBill(
        billId,
        barcode,
        bagsQty,
        unitPrice
      );
      if (result.success && result.data) {
        setActiveBill(result.data);
      }
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
    retailLineToBill,
    editItem,
    removeItem,
    finalize,
    removeBill,
    dismissAlert,
  };
}
