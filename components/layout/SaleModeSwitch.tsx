"use client";

import { Store, ShoppingBag } from "lucide-react";
import { useSaleMode } from "@/contexts/SaleModeContext";

export function SaleModeSwitch() {
  const { mode, setMode, canSwitchMode } = useSaleMode();

  if (!canSwitchMode) return null;

  return (
    <div
      className="flex shrink-0 items-center rounded-xl border border-surface-border bg-surface-overlay p-1"
      role="tablist"
      aria-label="Sale mode"
    >
      <ModeButton
        active={mode === "wholesale"}
        label="Wholesale"
        icon={Store}
        onClick={() => setMode("wholesale")}
      />
      <ModeButton
        active={mode === "retail"}
        label="Retail"
        icon={ShoppingBag}
        onClick={() => setMode("retail")}
      />
    </div>
  );
}

function ModeButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof Store;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm ${
        active
          ? "bg-accent/20 text-accent shadow-sm"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
