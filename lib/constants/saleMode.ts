export type SaleMode = "wholesale" | "retail";

export const SALE_MODE_STORAGE_KEY = "store-ims-sale-mode";

/** Routes only visible in wholesale mode. */
export const WHOLESALE_ONLY_ROUTES = [
  "/labels",
  "/godowns",
  "/scan",
  "/pending-billing",
] as const;

/** Routes only visible in retail mode. */
export const RETAIL_ONLY_ROUTES = ["/open-bales"] as const;

export const DEFAULT_SALE_MODE: SaleMode = "wholesale";

export function isRouteAllowedInSaleMode(
  pathname: string,
  mode: SaleMode
): boolean {
  if ((WHOLESALE_ONLY_ROUTES as readonly string[]).includes(pathname)) {
    return mode === "wholesale";
  }
  if ((RETAIL_ONLY_ROUTES as readonly string[]).includes(pathname)) {
    return mode === "retail";
  }
  return true;
}

/** Where to send the user if the current page is wrong for the active mode. */
export function getSaleModeRedirect(
  pathname: string,
  mode: SaleMode
): string | null {
  if (isRouteAllowedInSaleMode(pathname, mode)) return null;
  return mode === "retail" ? "/billing" : "/";
}

export function getDefaultRouteForSaleMode(mode: SaleMode): string {
  return mode === "retail" ? "/billing" : "/";
}
