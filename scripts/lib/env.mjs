import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

/**
 * Parse .env.local (and optional .env) into a key-value map.
 * Does not overwrite already-set process.env values.
 */
export function loadEnvFiles() {
  const vars = {};

  for (const file of [".env", ".env.local"]) {
    const filePath = resolve(ROOT, file);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      vars[key] = value;
    }
  }

  return vars;
}

export function extractProjectRef(supabaseUrl) {
  if (!supabaseUrl) return null;
  try {
    const host = new URL(supabaseUrl).hostname;
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

export function buildDatabaseUrl(env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const ref =
    env.SUPABASE_PROJECT_REF ||
    extractProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);

  const password = env.SUPABASE_DB_PASSWORD;

  if (!ref || !password) return null;

  // Pooler (IPv4) — required when direct db.*.supabase.co is IPv6-only.
  // Set SUPABASE_DB_REGION (e.g. ap-south-1) or SUPABASE_DB_POOLER_HOST.
  const poolerHost =
    env.SUPABASE_DB_POOLER_HOST ||
    (env.SUPABASE_DB_REGION
      ? `aws-0-${env.SUPABASE_DB_REGION}.pooler.supabase.com`
      : null);

  const usePooler =
    Boolean(poolerHost) ||
    env.SUPABASE_USE_POOLER === "true" ||
    env.SUPABASE_USE_POOLER === "1";

  const host =
    env.SUPABASE_DB_HOST ||
    (usePooler && poolerHost
      ? poolerHost
      : `db.${ref}.supabase.co`);

  const port =
    env.SUPABASE_DB_PORT ||
    (usePooler || poolerHost ? "5432" : "5432");
  const database = env.SUPABASE_DB_NAME || "postgres";
  const user =
    env.SUPABASE_DB_USER ||
    (usePooler || (env.SUPABASE_DB_HOST || "").includes("pooler.supabase.com")
      ? `postgres.${ref}`
      : poolerHost && !env.SUPABASE_DB_HOST
        ? `postgres.${ref}`
        : "postgres");

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

/** Build a Session-mode pooler URL for a known AWS region (IPv4-friendly). */
export function buildPoolerDatabaseUrl(env, region) {
  const ref =
    env.SUPABASE_PROJECT_REF ||
    extractProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  const password = env.SUPABASE_DB_PASSWORD;
  if (!ref || !password || !region) return null;

  const host = `aws-0-${region}.pooler.supabase.com`;
  const user = `postgres.${ref}`;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/postgres`;
}

export function listMigrationFiles() {
  const migrationsDir = resolve(ROOT, "supabase/migrations");
  if (!existsSync(migrationsDir)) return [];

  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => resolve(migrationsDir, f));
}

export function getSchemaFile() {
  return resolve(ROOT, "supabase/schema.sql");
}

export { ROOT };
