#!/usr/bin/env node

/**
 * Push local Supabase SQL files to your cloud database.
 *
 * Usage:
 *   npm run db:push              # apply pending migrations only
 *   npm run db:push:schema       # apply supabase/schema.sql (fresh setup)
 *   npm run db:push:all          # schema.sql then migrations
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_DB_PASSWORD=...     (from Supabase → Settings → Database)
 *
 * Or set DATABASE_URL directly (takes precedence).
 *
 * Direct db.<ref>.supabase.co is often IPv6-only. If your network cannot
 * reach IPv6, set SUPABASE_DB_REGION (e.g. ap-south-1) or DATABASE_URL to the
 * Session pooler URI from Supabase → Settings → Database.
 */

import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { readFileSync } from "fs";
import { createInterface } from "readline";
import pg from "pg";
import {
  loadEnvFiles,
  buildDatabaseUrl,
  buildPoolerDatabaseUrl,
  listMigrationFiles,
  getSchemaFile,
  extractProjectRef,
} from "./lib/env.mjs";

dns.setDefaultResultOrder("ipv4first");

const { Client } = pg;

const args = process.argv.slice(2);
const mode = args.includes("--schema")
  ? "schema"
  : args.includes("--all")
    ? "all"
    : "migrations";

const env = loadEnvFiles();

const POOLER_REGION_CANDIDATES = [
  env.SUPABASE_DB_REGION,
  "ap-south-1",
  "ap-southeast-1",
  "ap-northeast-1",
  "eu-west-1",
  "eu-central-1",
  "us-east-1",
  "us-west-1",
].filter(Boolean);

async function promptPassword() {
  const ref = extractProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("\n⚠️  SUPABASE_DB_PASSWORD not found in .env.local");
  console.log(
    `   Get it from: https://supabase.com/dashboard/project/${ref || "<your-project>"}/settings/database`
  );
  console.log("   Add to .env.local: SUPABASE_DB_PASSWORD=your-password\n");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter database password (input visible): ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function resolveConnectionString() {
  let url = buildDatabaseUrl(env);

  if (!url) {
    const password = await promptPassword();
    if (!password) {
      throw new Error("Database password is required.");
    }
    env.SUPABASE_DB_PASSWORD = password;
    url = buildDatabaseUrl(env);
  }

  if (!url) {
    throw new Error(
      "Could not build connection string. Set DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD in .env.local"
    );
  }

  return url;
}

function createClient(connectionString, { ipv4Only = false } = {}) {
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    ...(ipv4Only
      ? {
          lookup: (hostname, options, callback) => {
            dns.lookup(hostname, { ...options, family: 4 }, callback);
          },
        }
      : {}),
  });
}

async function hostHasIpv4(hostname) {
  try {
    await dnsPromises.lookup(hostname, { family: 4 });
    return true;
  } catch {
    return false;
  }
}

async function tryConnect(connectionString, label, { ipv4Only = false } = {}) {
  const client = createClient(connectionString, { ipv4Only });
  try {
    await client.connect();
    console.log(`✓ Connected via ${label}`);
    return client;
  } catch (err) {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    const message = err instanceof Error ? err.message : String(err);
    console.log(`✗ ${label}: ${message}`);
    return null;
  }
}

async function connectWithFallback() {
  const primary = await resolveConnectionString();

  // If caller already set DATABASE_URL / pooler host, try that first (IPv4).
  if (env.DATABASE_URL || env.SUPABASE_DB_POOLER_HOST || env.SUPABASE_DB_REGION) {
    const client = await tryConnect(primary, "configured URL", { ipv4Only: true });
    if (client) return client;
  }

  const ref = extractProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  const directHost = env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`;
  const directHasV4 = await hostHasIpv4(directHost);

  if (directHasV4) {
    const client = await tryConnect(primary, `direct ${directHost}`, {
      ipv4Only: true,
    });
    if (client) return client;
  } else {
    console.log(
      `ℹ Direct host ${directHost} has no IPv4 address — trying Session pooler…`
    );
  }

  // Also try direct over default DNS (may work on IPv6-capable networks).
  if (!directHasV4) {
    const client = await tryConnect(primary, `direct ${directHost} (IPv6)`, {
      ipv4Only: false,
    });
    if (client) return client;
  }

  const tried = new Set();
  for (const region of POOLER_REGION_CANDIDATES) {
    if (tried.has(region)) continue;
    tried.add(region);
    const poolerUrl = buildPoolerDatabaseUrl(env, region);
    if (!poolerUrl) continue;
    const client = await tryConnect(
      poolerUrl,
      `pooler aws-0-${region}`,
      { ipv4Only: true }
    );
    if (client) {
      console.log(
        `ℹ Tip: add SUPABASE_DB_REGION=${region} to .env.local to skip probing.`
      );
      return client;
    }
  }

  throw new Error(
    `Could not reach the database (IPv6 direct host unreachable; pooler probes failed).\n\n` +
      `Fix: In Supabase → Project Settings → Database, copy the Session pooler URI and set:\n\n` +
      `  DATABASE_URL=postgresql://postgres.${ref}:YOUR_PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres\n\n` +
      `Or set SUPABASE_DB_REGION=<region> (e.g. ap-south-1) in .env.local.`
  );
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(
    "SELECT filename FROM _schema_migrations ORDER BY filename"
  );
  return new Set(rows.map((r) => r.filename));
}

async function applySqlFile(client, filePath, { track = true } = {}) {
  const filename = filePath.split("/").pop();
  const sql = readFileSync(filePath, "utf8");

  console.log(`\n▶ Applying: ${filename}`);

  try {
    await client.query("BEGIN");
    await client.query(sql);

    if (track) {
      await client.query(
        "INSERT INTO _schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
        [filename]
      );
    }

    await client.query("COMMIT");
    console.log(`✓ Success: ${filename}`);
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`✗ Failed: ${filename}`);
    console.error(`  ${err.message}`);
    return false;
  }
}

async function reloadSchemaCache(client) {
  try {
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("✓ PostgREST schema cache reload triggered");
  } catch {
    console.log("ℹ Skipped schema cache reload (non-fatal)");
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Store IMS — Supabase Schema Push");
  console.log("═══════════════════════════════════════════");
  console.log(`Mode: ${mode}`);

  const projectRef = extractProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  if (projectRef) {
    console.log(`Project: ${projectRef}`);
  }

  const client = await connectWithFallback();

  await ensureMigrationsTable(client);
  const applied = await getAppliedMigrations(client);

  const filesToRun = [];

  if (mode === "schema" || mode === "all") {
    filesToRun.push({ path: getSchemaFile(), track: false });
  }

  if (mode === "migrations" || mode === "all") {
    for (const file of listMigrationFiles()) {
      const name = file.split("/").pop();
      if (!applied.has(name)) {
        filesToRun.push({ path: file, track: true });
      } else {
        console.log(`⏭ Skipped (already applied): ${name}`);
      }
    }
  }

  if (filesToRun.length === 0) {
    console.log("\n✓ Database is up to date — nothing to apply.");
    await reloadSchemaCache(client);
    await client.end();
    return;
  }

  let failed = 0;
  for (const { path, track } of filesToRun) {
    const ok = await applySqlFile(client, path, { track });
    if (!ok) failed++;
  }

  await reloadSchemaCache(client);
  await client.end();

  console.log("\n═══════════════════════════════════════════");
  if (failed > 0) {
    console.log(`  Finished with ${failed} error(s)`);
    process.exit(1);
  }
  console.log("  All SQL applied successfully");
  console.log("═══════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err.message);
  process.exit(1);
});
