"use client";

import { AlertCircle, Bell, CheckCircle2, Info, X } from "lucide-react";
import type { AlertState } from "@/lib/types/database";

interface AlertBannerProps {
  alert: AlertState;
  onDismiss?: () => void;
}

const styles = {
  success: {
    bg: "bg-success/10 border-success/30",
    icon: CheckCircle2,
    iconColor: "text-success",
  },
  error: {
    bg: "bg-danger/10 border-danger/30",
    icon: AlertCircle,
    iconColor: "text-danger",
  },
  info: {
    bg: "bg-accent/10 border-accent/30",
    icon: Info,
    iconColor: "text-accent",
  },
  warning: {
    bg: "bg-amber-500/10 border-amber-500/40",
    icon: Bell,
    iconColor: "text-amber-300",
  },
};

export function AlertBanner({ alert, onDismiss }: AlertBannerProps) {
  const config = styles[alert.type];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 animate-slide-up ${config.bg}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconColor}`} />
      <p className="flex-1 text-sm text-zinc-200">{alert.message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
