import { isOpenBale, formatBagCount } from "@/lib/utils/inventory";

interface OpenBaleBadgeProps {
  remainingBags: number;
  /** Compact: "Open · 437" vs "Open · 437 bags" */
  compact?: boolean;
  className?: string;
}

/** Amber tag for partially sold stocked-in bales. Returns null if sealed or empty. */
export function OpenBaleBadge({
  remainingBags,
  compact = false,
  className = "",
}: OpenBaleBadgeProps) {
  if (!isOpenBale(remainingBags)) return null;

  return (
    <span
      className={`inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-400 ${className}`}
    >
      Open · {formatBagCount(remainingBags)}
      {compact ? "" : " bags"}
    </span>
  );
}

interface OpenBaleCountBadgeProps {
  count: number;
  className?: string;
}

/** Product/batch-level count of open bales (e.g. "2 open"). */
export function OpenBaleCountBadge({
  count,
  className = "",
}: OpenBaleCountBadgeProps) {
  if (count < 1) return null;

  return (
    <span
      className={`inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-400 ${className}`}
    >
      {count} open
    </span>
  );
}
