/**
 * Apply poster bot SQL migrations to TALLER Supabase via direct Postgres.
 * Reads taller_poster_bot/.env.local — does not print secrets.
 *
 * Usage: npm run apply:db
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { buildDatabaseUrl } from "./db-url";

async function main() {
  const migrationsDir = resolve(process.cwd(), "supabase/migrations");
  if (!existsSync(migrationsDir)) {
    throw new Error(`Migrations dir not found: ${migrationsDir}`);
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new pg.Client({ connectionString: buildDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      console.log(`Applying ${file}...`);
      await client.query(sql);
      console.log(`  OK`);
    }

    const secretResult = await client.query(
      "SELECT value FROM poster_internal_config WHERE key = 'api_secret' LIMIT 1",
    );
    if (secretResult.rows[0]?.value) {
      console.log("\n✅ Migrations applied.");
      console.log("Add to taller_poster_bot/.env.local (and Vercel):");
      console.log("  TALLER_POSTER_DB_SECRET=<value from poster_internal_config.api_secret>");
      console.log("\nQuery api_secret in Supabase SQL Editor if needed.");
    } else {
      console.log("\n✅ Migrations applied (api_secret row not found — check poster_internal_config).");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
