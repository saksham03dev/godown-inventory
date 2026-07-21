"use client";

import { useEffect, useState } from "react";
import { ALL_GODOWNS_ID } from "@/lib/constants/inventoryView";
import { useAuth } from "@/contexts/AuthContext";
import { useInventory } from "@/hooks/useInventory";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { GodownStockItem } from "@/lib/types/database";
import { RefreshCw, Search } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GodownFilter } from "@/components/godowns/GodownFilter";
import { InventoryBarChart } from "@/components/inventory/InventoryBarChart";
import { InventoryProductGroups } from "@/components/inventory/InventoryProductGroups";
import { InventorySummary } from "@/components/inventory/InventorySummary";
import { ProductInventoryDetail } from "@/components/inventory/ProductInventoryDetail";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function InventoryPage() {
  const { can } = useAuth();
  const canEditBatch = can("labels");
  const canRelocate = can("inventory.relocate");
  const [selectedGodownId, setSelectedGodownId] = useState(ALL_GODOWNS_ID);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] =
    useState<GodownStockItem | null>(null);
  const [detailGodownId, setDetailGodownId] = useState("");
  const [detailGodownName, setDetailGodownName] = useState("");

  const {
    godowns,
    godownInventory,
    loading,
    error,
    refreshGodownInventory,
  } = useInventory(selectedGodownId || null);

  const isAllStock = selectedGodownId === ALL_GODOWNS_ID;
  const selectedGodown = godowns.find((g) => g.id === selectedGodownId);

  const scopeLabel = isAllStock
    ? `across ${godowns.length} godown${godowns.length === 1 ? "" : "s"}`
    : `in ${selectedGodown?.location_name ?? "godown"}`;

  useEffect(() => {
    setSelectedProduct(null);
    setDetailGodownId("");
    setDetailGodownName("");
    setSearchQuery("");
  }, [selectedGodownId]);

  const handleProductClick = (item: GodownStockItem) => {
    if (isAllStock && item.locations && item.locations.length > 1) {
      setSelectedProduct(item);
      setDetailGodownId("");
      setDetailGodownName("");
      return;
    }

    const location = item.locations?.[0];
    setSelectedProduct(item);
    if (isAllStock && location) {
      setDetailGodownId(location.godown_id);
      setDetailGodownName(location.godown_name);
    } else {
      setDetailGodownId(selectedGodownId);
      setDetailGodownName(selectedGodown?.location_name ?? "Godown");
    }
  };

  const handleGodownPicked = (godownId: string, godownName: string) => {
    setDetailGodownId(godownId);
    setDetailGodownName(godownName);
  };

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
      subtitle="Browse stock by product — expand to see item codes and sizes"
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <GodownFilter
            godowns={godowns}
            selectedId={selectedGodownId}
            onChange={setSelectedGodownId}
            showAllOption
            className="max-w-md flex-1"
          />
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or item code…"
              className="w-full rounded-xl border border-surface-border bg-surface-overlay py-3 pl-10 pr-4 text-sm text-zinc-100 outline-none focus:border-accent"
            />
          </div>
        </div>

        {loading && godowns.length === 0 ? (
          <LoadingSpinner label="Loading inventory…" />
        ) : error ? (
          <AlertBanner alert={{ type: "error", message: error }} />
        ) : !selectedGodownId ? (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised p-12 text-center">
            <p className="text-sm text-zinc-400">
              Select a view to browse inventory.
            </p>
          </div>
        ) : loading ? (
          <LoadingSpinner label="Loading stock…" />
        ) : (
          <>
            <InventorySummary items={godownInventory} scopeLabel={scopeLabel} />
            <InventoryBarChart items={godownInventory} />
            <InventoryProductGroups
              items={godownInventory}
              godownId={selectedGodownId}
              godownName={
                isAllStock ? "all godowns" : selectedGodown?.location_name
              }
              searchQuery={searchQuery}
              onProductClick={handleProductClick}
            />
          </>
        )}
      </div>

      <ProductInventoryDetail
        open={Boolean(selectedProduct)}
        onClose={() => {
          setSelectedProduct(null);
          setDetailGodownId("");
          setDetailGodownName("");
        }}
        product={selectedProduct}
        godownId={detailGodownId}
        godownName={detailGodownName}
        godowns={godowns}
        canEditBatch={canEditBatch}
        canRelocate={canRelocate}
        onGodownPicked={handleGodownPicked}
        onInventoryChanged={() => refreshGodownInventory(selectedGodownId)}
      />
    </DashboardLayout>
  );
}
