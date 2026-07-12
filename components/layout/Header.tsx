"use client";

import { Menu } from "lucide-react";
import { SaleModeSwitch } from "./SaleModeSwitch";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, onMenuClick, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-surface/80 px-4 py-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-zinc-100 sm:text-xl">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-zinc-500 sm:text-sm">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <SaleModeSwitch />
        {actions}
      </div>
    </header>
  );
}
