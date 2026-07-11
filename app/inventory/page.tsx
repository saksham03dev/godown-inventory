"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GodownFilter } from "@/components/godowns/GodownFilter";
import { InventoryTable } from "@/components/godowns/InventoryTable";
import { GodownInventoryCharts } from "@/components/inventory/GodownInventoryCharts";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useInventory } from "@/hooks/useInventory";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function InventoryPage() {
  const [selectedGodownId, setSelectedGodownId] = useState("");

  const {
    godowns,
    godownInventory,
    loading,
    error,
    refreshGodownInventory,
  } = useInventory(selectedGodownId || null);

  const selectedGodown = useMemo(
    () => godowns.find((g) => g.id === selectedGodownId),
    [godowns, selectedGodownId]
  );

  useEffect(() => {
    if (godowns.length > 0 && !selectedGodownId) {
      setSelectedGodownId(godowns[0].id);
    }
  }, [godowns, selectedGodownId]);

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="View Inventory" subtitle="Stock by godown">
        <AlertBanner
          alert={{
            type: "info",
            message:
              "Supabase is not configured. Add your keys to .env.local to view inventory.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="View Inventory"
      subtitle="Select a godown to see product stock levels and breakdowns"
      actions={
        selectedGodownId ? (
          <button
            onClick={() => refreshGodownInventory(selectedGodownId)}
            className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        ) : undefined
      }
    >
      <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
        <GodownFilter
          godowns={godowns}
          selectedId={selectedGodownId}
          onChange={setSelectedGodownId}
          className="max-w-md"
        />

        {loading && !selectedGodown ? (
          <LoadingSpinner label="Loading godowns…" />
        ) : error ? (
          <AlertBanner alert={{ type: "error", message: error }} />
        ) : !selectedGodownId ? (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised p-12 text-center">
            <p className="text-sm text-zinc-400">
              Select a godown to view its inventory.
            </p>
          </div>
        ) : loading ? (
          <LoadingSpinner
            label={`Loading ${selectedGodown?.location_name}…`}
          />
        ) : (
          <>
            <GodownInventoryCharts
              items={godownInventory}
              godownName={selectedGodown?.location_name ?? "Godown"}
            />
            <InventoryTable
              items={godownInventory}
              godownName={selectedGodown?.location_name}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
