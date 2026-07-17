"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StockScanPanel } from "@/components/scan/StockScanPanel";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useInventory } from "@/hooks/useInventory";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function StockOutPage() {
  const { godowns, loading, error } = useInventory();

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Stock Out" subtitle="Remove bags from warehouse">
        <AlertBanner
          alert={{
            type: "info",
            message:
              "Supabase is not configured. Add your keys to .env.local before using stock out.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Stock Out" subtitle="Scan bales to remove bags">
      {loading ? (
        <LoadingSpinner label="Loading godowns…" />
      ) : error ? (
        <AlertBanner alert={{ type: "error", message: error }} />
      ) : (
        <StockScanPanel
          transactionType="STOCK_OUT"
          godowns={godowns}
          title="Stock Out"
        />
      )}
    </DashboardLayout>
  );
}
