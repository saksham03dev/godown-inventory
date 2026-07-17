/** When false, billing UI/APIs are hidden; stock-only mode is active. */
export const BILLING_ENABLED =
  process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

const BILLING_PAGE_PREFIXES = ["/billing", "/pending-billing"] as const;

export function isBillingPagePath(pathname: string): boolean {
  return BILLING_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isBillingApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/billing") || pathname.startsWith("/api/bills")
  );
}
