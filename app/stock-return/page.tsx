"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ReturnScanPanel } from "@/components/scan/InventoryMovementPanels";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useInventory } from "@/hooks/useInventory";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function StockReturnPage() {
  const { godowns, loading, error } = useInventory();

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Return Stock" subtitle="Put goods back into inventory">
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
      title="Return Stock"
      subtitle="Scan bales to restore bags into a godown"
    >
      {loading ? (
        <LoadingSpinner label="Loading godowns…" />
      ) : error ? (
        <AlertBanner alert={{ type: "error", message: error }} />
      ) : (
        <ReturnScanPanel godowns={godowns} />
      )}
    </DashboardLayout>
  );
}
