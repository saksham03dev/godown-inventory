"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Package,
  Printer,
  RefreshCw,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchDailyReport } from "@/lib/services/dailyReportService";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { DailyReport, StockInReportBatch } from "@/lib/types/database";
import {
  formatBusinessDateLabel,
  getTodayBusinessDate,
} from "@/lib/utils/businessDay";

function formatTime(ts: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function formatDateTime(ts: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function StockInBatchRow({ batch }: { batch: StockInReportBatch }) {
  const [open, setOpen] = useState(false);
  const title = batch.product_code?.trim() || batch.product_name;
  const timeRange =
    batch.started_at === batch.ended_at
      ? formatTime(batch.started_at)
      : `${formatTime(batch.started_at)} – ${formatTime(batch.ended_at)}`;

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
          <p className="truncate text-sm font-medium text-zinc-100">{title}</p>
          <p className="text-xs text-zinc-500">
            {[
              batch.product_code?.trim() ? batch.product_name : null,
              batch.godown_name,
              timeRange,
              batch.handled_by ? `By ${batch.handled_by}` : null,
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
          {batch.logs.map((log) => (
            <li
              key={log.id}
              className="flex justify-between gap-3 text-xs text-zinc-400"
            >
              <span>{formatDateTime(log.timestamp)}</span>
              <span>
                {Math.round(Number(log.quantity)).toLocaleString("en-IN")} bags
                {log.handled_by ? ` · ${log.handled_by}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function DailyReportsPage() {
  const { can, loading: authLoading } = useAuth();
  const [date, setDate] = useState(getTodayBusinessDate);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (day: string) => {
    setError(null);
    try {
      const data = await fetchDailyReport(day);
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load report.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !can("dashboard")) return;
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

  if (!can("dashboard")) {
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
            product + warehouse within 15 minutes.
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
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>

            <section className="rounded-2xl border border-surface-border bg-surface-raised print:border-zinc-300 print:bg-white">
              <div className="border-b border-surface-border px-5 py-4 print:border-zinc-300">
                <h2 className="font-medium text-zinc-100 print:text-black">
                  Stock in — purchase match
                </h2>
                <p className="text-xs text-zinc-500 print:text-zinc-600">
                  Clubbed by product + warehouse (≤15 min gap). Match to physical
                  purchase bills.
                </p>
              </div>
              {report.stockInBatches.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-zinc-500">
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

            <section className="rounded-2xl border border-surface-border bg-surface-raised print:border-zinc-300 print:bg-white">
              <div className="flex items-start justify-between gap-3 border-b border-surface-border px-5 py-4 print:border-zinc-300">
                <div>
                  <h2 className="font-medium text-zinc-100 print:text-black">
                    Stock-out slips
                  </h2>
                  <p className="text-xs text-zinc-500 print:text-zinc-600">
                    Confirmed slips for this business day — match to physical
                    stock-out slips.
                  </p>
                </div>
                <Link
                  href="/stock-out-slips"
                  className="text-xs font-medium text-accent hover:underline print:hidden"
                >
                  Open slips
                </Link>
              </div>
              {report.slips.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-zinc-500">
                  No stock-out slips this day.
                </p>
              ) : (
                <ul className="divide-y divide-surface-border print:divide-zinc-200">
                  {report.slips.map((slip) => (
                    <li key={slip.id} className="px-5 py-4">
                      <p className="mb-3 text-xs text-zinc-500 print:text-zinc-600">
                        {[
                          formatDateTime(slip.confirmed_at),
                          slip.sale_channel === "RETAIL"
                            ? "Retail"
                            : "Wholesale",
                          slip.biller_name?.trim() || null,
                          slip.bill_no?.trim()
                            ? `Bill ${slip.bill_no.trim()}`
                            : null,
                          slip.created_by_label || null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {slip.stock_out_slip_lines.length > 0 ? (
                        <ul className="space-y-2">
                          {slip.stock_out_slip_lines.map((line) => {
                            const code =
                              line.products?.product_code?.trim() ||
                              line.products?.name ||
                              "Product";
                            return (
                              <li
                                key={line.id}
                                className="flex items-baseline justify-between gap-4"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-lg font-semibold tabular-nums tracking-wide text-zinc-50 print:text-black">
                                    {code}
                                  </p>
                                  {line.products?.name &&
                                  line.products?.product_code?.trim() ? (
                                    <p className="truncate text-xs text-zinc-500 print:text-zinc-600">
                                      {line.products.name}
                                    </p>
                                  ) : null}
                                </div>
                                <p className="shrink-0 text-xl font-bold tabular-nums text-zinc-50 print:text-black">
                                  {line.bag_count.toLocaleString("en-IN")}
                                  <span className="ml-1 text-sm font-medium text-zinc-400 print:text-zinc-600">
                                    bags
                                  </span>
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-zinc-500">No lines on this slip.</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>

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
        }
      `}</style>
    </DashboardLayout>
  );
}
