/** Synthetic email domain for username-based Supabase Auth (users never type this). */
export const PORTAL_EMAIL_DOMAIN = "store-ims.local";

export function syntheticEmail(username: string): string {
  const local = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (!local) {
    throw new Error("Username is required.");
  }
  return `${local}@${PORTAL_EMAIL_DOMAIN}`;
}

export function usernameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return null;
  return email.slice(0, at).toLowerCase();
}
