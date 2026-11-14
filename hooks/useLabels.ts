"use client";

import { useCallback, useEffect, useState } from "react";
import { useCatalogCache } from "@/contexts/CatalogCacheContext";
import {
  createStockBatch,
  fetchBatchWithUnits,
  fetchBatches,
} from "@/lib/services/batchService";
import { labelHistoryStartOfCurrentMonth } from "@/lib/utils/labelHistory";
import type {
  AlertState,
  CreateBatchInput,
  StockBatch,
  StockBatchWithUnits,
} from "@/lib/types/database";

export function useLabels() {
  const { products, productsLoading, catalogError, refreshProducts } =
    useCatalogCache();
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [historyBatches, setHistoryBatches] = useState<StockBatch[]>([]);
  const [activeBatch, setActiveBatch] = useState<StockBatchWithUnits | null>(
    null
  );
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const refreshBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const recent = await fetchBatches(5);
      setBatches(recent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batches");
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  const loadHistoryBatches = useCallback(async () => {
    setHistoryLoading(true);
    const since = labelHistoryStartOfCurrentMonth();
    try {
      const history = await fetchBatches(0, since);
      setHistoryBatches(history);
      setHistoryLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load history batches"
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    const promises: Promise<unknown>[] = [refreshProducts(), refreshBatches()];
    if (historyLoaded) {
      promises.push(loadHistoryBatches());
    }
    await Promise.all(promises);
  }, [refreshProducts, refreshBatches, historyLoaded, loadHistoryBatches]);

  useEffect(() => {
    if (catalogError) setError(catalogError);
  }, [catalogError]);

  useEffect(() => {
    void refreshBatches();
  }, [refreshBatches]);

  const createBatch = useCallback(
    async (input: CreateBatchInput) => {
      setCreating(true);
      setAlert(null);
      const result = await createStockBatch(input);
      if (result.success && result.data) {
        setAlert({ type: "success", message: result.message });
        setActiveBatch(result.data);
        await refresh();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setCreating(false);
      return result;
    },
    [refresh]
  );

  const loadBatch = useCallback(async (batchId: string) => {
    try {
      const batch = await fetchBatchWithUnits(batchId);
      setActiveBatch(batch);
      return batch;
    } catch (err) {
      setAlert({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load batch",
      });
      return null;
    }
  }, []);

  const dismissAlert = useCallback(() => setAlert(null), []);

  return {
    products,
    batches,
    historyBatches,
    activeBatch,
    loading: productsLoading || batchesLoading,
    historyLoading,
    historyLoaded,
    loadHistoryBatches,
    creating,
    error,
    alert,
    refresh,
    createBatch,
    loadBatch,
    dismissAlert,
  };
}
