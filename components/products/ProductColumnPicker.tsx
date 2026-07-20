"use client";

import { Columns3, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProductTableColumnId } from "@/lib/constants/productTableColumns";

interface ProductColumnPickerProps {
  visibleColumns: ProductTableColumnId[];
  columnLabels: { id: ProductTableColumnId; label: string }[];
  onToggle: (id: ProductTableColumnId) => void;
  onReset: () => void;
}

export function ProductColumnPicker({
  visibleColumns,
  columnLabels,
  onToggle,
  onReset,
}: ProductColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hiddenCount = columnLabels.length - visibleColumns.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Columns3 className="h-4 w-4" />
        <span className="hidden sm:inline">Columns</span>
        {hiddenCount > 0 && (
          <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
            {visibleColumns.length}/{columnLabels.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-surface-border bg-surface-overlay p-2 shadow-xl animate-fade-in">
          <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Visible columns
          </p>
          <ul className="max-h-64 overflow-auto py-1" role="listbox">
            {columnLabels.map(({ id, label }) => {
              const checked = visibleColumns.includes(id);
              const onlyVisible = checked && visibleColumns.length === 1;
              return (
                <li key={id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-white/5 ${
                      onlyVisible ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={onlyVisible}
                      onChange={() => onToggle(id)}
                      className="h-4 w-4 rounded border-surface-border bg-surface text-accent focus:ring-accent/50"
                    />
                    <span className="text-zinc-200">{label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-surface-border pt-2">
            <button
              type="button"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
