/**
 * Fetch poster DB secret and write to taller_poster_bot/.env.local (does not print secret values).
 */
import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";
import { buildDatabaseUrl } from "./db-url";
import { POSTER_ENV_FILE, loadPosterEnv } from "./load-env";

loadPosterEnv();

function upsertEnvLine(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    return content.replace(re, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

async function main() {
  const client = new pg.Client({
    connectionString: buildDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const secretResult = await client.query(
    "SELECT value FROM poster_internal_config WHERE key = 'api_secret' LIMIT 1",
  );
  await client.end();

  const apiSecret = secretResult.rows[0]?.value as string | undefined;
  if (!apiSecret) {
    throw new Error("api_secret not found in poster_internal_config");
  }

  let content = readFileSync(POSTER_ENV_FILE, "utf8");
  content = upsertEnvLine(content, "TALLER_POSTER_DB_SECRET", apiSecret);
  content = upsertEnvLine(
    content,
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.TALLER_POSTER_BOT_SUPABASE_URL?.trim() || "",
  );
  writeFileSync(POSTER_ENV_FILE, content, "utf8");

  console.log("Updated taller_poster_bot/.env.local:");
  console.log("  TALLER_POSTER_DB_SECRET=***");
  console.log("  NEXT_PUBLIC_SUPABASE_URL=<supabase url>");
  console.log("\nOptional from Supabase Dashboard → Settings → API:");
  console.log("  TALLER_SUPABASE_ANON_KEY");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
