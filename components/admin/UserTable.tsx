import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { PortalUser } from "@/lib/types/database";

interface UserTableProps {
  users: PortalUser[];
  currentUserId?: string;
  onEdit: (user: PortalUser) => void;
  onDelete: (user: PortalUser) => void;
  onChangePassword: (user: PortalUser) => void;
}

export function UserTable({
  users,
  currentUserId,
  onEdit,
  onDelete,
  onChangePassword,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-12 text-center">
        <p className="text-sm text-zinc-400">No users yet</p>
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
                Name
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Username
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Role
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Status
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-4 font-medium text-zinc-200">
                  {user.full_name}
                  {user.id === currentUserId && (
                    <span className="ml-2 text-xs text-zinc-600">(you)</span>
                  )}
                </td>
                <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                  {user.username}
                </td>
                <td className="px-5 py-4 text-zinc-400">
                  {ROLE_LABELS[user.role]}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.is_active
                        ? "bg-success/15 text-success"
                        : "bg-zinc-700/50 text-zinc-500"
                    }`}
                  >
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onChangePassword(user)}
                      className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-accent"
                      aria-label={`Change password for ${user.username}`}
                      title="Change password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEdit(user)}
                      className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-accent"
                      aria-label={`Edit ${user.username}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(user)}
                      disabled={user.id === currentUserId}
                      className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-danger disabled:opacity-30"
                      aria-label={`Delete ${user.username}`}
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
