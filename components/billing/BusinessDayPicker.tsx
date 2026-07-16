"use client";

import { useBusinessDay } from "@/contexts/BusinessDayContext";
import { formatBusinessDateLabel } from "@/lib/utils/businessDay";

/** Pick today or a previously closed business day. */
export function BusinessDayPicker() {
  const { today, selectedDate, setSelectedDate, closings } = useBusinessDay();

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        Day
      </label>
      <select
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="w-full rounded-xl border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent sm:w-64"
      >
        <option value={today}>Today — {formatBusinessDateLabel(today)}</option>
        {closings.map((c) => (
          <option key={c.id} value={c.business_date}>
            {formatBusinessDateLabel(c.business_date)}
            {` · ${c.bill_count} · ₹${Number(c.total_amount).toFixed(0)}`}
          </option>
        ))}
      </select>
    </div>
  );
}
