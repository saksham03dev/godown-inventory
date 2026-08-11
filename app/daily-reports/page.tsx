"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Package,
  Printer,
  RefreshCw,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { BILLING_ENABLED } from "@/lib/constants/features";
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

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 print:grid-cols-3">
              <StatCard
                label="Bags in"
                value={summary.bags_in.toLocaleString("en-IN")}
                icon={ArrowDownLeft}
                accent="green"
              />
              <StatCard
                label="Bags out"
                value={summary.bags_out.toLocaleString("en-IN")}
                icon={ArrowUpRight}
                accent="amber"
              />
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
                label="Finalized bills"
                value={summary.bill_count}
                icon={FileText}
                accent="purple"
              />
              <StatCard
                label="Bill total"
                value={formatInr(summary.bill_total)}
                icon={FileText}
                accent="green"
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
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-zinc-100 print:text-black">
                            {slip.biller_name?.trim() || "No biller"}
                            {slip.bill_no?.trim()
                              ? ` · Bill ${slip.bill_no.trim()}`
                              : ""}
                          </p>
                          <p className="text-xs text-zinc-500 print:text-zinc-600">
                            {formatDateTime(slip.confirmed_at)} ·{" "}
                            {slip.sale_channel === "RETAIL"
                              ? "Retail"
                              : "Wholesale"}
                            {slip.created_by_label
                              ? ` · ${slip.created_by_label}`
                              : ""}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-zinc-100 print:text-black">
                          {slip.total_bags.toLocaleString("en-IN")} bags ·{" "}
                          {slip.total_bales} bale
                          {slip.total_bales === 1 ? "" : "s"}
                        </p>
                      </div>
                      {slip.stock_out_slip_lines.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {slip.stock_out_slip_lines.map((line) => (
                            <li
                              key={line.id}
                              className="flex justify-between gap-3 text-xs text-zinc-400 print:text-zinc-700"
                            >
                              <span>
                                {line.products?.product_code?.trim() ||
                                  line.products?.name ||
                                  "Product"}
                                {line.products?.name && line.products?.product_code
                                  ? ` · ${line.products.name}`
                                  : ""}
                              </span>
                              <span>
                                {line.bag_count.toLocaleString("en-IN")} bags ·{" "}
                                {line.bale_count} label
                                {line.bale_count === 1 ? "" : "s"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-surface-border bg-surface-raised print:border-zinc-300 print:bg-white">
              <div className="border-b border-surface-border px-5 py-4 print:border-zinc-300">
                <h2 className="font-medium text-zinc-100 print:text-black">
                  Sales — finalized bills
                </h2>
                <p className="text-xs text-zinc-500 print:text-zinc-600">
                  {BILLING_ENABLED
                    ? "Finalized invoices stamped to this business day."
                    : "Finalized bills for this day (billing UI may be off)."}
                </p>
              </div>
              {report.bills.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-zinc-500">
                  No finalized bills this day.
                </p>
              ) : (
                <ul className="divide-y divide-surface-border print:divide-zinc-200">
                  {report.bills.map((bill) => (
                    <li
                      key={bill.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-100 print:text-black">
                          {bill.bill_number}
                          {bill.customer_name
                            ? ` · ${bill.customer_name}`
                            : ""}
                        </p>
                        <p className="text-xs text-zinc-500 print:text-zinc-600">
                          {bill.finalized_at
                            ? formatDateTime(bill.finalized_at)
                            : "—"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-zinc-100 print:text-black">
                        {formatInr(Number(bill.total))}
                      </p>
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
