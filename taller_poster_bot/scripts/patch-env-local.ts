/**
 * Update taller_poster_bot/.env.local with non-secret defaults for poster bot launch.
 */
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

let content = readFileSync(POSTER_ENV_FILE, "utf8");

if (!/^TALLER_POSTER_ADMIN_USER_IDS=/m.test(content)) {
  content = upsertEnvLine(content, "TALLER_POSTER_ADMIN_USER_IDS", "7963523915");
}

try {
  const dbUrl = buildDatabaseUrl();
  content = upsertEnvLine(content, "TALLER_SUPABASE_DATABASE_URL", dbUrl);
} catch {
  // password/url missing — skip
}

const anonMatch = content.match(/^TALLER_SUPABASE_ANON_KEY=(.+)$/m);
if (anonMatch?.[1]?.trim()) {
  content = upsertEnvLine(content, "NEXT_PUBLIC_SUPABASE_ANON_KEY", anonMatch[1].trim());
}

writeFileSync(POSTER_ENV_FILE, content, "utf8");
console.log("Updated taller_poster_bot/.env.local (admin ID, DATABASE_URL if available)");
