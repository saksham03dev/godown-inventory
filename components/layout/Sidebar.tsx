"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  FileText,
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Package,
  PackageOpen,
  PackageSearch,
  RotateCcw,
  ScanLine,
  Tags,
  UserCog,
  Warehouse,
  Boxes,
  CalendarDays,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSaleMode } from "@/contexts/SaleModeContext";
import { BILLING_ENABLED } from "@/lib/constants/features";
import { getNavItemsForRole, ROLE_LABELS } from "@/lib/auth/roles";

const NAV_ICONS = {
  "/": LayoutDashboard,
  "/daily-reports": CalendarDays,
  "/products": PackageSearch,
  "/labels": Tags,
  "/godowns": Warehouse,
  "/inventory": Boxes,
  "/scan": ScanLine,
  "/stock-in": ScanLine,
  "/stock-out": ScanLine,
  "/stock-out-slips": ClipboardList,
  "/stock-return": RotateCcw,
  "/stock-transfer": ArrowLeftRight,
  "/pending-billing": ClipboardList,
  "/open-bales": PackageOpen,
  "/billing": FileText,
  "/admin/users": UserCog,
} as const;

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, role, signOut } = useAuth();
  const { mode } = useSaleMode();
  const navItems = getNavItemsForRole(role, mode);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-surface-border bg-surface-raised transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
              <Package className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">Store IMS</p>
              <p className="text-xs text-zinc-500">
                {BILLING_ENABLED
                  ? mode === "retail"
                    ? "Retail sales"
                    : "Wholesale ops"
                  : "Inventory"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ href, label }) => {
            const Icon = NAV_ICONS[href as keyof typeof NAV_ICONS] ?? LayoutDashboard;
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-surface-border p-4">
          {profile && (
            <div className="mb-3">
              <p className="truncate text-sm font-medium text-zinc-200">
                {profile.full_name || profile.username}
              </p>
              <p className="text-xs text-zinc-500">
                {role ? ROLE_LABELS[role] : "User"}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
