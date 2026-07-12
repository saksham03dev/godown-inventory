export type UserRole = "admin" | "manager" | "employee";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Full access — products, godowns, pricing, billing, and all operations",
  manager:
    "Add & edit products (no price changes), stock in/out, labels, billing — no godown management",
  employee:
    "Stock in and stock out via scan station only",
};

type Permission =
  | "dashboard"
  | "products.view"
  | "products.create"
  | "products.edit"
  | "products.delete"
  | "products.editPrice"
  | "godowns.view"
  | "godowns.manage"
  | "labels"
  | "scan"
  | "scan.viewLabel"
  | "billing.view"
  | "billing.create"
  | "billing.editPrice"
  | "users.manage";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "dashboard",
    "products.view",
    "products.create",
    "products.edit",
    "products.delete",
    "products.editPrice",
    "godowns.view",
    "godowns.manage",
    "labels",
    "scan",
    "scan.viewLabel",
    "billing.view",
    "billing.create",
    "billing.editPrice",
    "users.manage",
  ],
  manager: [
    "dashboard",
    "products.view",
    "products.create",
    "products.edit",
    "godowns.view",
    "labels",
    "scan",
    "scan.viewLabel",
    "billing.view",
    "billing.create",
  ],
  employee: ["scan"],
};

export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export interface NavItem {
  href: string;
  label: string;
  permission: Permission;
  /** If set, item only appears in this sale mode. */
  saleMode?: "wholesale" | "retail";
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", permission: "dashboard" },
  { href: "/products", label: "Products", permission: "products.view" },
  {
    href: "/labels",
    label: "Labels",
    permission: "labels",
    saleMode: "wholesale",
  },
  {
    href: "/godowns",
    label: "Godowns",
    permission: "godowns.manage",
    saleMode: "wholesale",
  },
  { href: "/inventory", label: "View Inventory", permission: "godowns.view" },
  {
    href: "/scan",
    label: "Scan Station",
    permission: "scan",
    saleMode: "wholesale",
  },
  {
    href: "/pending-billing",
    label: "Pending Sales",
    permission: "billing.view",
    saleMode: "wholesale",
  },
  { href: "/billing", label: "Billing", permission: "billing.view" },
  {
    href: "/open-bales",
    label: "Open Bales",
    permission: "billing.view",
    saleMode: "retail",
  },
  { href: "/admin/users", label: "Users", permission: "users.manage" },
];

export function getNavItemsForRole(
  role: UserRole | null | undefined,
  saleMode: "wholesale" | "retail" = "wholesale"
) {
  const items = ALL_NAV_ITEMS.filter((item) => {
    if (!hasPermission(role, item.permission)) return false;
    if (item.saleMode && item.saleMode !== saleMode) return false;
    return true;
  });
  if (role === "employee") {
    return items.filter((item) => item.href === "/scan");
  }
  return items;
}

export function getDefaultRouteForRole(
  role: UserRole | null | undefined
): string {
  if (role === "employee") return "/scan";
  return "/";
}

const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/": "dashboard",
  "/products": "products.view",
  "/labels": "labels",
  "/godowns": "godowns.manage",
  "/inventory": "godowns.view",
  "/scan": "scan",
  "/pending-billing": "billing.view",
  "/billing": "billing.view",
  "/open-bales": "billing.view",
  "/admin/users": "users.manage",
};

export function canAccessRoute(
  pathname: string,
  role: UserRole | null | undefined
): boolean {
  const permission = ROUTE_PERMISSIONS[pathname];
  if (!permission) return true;
  return hasPermission(role, permission);
}
