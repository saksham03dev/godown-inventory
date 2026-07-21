"use client";

import { useCallback, useEffect, useState } from "react";
import { useCatalogCache } from "@/contexts/CatalogCacheContext";
import {
  createGodown,
  deleteGodown,
  updateGodown,
} from "@/lib/services/godownService";
import type { AlertState, GodownInput } from "@/lib/types/database";

export function useGodownManagement() {
  const { godowns, godownsLoading, catalogError, refreshGodowns } =
    useCatalogCache();
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  useEffect(() => {
    if (catalogError) setError(catalogError);
  }, [catalogError]);

  const refresh = useCallback(async () => {
    setError(null);
    await refreshGodowns();
  }, [refreshGodowns]);

  const addGodown = useCallback(
    async (input: GodownInput) => {
      setMutating(true);
      setAlert(null);
      const result = await createGodown(input);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refreshGodowns();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refreshGodowns]
  );

  const editGodown = useCallback(
    async (id: string, input: GodownInput) => {
      setMutating(true);
      setAlert(null);
      const result = await updateGodown(id, input);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refreshGodowns();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refreshGodowns]
  );

  const removeGodown = useCallback(
    async (id: string) => {
      setMutating(true);
      setAlert(null);
      const result = await deleteGodown(id);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refreshGodowns();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refreshGodowns]
  );

  const dismissAlert = useCallback(() => setAlert(null), []);

  return {
    godowns,
    loading: godownsLoading,
    mutating,
    error,
    alert,
    refresh,
    addGodown,
    editGodown,
    removeGodown,
    dismissAlert,
  };
}
