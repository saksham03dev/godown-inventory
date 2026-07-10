"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PasswordModal } from "@/components/admin/PasswordModal";
import { UserFormModal } from "@/components/admin/UserFormModal";
import { UserTable } from "@/components/admin/UserTable";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/lib/auth/roles";
import type { PortalUser } from "@/lib/types/database";

export default function AdminUsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PortalUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<PortalUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalUser | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load users");
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async (input: {
    username: string;
    full_name: string;
    role: UserRole;
    password?: string;
  }) => {
    setMutating(true);
    setAlert(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create user");
      setAlert({ type: "success", message: "User created." });
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setAlert({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to create user",
      });
    } finally {
      setMutating(false);
    }
  };

  const handleUpdate = async (input: {
    username: string;
    full_name: string;
    role: UserRole;
    is_active?: boolean;
  }) => {
    if (!editingUser) return;
    setMutating(true);
    setAlert(null);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update user");
      setAlert({ type: "success", message: "User updated." });
      setFormOpen(false);
      setEditingUser(null);
      await refresh();
    } catch (err) {
      setAlert({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update user",
      });
    } finally {
      setMutating(false);
    }
  };

  const handlePasswordChange = async (password: string) => {
    if (!passwordUser) return;
    setMutating(true);
    setAlert(null);
    try {
      const res = await fetch(`/api/admin/users/${passwordUser.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to change password");
      setAlert({ type: "success", message: "Password updated." });
      setPasswordUser(null);
    } catch (err) {
      setAlert({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to change password",
      });
    } finally {
      setMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setMutating(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete user");
      setAlert({ type: "success", message: "User deleted." });
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setAlert({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete user",
      });
    } finally {
      setMutating(false);
    }
  };

  return (
    <DashboardLayout
      title="User Management"
      subtitle="Create accounts, assign roles, and reset passwords"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-400 hover:bg-white/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => {
              setEditingUser(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-muted"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add User</span>
          </button>
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-4 animate-fade-in">
        {alert && (
          <AlertBanner
            alert={alert}
            onDismiss={() => setAlert(null)}
          />
        )}

        {loading ? (
          <LoadingSpinner label="Loading users…" />
        ) : error ? (
          <AlertBanner alert={{ type: "error", message: error }} />
        ) : (
          <UserTable
            users={users}
            currentUserId={profile?.id}
            onEdit={(user) => {
              setEditingUser(user);
              setFormOpen(true);
            }}
            onDelete={setDeleteTarget}
            onChangePassword={setPasswordUser}
          />
        )}
      </div>

      <UserFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingUser(null);
        }}
        onSubmit={editingUser ? handleUpdate : handleCreate}
        user={editingUser}
        loading={mutating}
      />

      <PasswordModal
        open={Boolean(passwordUser)}
        onClose={() => setPasswordUser(null)}
        onSubmit={handlePasswordChange}
        username={passwordUser?.username}
        loading={mutating}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Delete "${deleteTarget?.full_name}" (@${deleteTarget?.username})? They will no longer be able to sign in.`}
        loading={mutating}
      />
    </DashboardLayout>
  );
}
