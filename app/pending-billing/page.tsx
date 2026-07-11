"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus, RefreshCw, Send } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PendingUnitsTable } from "@/components/billing/PendingUnitsTable";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingBilling } from "@/hooks/usePendingBilling";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function PendingBillingPage() {
  const router = useRouter();
  const { can } = useAuth();
  const canCreateBill = can("billing.create");

  const [godownFilter, setGodownFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetBillId, setTargetBillId] = useState("");

  const {
    units,
    godowns,
    draftBills,
    loading,
    mutating,
    error,
    alert,
    refresh,
    billSelected,
    addSelectedToBill,
    dismissAlert,
  } = usePendingBilling(godownFilter || null);

  const godownOptions: DropdownOption[] = useMemo(
    () => [
      { value: "", label: "All locations" },
      ...godowns.map((g) => ({
        value: g.id,
        label: g.location_name,
      })),
    ],
    [godowns]
  );

  const draftOptions: DropdownOption[] = useMemo(
    () => [
      { value: "", label: "New bill" },
      ...draftBills.map((b) => ({
        value: b.id,
        label: `${b.bill_number} · ₹${Number(b.total).toFixed(2)}`,
      })),
    ],
    [draftBills]
  );

  const selectedBarcodes = useMemo(
    () =>
      units
        .filter((u) => selectedIds.has(u.id))
        .map((u) => u.unit_barcode),
    [units, selectedIds]
  );

  const toggle = (unitId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (units.every((u) => prev.has(u.id))) return new Set();
      return new Set(units.map((u) => u.id));
    });
  };

  const handleSend = async () => {
    if (selectedBarcodes.length === 0 || !canCreateBill) return;

    const result = targetBillId
      ? await addSelectedToBill(targetBillId, selectedBarcodes)
      : await billSelected(selectedBarcodes);

    if (result.success && result.data) {
      setSelectedIds(new Set());
      router.push(`/billing?billId=${result.data.id}`);
    } else {
      await refresh();
      setSelectedIds(new Set());
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout
        title="Pending Billing"
        subtitle="Stocked-out units awaiting invoice"
      >
        <AlertBanner
          alert={{
            type: "info",
            message: "Configure Supabase in .env.local to use pending billing.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Pending Billing"
      subtitle="Stocked-out units not yet billed — send to an invoice without rescanning"
      actions={
        <button
          onClick={() => {
            setSelectedIds(new Set());
            refresh();
          }}
          className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
        {alert && <AlertBanner alert={alert} onDismiss={dismissAlert} />}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Dropdown
            label="Stocked out from"
            options={godownOptions}
            value={godownFilter}
            onChange={(value) => {
              setGodownFilter(value);
              setSelectedIds(new Set());
            }}
            placeholder="All locations"
            className="max-w-md sm:w-72"
          />

          {canCreateBill && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Dropdown
                label="Send to"
                options={draftOptions}
                value={targetBillId}
                onChange={setTargetBillId}
                placeholder="New bill"
                className="sm:w-56"
              />
              <button
                onClick={handleSend}
                disabled={mutating || selectedBarcodes.length === 0}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
              >
                {targetBillId ? (
                  <Send className="h-4 w-4" />
                ) : (
                  <FilePlus className="h-4 w-4" />
                )}
                {targetBillId
                  ? `Add ${selectedBarcodes.length || ""} to bill`
                  : `Bill ${selectedBarcodes.length || ""} selected`}
              </button>
            </div>
          )}
        </div>

        {!canCreateBill && (
          <p className="text-xs text-zinc-500">
            You can view pending units. Managers and admins can send them to
            billing.
          </p>
        )}

        {loading ? (
          <LoadingSpinner label="Loading pending units…" />
        ) : error ? (
          <AlertBanner alert={{ type: "error", message: error }} />
        ) : (
          <>
            <p className="text-xs text-zinc-500">
              {units.length} pending unit{units.length === 1 ? "" : "s"}
              {selectedBarcodes.length > 0
                ? ` · ${selectedBarcodes.length} selected`
                : ""}
            </p>
            <PendingUnitsTable
              units={units}
              selectedIds={selectedIds}
              onToggle={toggle}
              onToggleAll={toggleAll}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
