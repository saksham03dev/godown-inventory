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
  employee: "Stock in/out scanning and view stock-out slips",
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
  | "inventory.transfer"
  | "inventory.return"
  | "inventory.relocate"
  | "billing.view"
  | "billing.create"
  | "billing.editPrice"
  | "slips.view"
  | "slips.edit"
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
    "inventory.transfer",
    "inventory.return",
    "inventory.relocate",
    "billing.view",
    "billing.create",
    "billing.editPrice",
    "slips.view",
    "slips.edit",
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
    "inventory.transfer",
    "inventory.return",
    "inventory.relocate",
    "billing.view",
    "billing.create",
    "slips.view",
    "slips.edit",
  ],
  employee: ["scan", "slips.view"],
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
  /** If set, item only appears in this sale mode (billing-enabled builds). */
  saleMode?: "wholesale" | "retail";
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", permission: "dashboard" },
  { href: "/daily-reports", label: "Daily Reports", permission: "dashboard" },
  { href: "/products", label: "Products", permission: "products.view" },
  {
    href: "/labels",
    label: "Labels",
    permission: "labels",
    saleMode: "wholesale",
  },
  {
    href: "/godowns",
    label: "Warehouses",
    permission: "godowns.manage",
    saleMode: "wholesale",
  },
  { href: "/inventory", label: "Inventory", permission: "godowns.view" },
  {
    href: "/view-label",
    label: "View Label",
    permission: "scan.viewLabel",
  },
  {
    href: "/scan",
    label: "Scan Station",
    permission: "scan",
    saleMode: "wholesale",
  },
  {
    href: "/stock-in",
    label: "Stock In",
    permission: "scan",
  },
  {
    href: "/stock-out",
    label: "Stock Out",
    permission: "scan",
  },
  {
    href: "/stock-out-slips",
    label: "Stock Out Slips",
    permission: "slips.view",
  },
  {
    href: "/stock-return",
    label: "Return",
    permission: "inventory.return",
  },
  {
    href: "/stock-transfer",
    label: "Transfer",
    permission: "inventory.transfer",
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

const BILLING_NAV_HREFS = ["/billing", "/pending-billing"] as const;

function isBillingNavEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";
}

export function getNavItemsForRole(
  role: UserRole | null | undefined,
  saleMode: "wholesale" | "retail" = "wholesale"
) {
  const billingEnabled = isBillingNavEnabled();

  let items = ALL_NAV_ITEMS.filter((item) => {
    if (!billingEnabled && item.href === "/open-bales") {
      return hasPermission(role, "scan") || hasPermission(role, "godowns.view");
    }

    if (!hasPermission(role, item.permission)) return false;

    if (!billingEnabled) {
      if ((BILLING_NAV_HREFS as readonly string[]).includes(item.href)) {
        return false;
      }
      if (item.href === "/scan") return false;
      if (item.saleMode) {
        return true;
      }
      if (item.href === "/open-bales") {
        return true;
      }
      return true;
    }

    if (item.href === "/stock-in" || item.href === "/stock-out") {
      return hasPermission(role, "scan");
    }

    if (item.saleMode && item.saleMode !== saleMode) return false;
    return true;
  });

  if (!billingEnabled) {
    items = items.map((item) => {
      if (item.href === "/open-bales") {
        return { ...item, permission: "godowns.view" as Permission };
      }
      return item;
    });
  }

  if (role === "employee") {
    return items.filter((item) =>
      ["/stock-in", "/stock-out", "/stock-out-slips"].includes(item.href)
    );
  }

  return items;
}

export function getDefaultRouteForRole(
  role: UserRole | null | undefined
): string {
  if (role === "employee") {
    return "/stock-out";
  }
  return "/";
}

const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/": "dashboard",
  "/daily-reports": "dashboard",
  "/products": "products.view",
  "/labels": "labels",
  "/godowns": "godowns.manage",
  "/inventory": "godowns.view",
  "/view-label": "scan.viewLabel",
  "/scan": "scan",
  "/stock-in": "scan",
  "/stock-out": "scan",
  "/stock-out-slips": "slips.view",
  "/stock-return": "inventory.return",
  "/stock-transfer": "inventory.transfer",
  "/pending-billing": "billing.view",
  "/billing": "billing.view",
  "/open-bales": "billing.view",
  "/admin/users": "users.manage",
};

export function canAccessRoute(
  pathname: string,
  role: UserRole | null | undefined
): boolean {
  const billingEnabled = isBillingNavEnabled();

  if (!billingEnabled && (BILLING_NAV_HREFS as readonly string[]).includes(pathname)) {
    return false;
  }

  if (!billingEnabled && pathname === "/scan") {
    return false;
  }

  if (!billingEnabled && pathname === "/open-bales") {
    return hasPermission(role, "scan") || hasPermission(role, "godowns.view");
  }

  const permission = ROUTE_PERMISSIONS[pathname];
  if (!permission) return true;
  return hasPermission(role, permission);
}
