"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchGodowns } from "@/lib/services/inventoryService";
import {
  createGodown,
  deleteGodown,
  updateGodown,
} from "@/lib/services/godownService";
import type { AlertState, Godown, GodownInput } from "@/lib/types/database";

export function useGodownManagement() {
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGodowns();
      setGodowns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load godowns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addGodown = useCallback(
    async (input: GodownInput) => {
      setMutating(true);
      setAlert(null);
      const result = await createGodown(input);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refresh();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refresh]
  );

  const editGodown = useCallback(
    async (id: string, input: GodownInput) => {
      setMutating(true);
      setAlert(null);
      const result = await updateGodown(id, input);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refresh();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refresh]
  );

  const removeGodown = useCallback(
    async (id: string) => {
      setMutating(true);
      setAlert(null);
      const result = await deleteGodown(id);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refresh();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refresh]
  );

  const dismissAlert = useCallback(() => setAlert(null), []);

  return {
    godowns,
    loading,
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
