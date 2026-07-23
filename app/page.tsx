"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Package, RefreshCw, Warehouse } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { GodownDistributionCards } from "@/components/dashboard/GodownDistributionCards";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useInventory } from "@/hooks/useInventory";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const { metrics, loading, error, refreshMetrics } = useInventory();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && role === "employee") {
      router.replace("/stock-out");
    }
  }, [authLoading, role, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshMetrics();
    setRefreshing(false);
  }, [refreshMetrics]);

  useEffect(() => {
    const interval = setInterval(refreshMetrics, 30_000);
    return () => clearInterval(interval);
  }, [refreshMetrics]);

  if (authLoading || role === "employee") {
    return (
      <DashboardLayout title="Dashboard" subtitle="Overview">
        <LoadingSpinner label="Redirecting…" />
      </DashboardLayout>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Overview">
        <AlertBanner
          alert={{
            type: "info",
            message:
              "Supabase is not configured. Copy .env.local.example to .env.local and add your project keys, then restart the dev server.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Overview"
      actions={
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      }
    >
      {loading && !metrics ? (
        <LoadingSpinner label="Loading dashboard metrics…" />
      ) : error ? (
        <AlertBanner alert={{ type: "error", message: error }} />
      ) : (
        <div className="space-y-8 animate-fade-in">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Active Stock Items"
              value={metrics?.totalActiveProducts ?? 0}
              icon={Package}
              accent="blue"
              trend="Products with stock > 0"
            />
            <StatCard
              label="Total Stock (bags)"
              value={metrics?.totalStockBags ?? 0}
              icon={Boxes}
              accent="green"
              trend="Across all godowns"
            />
            <StatCard
              label="Godown Locations"
              value={metrics?.godownDistribution.length ?? 0}
              icon={Warehouse}
              accent="purple"
              trend="Active warehouse sites"
            />
          </section>

          <section>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Stock Distribution by Godown
            </h2>
            <GodownDistributionCards
              distribution={metrics?.godownDistribution ?? []}
            />
          </section>

          <section>
            <ActivityFeed items={metrics?.recentActivity ?? []} />
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
