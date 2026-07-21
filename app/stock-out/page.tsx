"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StockOutScanPanel } from "@/components/scan/StockOutScanPanel";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function StockOutPage() {
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
    <DashboardLayout
      title="Stock Out"
      subtitle="Wholesale bundles or retail by bags"
    >
      <StockOutScanPanel />
    </DashboardLayout>
  );
}
