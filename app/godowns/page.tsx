"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GodownFilter } from "@/components/godowns/GodownFilter";
import { GodownFormModal } from "@/components/godowns/GodownFormModal";
import { GodownManagementTable } from "@/components/godowns/GodownManagementTable";
import { InventoryTable } from "@/components/godowns/InventoryTable";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useGodownManagement } from "@/hooks/useGodownManagement";
import { useInventory } from "@/hooks/useInventory";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Godown, GodownInput } from "@/lib/types/database";

type Tab = "locations" | "inventory";

export default function GodownsPage() {
  const { can } = useAuth();
  const canManageGodowns = can("godowns.manage");

  const [activeTab, setActiveTab] = useState<Tab>(
    canManageGodowns ? "locations" : "inventory"
  );
  const [selectedGodownId, setSelectedGodownId] = useState<string>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Godown | null>(null);

  const {
    godowns,
    loading: godownsLoading,
    mutating,
    error: godownsError,
    alert: godownsAlert,
    refresh: refreshGodowns,
    addGodown,
    editGodown,
    removeGodown,
    dismissAlert: dismissGodownsAlert,
  } = useGodownManagement();

  const { godownInventory, loading: inventoryLoading, error: inventoryError, refreshGodownInventory } =
    useInventory(selectedGodownId || null);

  const selectedGodown = useMemo(
    () => godowns.find((g) => g.id === selectedGodownId),
    [godowns, selectedGodownId]
  );

  const handleAdd = () => {
    setEditingGodown(null);
    setFormOpen(true);
  };

  const handleEdit = (godown: Godown) => {
    setEditingGodown(godown);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingGodown(null);
  };

  const handleSubmit = async (input: GodownInput) => {
    const result = editingGodown
      ? await editGodown(editingGodown.id, input)
      : await addGodown(input);

    if (result.success) {
      handleFormClose();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await removeGodown(deleteTarget.id);
    if (selectedGodownId === deleteTarget.id) {
      setSelectedGodownId("");
    }
    setDeleteTarget(null);
  };

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Godowns" subtitle="Manage warehouses and inventory">
        <AlertBanner
          alert={{
            type: "info",
            message:
              "Supabase is not configured. Add your keys to .env.local to manage godowns.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Godowns"
      subtitle={
        canManageGodowns
          ? "Manage warehouse locations and view per-site inventory"
          : "View per-site inventory by godown"
      }
      actions={
        activeTab === "locations" && canManageGodowns ? (
          <div className="flex items-center gap-2">
            <button
              onClick={refreshGodowns}
              disabled={godownsLoading}
              className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${godownsLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-muted"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Godown</span>
            </button>
          </div>
        ) : selectedGodownId ? (
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
        <div className="flex gap-1 rounded-xl border border-surface-border bg-surface-raised p-1">
          {canManageGodowns && (
            <button
              onClick={() => setActiveTab("locations")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium capitalize transition ${
                activeTab === "locations"
                  ? "bg-accent/15 text-accent"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Manage Locations
            </button>
          )}
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium capitalize transition ${
              activeTab === "inventory"
                ? "bg-accent/15 text-accent"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            View Inventory
          </button>
        </div>

        {activeTab === "locations" && canManageGodowns && (
          <>
            {godownsAlert && (
              <AlertBanner alert={godownsAlert} onDismiss={dismissGodownsAlert} />
            )}
            {godownsLoading ? (
              <LoadingSpinner label="Loading godowns…" />
            ) : godownsError ? (
              <AlertBanner alert={{ type: "error", message: godownsError }} />
            ) : (
              <GodownManagementTable
                godowns={godowns}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
              />
            )}
          </>
        )}

        {activeTab === "inventory" && (
          <>
            <GodownFilter
              godowns={godowns}
              selectedId={selectedGodownId}
              onChange={setSelectedGodownId}
              className="max-w-sm"
            />

            {inventoryError ? (
              <AlertBanner alert={{ type: "error", message: inventoryError }} />
            ) : !selectedGodownId ? (
              <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised p-12 text-center">
                <p className="text-sm text-zinc-400">
                  Select a godown to view its product allocation.
                </p>
              </div>
            ) : inventoryLoading ? (
              <LoadingSpinner
                label={`Loading ${selectedGodown?.location_name}…`}
              />
            ) : (
              <>
                <p className="text-sm text-zinc-400">
                  Showing{" "}
                  <span className="font-medium text-zinc-200">
                    {godownInventory.length}
                  </span>{" "}
                  product{godownInventory.length !== 1 ? "s" : ""} in{" "}
                  <span className="font-medium text-zinc-200">
                    {selectedGodown?.location_name}
                  </span>
                </p>
                <InventoryTable
                  items={godownInventory}
                  godownName={selectedGodown?.location_name}
                />
              </>
            )}
          </>
        )}
      </div>

      {canManageGodowns && (
        <>
          <GodownFormModal
            open={formOpen}
            onClose={handleFormClose}
            onSubmit={handleSubmit}
            godown={editingGodown}
            loading={mutating}
          />

          <ConfirmDialog
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDeleteConfirm}
            title="Delete Godown"
            message={`Are you sure you want to delete "${deleteTarget?.location_name}"? All inventory logs for this location will be removed.`}
            loading={mutating}
          />
        </>
      )}
    </DashboardLayout>
  );
}
