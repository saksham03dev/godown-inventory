import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getDatabaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!supabaseUrl || !password) return null;

  try {
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    const host = process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`;
    const port = process.env.SUPABASE_DB_PORT || "5432";
    const database = process.env.SUPABASE_DB_NAME || "postgres";
    const user = process.env.SUPABASE_DB_USER || "postgres";
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  } catch {
    return null;
  }
}

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) {
      throw new Error(
        "Database not configured. Set SUPABASE_DB_PASSWORD or DATABASE_URL in .env.local"
      );
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}
