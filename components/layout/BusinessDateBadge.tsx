"use client";

import { CalendarDays } from "lucide-react";
import { useBusinessDay } from "@/contexts/BusinessDayContext";
import { formatBusinessDateLabel } from "@/lib/utils/businessDay";

/** Current store business date — top corner of the portal. */
export function BusinessDateBadge() {
  const { today, loading } = useBusinessDay();

  return (
    <div
      className="flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface-raised px-2.5 py-1.5 text-xs text-zinc-300"
      title="Store business day (Asia/Kolkata)"
    >
      <CalendarDays className="h-3.5 w-3.5 text-accent" />
      <span className="font-medium text-zinc-200">
        {loading ? "…" : formatBusinessDateLabel(today)}
      </span>
    </div>
  );
}
