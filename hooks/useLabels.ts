"use client";

import { useCallback, useEffect, useState } from "react";
import { useCatalogCache } from "@/contexts/CatalogCacheContext";
import {
  createStockBatch,
  fetchBatchWithUnits,
  fetchBatches,
} from "@/lib/services/batchService";
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
  const [activeBatch, setActiveBatch] = useState<StockBatchWithUnits | null>(
    null
  );
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const refreshBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const batchesData = await fetchBatches(5);
      setBatches(batchesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batches");
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    await Promise.all([refreshProducts(), refreshBatches()]);
  }, [refreshProducts, refreshBatches]);

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
    activeBatch,
    loading: productsLoading || batchesLoading,
    creating,
    error,
    alert,
    refresh,
    createBatch,
    loadBatch,
    dismissAlert,
  };
}
