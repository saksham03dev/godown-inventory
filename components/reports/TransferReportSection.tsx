import { AlertTriangle, CheckCircle2, Flag } from "lucide-react";
import type { TransferReportRecord } from "@/lib/types/database";

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

function baleLabel(record: TransferReportRecord): string {
  return record.unit_number != null ? `Bale #${record.unit_number}` : "Bale —";
}

function statusText(status: TransferReportRecord["unit_status"]): string {
  switch (status) {
    case "IN_TRANSIT":
      return "In transit";
    case "STOCKED_IN":
      return "Stocked in";
    case "STOCKED_OUT":
      return "Stocked out";
    case "LABELLED":
      return "Labelled";
    default:
      return "Unknown";
  }
}

function ResultBadge({ record }: { record: TransferReportRecord }) {
  if (record.not_stocked_in_destination) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger print:text-red-700">
        <Flag className="h-3 w-3" />
        Not stocked in
      </span>
    );
  }
  if (record.missing_receive_scan) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400 print:text-amber-700">
        Receive scan missing
      </span>
    );
  }
  if (record.scanned_in) {
    return (
      <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success print:text-green-700">
        Received
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs font-medium text-zinc-400">
      Dispatched
    </span>
  );
}

export function TransferReportSection({
  records,
}: {
  records: TransferReportRecord[];
}) {
  const checklist = records.filter((row) => row.missing_receive_scan);
  const flagged = records.filter((row) => row.not_stocked_in_destination);
  const barcodes = [
    ...new Set(
      checklist
        .map((row) => row.unit_barcode?.trim())
        .filter((code): code is string => Boolean(code))
    ),
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-surface-border bg-surface-raised print:border-zinc-300 print:bg-white">
        <div className="border-b border-surface-border px-5 py-4 print:border-zinc-300">
          <h2 className="font-medium text-zinc-100 print:text-black">
            Transfer records
          </h2>
          <p className="text-xs text-zinc-500 print:text-zinc-600">
            Bales dispatched from one godown and received at another on this
            business day. A receive that lands the next day still closes the
            dispatch.
          </p>
        </div>
        {records.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">
            No transfers this day.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border print:divide-zinc-200">
            {records.map((row) => (
              <li key={row.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 print:text-black">
                      {baleLabel(row)}
                      {row.unit_barcode ? (
                        <span className="ml-2 font-mono text-xs font-medium text-zinc-400 print:text-zinc-700">
                          {row.unit_barcode}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500 print:text-zinc-600">
                      {[
                        row.product_code,
                        row.product_name,
                        row.bags
                          ? `${row.bags.toLocaleString("en-IN")} bags`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <ResultBadge record={row} />
                </div>
                <p className="mt-2 text-sm text-zinc-300 print:text-black">
                  {row.from_godown_name ?? "Source godown"}
                  <span className="mx-1.5 text-zinc-600">→</span>
                  {row.to_godown_name ?? "Destination godown"}
                </p>
                <p className="mt-1 text-xs text-zinc-500 print:text-zinc-600">
                  {[
                    row.dispatched_at
                      ? `Out ${formatDateTime(row.dispatched_at)}${
                          row.dispatched_by ? ` · ${row.dispatched_by}` : ""
                        }`
                      : null,
                    row.received_at
                      ? `In ${formatDateTime(row.received_at)}${
                          row.received_by ? ` · ${row.received_by}` : ""
                        }`
                      : "Not scanned in",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-surface-border bg-surface-raised print:border-zinc-300 print:bg-white">
        <div className="border-b border-surface-border px-5 py-4 print:border-zinc-300">
          <h2 className="font-medium text-zinc-100 print:text-black">
            Stock-out checklist
          </h2>
          <p className="text-xs text-zinc-500 print:text-zinc-600">
            Bale numbers and unique barcodes scanned out of one godown and not
            scanned into the other.
          </p>
        </div>
        {checklist.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">
            Every dispatched bale was scanned into the destination godown.
          </p>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs uppercase tracking-wider text-zinc-500 print:border-zinc-300 print:text-zinc-600">
                    <th className="px-5 py-3 font-medium">Bale no</th>
                    <th className="px-3 py-3 font-medium">Unique barcode</th>
                    <th className="px-3 py-3 font-medium">Product</th>
                    <th className="px-3 py-3 font-medium">Scanned out of</th>
                    <th className="px-5 py-3 font-medium">Not scanned into</th>
                  </tr>
                </thead>
                <tbody>
                  {[...checklist]
                    .sort((a, b) => (a.unit_number ?? 0) - (b.unit_number ?? 0))
                    .map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-surface-border last:border-b-0 print:border-zinc-200"
                      >
                        <td className="px-5 py-3 font-semibold tabular-nums text-zinc-100 print:text-black">
                          {row.unit_number ?? "—"}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-zinc-200 print:text-black">
                          {row.unit_barcode ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-zinc-300 print:text-black">
                          {row.product_code || row.product_name}
                        </td>
                        <td className="px-3 py-3 text-zinc-300 print:text-black">
                          <span className="block">{row.from_godown_name ?? "—"}</span>
                          {row.dispatched_at ? (
                            <span className="text-xs text-zinc-500">
                              {formatTime(row.dispatched_at)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-zinc-300 print:text-black">
                          {row.to_godown_name ?? "Destination godown"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-surface-border px-5 py-4 print:border-zinc-300">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 print:text-zinc-600">
                Unique barcodes ({barcodes.length})
              </p>
              {barcodes.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No barcodes on these bales.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {barcodes.map((code) => (
                    <li
                      key={code}
                      className="rounded-lg border border-surface-border bg-surface-overlay px-2.5 py-1 font-mono text-xs text-zinc-100 print:border-zinc-300 print:bg-white print:text-black"
                    >
                      {code}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section
        className={`rounded-2xl border p-5 print:bg-white ${
          flagged.length > 0
            ? "border-danger/40 bg-danger/10 print:border-red-400"
            : "border-success/30 bg-success/10 print:border-zinc-300"
        }`}
      >
        <div className="flex items-start gap-3">
          {flagged.length > 0 ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger print:text-red-700" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success print:text-green-700" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-medium text-zinc-100 print:text-black">
              {flagged.length > 0
                ? `${flagged.length} bale${flagged.length === 1 ? "" : "s"} scanned out and not stocked in`
                : "All dispatched bales are stocked in the destination"}
            </h2>
            <p className="mt-1 text-xs text-zinc-400 print:text-zinc-600">
              Checked against current stock: a bale stays flagged until it is
              stocked in the godown it was sent to.
            </p>
            {flagged.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {flagged.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-danger/30 bg-surface-raised px-3 py-3 print:border-red-300 print:bg-white"
                  >
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-50 print:text-black">
                      <Flag className="h-3.5 w-3.5 text-danger print:text-red-700" />
                      {baleLabel(row)}
                      {row.unit_barcode ? (
                        <span className="font-mono text-xs font-medium text-zinc-300 print:text-zinc-700">
                          {row.unit_barcode}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-zinc-300 print:text-black">
                      Scanned out of {row.from_godown_name ?? "the source godown"}{" "}
                      and not stocked in{" "}
                      {row.to_godown_name ?? "the destination godown"}.
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 print:text-zinc-600">
                      Current status: {statusText(row.unit_status)}
                      {row.current_godown_name
                        ? ` · ${row.current_godown_name}`
                        : row.unit_status === "IN_TRANSIT"
                          ? " · not in a godown"
                          : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
