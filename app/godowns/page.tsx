"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GodownFormModal } from "@/components/godowns/GodownFormModal";
import { GodownManagementTable } from "@/components/godowns/GodownManagementTable";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useGodownManagement } from "@/hooks/useGodownManagement";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Godown, GodownInput } from "@/lib/types/database";

export default function GodownsPage() {
  const { can } = useAuth();
  const canManageGodowns = can("godowns.manage");

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
    setDeleteTarget(null);
  };

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Godowns" subtitle="Manage warehouse locations">
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

  if (!canManageGodowns) {
    return (
      <DashboardLayout title="Godowns" subtitle="Manage warehouse locations">
        <AlertBanner
          alert={{
            type: "info",
            message:
              "Only admins can manage godown locations. Use View Inventory to see stock levels.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Godowns"
      subtitle="Add, edit, or remove warehouse locations"
      actions={
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
      }
    >
      <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
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
      </div>

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
    </DashboardLayout>
  );
}
