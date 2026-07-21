"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StockScanPanel } from "@/components/scan/StockScanPanel";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useInventory } from "@/hooks/useInventory";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function StockInPage() {
  const { godowns, loading, error } = useInventory();

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Stock In" subtitle="Receive bales into godown">
        <AlertBanner
          alert={{
            type: "info",
            message:
              "Supabase is not configured. Add your keys to .env.local before using stock in.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Stock In" subtitle="Scan bundle labels into a warehouse">
      {loading ? (
        <LoadingSpinner label="Loading warehouses…" />
      ) : error ? (
        <AlertBanner alert={{ type: "error", message: error }} />
      ) : (
        <StockScanPanel
          transactionType="STOCK_IN"
          godowns={godowns}
          title="Stock In"
        />
      )}
    </DashboardLayout>
  );
}
