import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  accent?: "blue" | "green" | "amber" | "purple";
}

const accentStyles = {
  blue: "bg-accent/10 text-accent",
  green: "bg-success/10 text-success",
  amber: "bg-amber-500/10 text-amber-400",
  purple: "bg-purple-500/10 text-purple-400",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = "blue",
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 transition hover:border-zinc-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-100">{value}</p>
          {trend && (
            <p className="mt-1 text-xs text-zinc-500">{trend}</p>
          )}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentStyles[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
