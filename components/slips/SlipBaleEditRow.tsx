"use client";

import { Trash2 } from "lucide-react";

interface SlipBaleEditRowProps {
  unitNumber: number;
  slipUnitId: string;
  bagsValue: string;
  onBagsChange: (slipUnitId: string, value: string) => void;
  onRemove: (slipUnitId: string, unitNumber: number) => void;
  disabled?: boolean;
}

export function SlipBaleEditRow({
  unitNumber,
  slipUnitId,
  bagsValue,
  onBagsChange,
  onRemove,
  disabled,
}: SlipBaleEditRowProps) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-xs text-zinc-500">Bale #{unitNumber}</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={1000}
            inputMode="numeric"
            className="w-24 rounded-lg border border-surface-border bg-surface-overlay px-2 py-1.5 text-right text-sm tabular-nums text-zinc-100 outline-none focus:border-accent disabled:opacity-60"
            value={bagsValue}
            onChange={(e) => onBagsChange(slipUnitId, e.target.value)}
            disabled={disabled}
          />
          <span className="text-xs text-zinc-500">bags</span>
        </label>
        <button
          type="button"
          title={`Remove bale #${unitNumber} from slip`}
          aria-label={`Remove bale ${unitNumber} from slip`}
          onClick={() => onRemove(slipUnitId, unitNumber)}
          disabled={disabled}
          className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
