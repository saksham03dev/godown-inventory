"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { OpenBalesTable } from "@/components/billing/OpenBalesTable";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useOpenBales } from "@/hooks/useOpenBales";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { formatBagCount } from "@/lib/utils/inventory";

export default function OpenBalesPage() {
  const [godownFilter, setGodownFilter] = useState("");
  const { units, godowns, loading, error, refresh } = useOpenBales(
    godownFilter || null
  );

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

  const totalBags = units.reduce((sum, u) => sum + u.remaining_bags, 0);

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Open Bales">
        <AlertBanner
          alert={{
            type: "info",
            message: "Configure Supabase in .env.local to view open bales.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Open Bales"
      actions={
        <button
          onClick={() => refresh()}
          className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Dropdown
            label="Godown"
            options={godownOptions}
            value={godownFilter}
            onChange={setGodownFilter}
            placeholder="All locations"
            className="max-w-md sm:w-72"
          />

          <Link
            href="/stock-out"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-muted"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Stock Out
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading open bales…" />
        ) : error ? (
          <AlertBanner alert={{ type: "error", message: error }} />
        ) : (
          <>
            <p className="text-xs text-zinc-500">
              {units.length} open bale{units.length === 1 ? "" : "s"} ·{" "}
              {formatBagCount(totalBags)} bags remaining
            </p>
            <OpenBalesTable units={units} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
