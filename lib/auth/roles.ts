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
    "Stock in/out, print labels, view bills — no product, godown, or price changes",
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
    "billing.view",
    "billing.create",
  ],
  employee: ["dashboard", "labels", "scan", "billing.view"],
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
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", permission: "dashboard" },
  { href: "/products", label: "Products", permission: "products.view" },
  { href: "/labels", label: "Labels", permission: "labels" },
  { href: "/godowns", label: "Godowns", permission: "godowns.view" },
  { href: "/scan", label: "Scan Station", permission: "scan" },
  { href: "/billing", label: "Billing", permission: "billing.view" },
  { href: "/admin/users", label: "Users", permission: "users.manage" },
];

export function getNavItemsForRole(role: UserRole | null | undefined) {
  return ALL_NAV_ITEMS.filter((item) => hasPermission(role, item.permission));
}

const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/": "dashboard",
  "/products": "products.view",
  "/labels": "labels",
  "/godowns": "godowns.view",
  "/scan": "scan",
  "/billing": "billing.view",
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
