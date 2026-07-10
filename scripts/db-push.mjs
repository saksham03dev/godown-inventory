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
 */

import { readFileSync } from "fs";
import { createInterface } from "readline";
import pg from "pg";
import {
  loadEnvFiles,
  buildDatabaseUrl,
  listMigrationFiles,
  getSchemaFile,
  extractProjectRef,
} from "./lib/env.mjs";

const { Client } = pg;

const args = process.argv.slice(2);
const mode = args.includes("--schema")
  ? "schema"
  : args.includes("--all")
    ? "all"
    : "migrations";

const env = loadEnvFiles();

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

  const connectionString = await resolveConnectionString();
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("✓ Connected to database");

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
