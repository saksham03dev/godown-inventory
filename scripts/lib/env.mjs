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

  const host = env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`;
  const port = env.SUPABASE_DB_PORT || "5432";
  const database = env.SUPABASE_DB_NAME || "postgres";
  const user = env.SUPABASE_DB_USER || "postgres";

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
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
