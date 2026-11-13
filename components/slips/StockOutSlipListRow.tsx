"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { StockOutSlipWithDetails } from "@/lib/types/database";

interface StockOutSlipListRowProps {
  slip: StockOutSlipWithDetails;
  active?: boolean;
  onSelect: () => void;
  formatWhen: (ts: string) => string;
  /** Daily reports amber styling vs default list */
  tone?: "default" | "amber";
}

export function StockOutSlipListRow({
  slip,
  active,
  onSelect,
  formatWhen,
  tone = "default",
}: StockOutSlipListRowProps) {
  const [contentsOpen, setContentsOpen] = useState(false);

  const billNo = slip.bill_no?.trim() || "No bill no";
  const biller = slip.biller_name?.trim() || "No name";
  const totalBags = Math.round(slip.total_bags);
  const lines = slip.stock_out_slip_lines;

  const rowClass =
    tone === "amber"
      ? `px-4 py-3 transition sm:px-5 ${
          active
            ? "bg-amber-500/10"
            : "hover:bg-amber-500/10"
        }`
      : `px-4 py-3 transition hover:bg-white/[0.03] ${
          active ? "bg-accent/10" : ""
        }`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`w-full cursor-pointer text-left ${rowClass}`}
    >
      <p className="truncate text-sm font-semibold text-zinc-100 print:text-black">
        {billNo}
      </p>
      <p className="mt-0.5 text-xs font-normal text-zinc-500 print:text-zinc-600">
        {biller}
        <span className="text-zinc-600"> · </span>
        <span className="tabular-nums text-zinc-400">
          {totalBags.toLocaleString("en-IN")} bags
        </span>
      </p>

      {lines.length > 0 ? (
        <div
          className="mt-2 print:hidden"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setContentsOpen((open) => !open)}
            className="flex items-center gap-1 text-xs font-normal text-zinc-500 transition hover:text-zinc-300"
          >
            {contentsOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            Contents
            <span className="text-zinc-600">({lines.length})</span>
          </button>
          {contentsOpen ? (
            <ul className="mt-1.5 space-y-1 border-l border-surface-border pl-3 print:hidden">
              {lines.map((line) => {
                const code =
                  line.products?.product_code?.trim() ||
                  line.products?.name ||
                  "SKU";
                return (
                  <li
                    key={line.id}
                    className="flex items-center justify-between gap-3 text-xs font-normal text-zinc-400"
                  >
                    <span className="truncate font-mono text-zinc-300">
                      {code}
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-500">
                      {Math.round(line.bag_count).toLocaleString("en-IN")} bags
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <ul className="mt-1 hidden space-y-0.5 print:block">
            {lines.map((line) => {
              const code =
                line.products?.product_code?.trim() ||
                line.products?.name ||
                "SKU";
              return (
                <li
                  key={`print-${line.id}`}
                  className="flex justify-between gap-2 text-xs text-zinc-600"
                >
                  <span className="font-mono">{code}</span>
                  <span className="tabular-nums">
                    {Math.round(line.bag_count).toLocaleString("en-IN")} bags
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p className="mt-1.5 text-xs font-normal text-zinc-600 print:text-zinc-600">
        {slip.sale_channel} · {formatWhen(slip.confirmed_at)}
      </p>
    </div>
  );
}
