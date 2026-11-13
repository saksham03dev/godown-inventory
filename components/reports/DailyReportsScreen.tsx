"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Package,
  Printer,
  RefreshCw,
} from "lucide-react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ActivityLogDetailDialog } from "@/components/dashboard/ActivityLogDetailDialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { TransferReportSection } from "@/components/reports/TransferReportSection";
import { StockOutSlipListRow } from "@/components/slips/StockOutSlipListRow";
import { StockOutSlipManageDialog } from "@/components/slips/StockOutSlipManageDialog";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchDailyReport } from "@/lib/services/dailyReportService";
import { fetchRecentActivityFeed } from "@/lib/services/inventoryService";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  ActivityFeedItem,
  DailyReport,
  InventoryLogWithRelations,
  StockInReportBatch,
  StockOutSlipWithDetails,
} from "@/lib/types/database";
import {
  formatBusinessDateLabel,
  getTodayBusinessDate,
} from "@/lib/utils/businessDay";

function formatSlipWhen(ts: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

type ReportTab = "day" | "transfer";

function StockInBatchRow({ batch }: { batch: StockInReportBatch }) {
  const [open, setOpen] = useState(false);
  const code = batch.product_code?.trim() || batch.product_name;

  return (
    <li className="border-b border-surface-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02] sm:px-5"
      >
        <span className="mt-0.5 text-zinc-500">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">{code}</p>
          <p className="text-xs text-zinc-500">
            {[
              batch.product_code?.trim() ? batch.product_name : null,
              batch.godown_name,
              batch.purchase_no ? `PO ${batch.purchase_no}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-zinc-100">
            {batch.bag_count.toLocaleString("en-IN")} bags
          </p>
          <p className="text-xs text-zinc-500">
            {batch.scan_count} scan{batch.scan_count === 1 ? "" : "s"}
          </p>
        </div>
      </button>
      {open && (
        <ul className="space-y-1 border-t border-surface-border bg-surface-overlay/40 px-4 py-3 sm:px-5">
          {[...batch.logs]
            .sort((a, b) => {
              const an = a.stock_units?.unit_number;
              const bn = b.stock_units?.unit_number;
              if (an == null && bn == null) {
                return (
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime()
                );
              }
              if (an == null) return 1;
              if (bn == null) return -1;
              if (an !== bn) return an - bn;
              return (
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
              );
            })
            .map((log) => {
            const unitNumber = log.stock_units?.unit_number;
            return (
              <li
                key={log.id}
                className="flex justify-between gap-3 text-xs text-zinc-400"
              >
                <span className="min-w-0 truncate">
                  {unitNumber != null ? `Bale #${unitNumber}` : "Bale —"}
                </span>
                <span className="shrink-0 tabular-nums">
                  {Math.round(Number(log.quantity)).toLocaleString("en-IN")} bags
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function DailyReportsScreen() {
  const { can, loading: authLoading } = useAuth();
  const [date, setDate] = useState(getTodayBusinessDate);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<ReportTab>("day");
  const [recentActivity, setRecentActivity] = useState<ActivityFeedItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<InventoryLogWithRelations[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<ActivityFeedItem | null>(null);
  const [slipDialogId, setSlipDialogId] = useState<string | null>(null);

  const slipForDialog = useMemo(
    () => report?.slips.find((s) => s.id === slipDialogId) ?? null,
    [report, slipDialogId]
  );

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const { activity, logs } = await fetchRecentActivityFeed(10);
      setRecentActivity(activity);
      setRecentLogs(logs);
    } catch {
      setRecentActivity([]);
      setRecentLogs([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const load = useCallback(async (day: string) => {
    setError(null);
    try {
      const [data] = await Promise.all([fetchDailyReport(day), loadActivity()]);
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load report.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadActivity]);

  const handleSlipUpdated = useCallback(
    (next: StockOutSlipWithDetails) => {
      setReport((prev) =>
        prev
          ? {
              ...prev,
              slips: prev.slips.map((s) => (s.id === next.id ? next : s)),
            }
          : prev
      );
      void load(date);
    },
    [date, load]
  );

  useEffect(() => {
    if (authLoading || !can("reports.view")) return;
    setLoading(true);
    void load(date);
  }, [authLoading, can, date, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    void load(date);
  };

  const handlePrint = () => {
    window.print();
  };

  if (authLoading) {
    return (
      <DashboardLayout title="Daily Reports" subtitle="Business day pack">
        <LoadingSpinner label="Loading…" />
      </DashboardLayout>
    );
  }

  if (!can("reports.view")) {
    return (
      <DashboardLayout title="Daily Reports" subtitle="Business day pack">
        <AlertBanner
          alert={{ type: "error", message: "You do not have access to reports." }}
        />
      </DashboardLayout>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Daily Reports" subtitle="Business day pack">
        <AlertBanner
          alert={{
            type: "info",
            message:
              "Supabase is not configured. Add keys to .env.local and restart the dev server.",
          }}
        />
      </DashboardLayout>
    );
  }

  const summary = report?.summary;
  const today = getTodayBusinessDate();

  return (
    <DashboardLayout
      title="Daily Reports"
      subtitle={formatBusinessDateLabel(date)}
      actions={
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!report}
            className="inline-flex items-center gap-2 rounded-xl bg-accent/20 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/30 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      }
    >
      <div className="space-y-6" id="daily-report-print-area">
        <div className="print:hidden">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Business day
          </label>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              const next = e.target.value;
              if (next) setDate(next);
            }}
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent sm:w-64"
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            Day runs midnight–midnight Asia/Kolkata. Stock-in batches club same
            product + warehouse + purchase no (or similar source). Transfer
            shows bales scanned out of one godown and not stocked in the other.
          </p>
        </div>

        <div className="hidden print:block">
          <h1 className="text-xl font-bold text-black">Daily Report</h1>
          <p className="text-sm text-zinc-700">
            {formatBusinessDateLabel(date)} · Store IMS
          </p>
        </div>

        {error && (
          <div className="print:hidden">
            <AlertBanner alert={{ type: "error", message: error }} />
          </div>
        )}

        {loading && !report ? (
          <LoadingSpinner label="Loading day pack…" />
        ) : report && summary ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-success/30 bg-success/10 p-6 print:border-zinc-300 print:bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-success print:text-zinc-600">
                      Bags in
                    </p>
                    <p className="mt-2 text-4xl font-bold tabular-nums text-zinc-50 print:text-black sm:text-5xl">
                      {summary.bags_in.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/20 text-success print:bg-zinc-100 print:text-zinc-700">
                    <ArrowDownLeft className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 print:border-zinc-300 print:bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 print:text-zinc-600">
                      Bags out
                    </p>
                    <p className="mt-2 text-4xl font-bold tabular-nums text-zinc-50 print:text-black sm:text-5xl">
                      {summary.bags_out.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 print:bg-zinc-100 print:text-zinc-700">
                    <ArrowUpRight className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Stock-in batches"
                value={summary.stock_in_batch_count}
                icon={Package}
              />
              <StatCard
                label="Stock-out slips"
                value={summary.slip_count}
                icon={ClipboardList}
              />
              <StatCard
                label="Transfers"
                value={summary.transfer_count}
                icon={ArrowLeftRight}
                trend={
                  summary.transfer_count === 0
                    ? "None this day"
                    : summary.transfer_unstocked_count > 0
                      ? `${summary.transfer_unstocked_count} not stocked in`
                      : "All stocked in"
                }
              />
            </div>

            <div
              className="flex gap-1 rounded-2xl border border-surface-border bg-surface-raised p-1 print:hidden"
              role="tablist"
              aria-label="Daily report view"
            >
              {(
                [
                  ["day", "Stock in & out"],
                  ["transfer", "Transfer"],
                ] as const
              ).map(([id, label]) => {
                const active = tab === id;
                const alert =
                  id === "transfer" && summary.transfer_unstocked_count > 0;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-accent/15 text-zinc-50"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                  >
                    {label}
                    {alert ? (
                      <span className="rounded-full bg-danger/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-danger">
                        {summary.transfer_unstocked_count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div
              className={`space-y-6 ${tab === "day" ? "block" : "hidden print:block"}`}
            >
              <section className="overflow-hidden rounded-2xl border border-success/35 bg-success/5 print:border-zinc-300 print:bg-white">
                <div className="border-b border-success/25 bg-success/10 px-5 py-3 print:border-zinc-300 print:bg-white">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-success print:text-black">
                    Stock in
                  </h2>
                </div>
                {report.stockInBatches.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-zinc-500">
                    No stock-in scans this day.
                  </p>
                ) : (
                  <ul>
                    {report.stockInBatches.map((batch) => (
                      <StockInBatchRow key={batch.id} batch={batch} />
                    ))}
                  </ul>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-amber-500/35 bg-amber-500/5 print:border-zinc-300 print:bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-amber-500/25 bg-amber-500/10 px-5 py-3 print:border-zinc-300 print:bg-white">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300 print:text-black">
                    Stock out
                  </h2>
                  <Link
                    href="/stock-out-slips"
                    className="text-xs font-medium text-amber-200 hover:underline print:hidden"
                  >
                    Open slips
                  </Link>
                </div>
                {report.slips.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-zinc-500">
                    No stock-out slips this day.
                  </p>
                ) : (
                  <ul className="divide-y divide-amber-500/10">
                    {report.slips.map((slip) => (
                      <li
                        key={slip.id}
                        className="print:pointer-events-none"
                      >
                        <StockOutSlipListRow
                          slip={slip}
                          active={slipDialogId === slip.id}
                          onSelect={() => setSlipDialogId(slip.id)}
                          formatWhen={formatSlipWhen}
                          tone="amber"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className={tab === "transfer" ? "block" : "hidden print:block"}>
              <TransferReportSection records={report.transfers ?? []} />
            </div>
          </>
        ) : null}

        <section className="print:hidden">
          {activityLoading && recentActivity.length === 0 ? (
            <LoadingSpinner label="Loading recent logs…" />
          ) : (
            <ActivityFeed
              items={recentActivity}
              onSelect={setDetailItem}
            />
          )}
        </section>
      </div>

      <ActivityLogDetailDialog
        open={Boolean(detailItem)}
        item={detailItem}
        logs={recentLogs}
        onClose={() => setDetailItem(null)}
      />

      <StockOutSlipManageDialog
        open={Boolean(slipDialogId)}
        slipId={slipDialogId}
        initialSlip={slipForDialog}
        onClose={() => setSlipDialogId(null)}
        onUpdated={handleSlipUpdated}
      />

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #daily-report-print-area,
          #daily-report-print-area * {
            visibility: visible;
          }
          #daily-report-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
          }
          #daily-report-print-area .hidden {
            display: block !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
