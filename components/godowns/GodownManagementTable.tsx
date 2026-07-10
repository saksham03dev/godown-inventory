import { MapPin, Pencil, Trash2 } from "lucide-react";
import type { Godown } from "@/lib/types/database";

interface GodownManagementTableProps {
  godowns: Godown[];
  onEdit: (godown: Godown) => void;
  onDelete: (godown: Godown) => void;
}

export function GodownManagementTable({
  godowns,
  onEdit,
  onDelete,
}: GodownManagementTableProps) {
  if (godowns.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-12 text-center">
        <p className="text-sm font-medium text-zinc-400">No godowns yet</p>
        <p className="mt-1 text-xs text-zinc-600">
          Add warehouse locations to start tracking inventory by site.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-overlay/50">
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Location
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Capacity
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Address
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Notes
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {godowns.map((godown) => (
              <tr
                key={godown.id}
                className="transition hover:bg-white/[0.02]"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                      <MapPin className="h-4 w-4 text-accent" />
                    </div>
                    <span className="font-medium text-zinc-200">
                      {godown.location_name}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4 text-right font-semibold text-zinc-200">
                  {godown.capacity.toLocaleString()}
                </td>
                <td className="max-w-[180px] truncate px-5 py-4 text-zinc-400">
                  {godown.address || "—"}
                </td>
                <td className="max-w-[200px] truncate px-5 py-4 text-zinc-500">
                  {godown.notes || "—"}
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onEdit(godown)}
                      className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-accent"
                      aria-label={`Edit ${godown.location_name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(godown)}
                      className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-danger"
                      aria-label={`Delete ${godown.location_name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
