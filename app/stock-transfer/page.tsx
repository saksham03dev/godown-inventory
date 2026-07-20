"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TransferScanPanel } from "@/components/scan/InventoryMovementPanels";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useInventory } from "@/hooks/useInventory";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function StockTransferPage() {
  const { godowns, loading, error } = useInventory();

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Transfer" subtitle="Dispatch at source, then receive at destination — two scans per bale">
        <AlertBanner
          alert={{
            type: "info",
            message: "Supabase is not configured.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Transfer"
      subtitle="Dispatch at source, then receive at destination — two scans per bale"
    >
      {loading ? (
        <LoadingSpinner label="Loading godowns…" />
      ) : error ? (
        <AlertBanner alert={{ type: "error", message: error }} />
      ) : godowns.length < 2 ? (
        <AlertBanner
          alert={{
            type: "info",
            message: "Add at least two godowns before transferring stock.",
          }}
        />
      ) : (
        <TransferScanPanel godowns={godowns} />
      )}
    </DashboardLayout>
  );
}
