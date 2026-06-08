/**
 * Write TALLER_SUPABASE_ANON_KEY to taller_poster_bot/.env.local.
 * Usage: npx tsx scripts/apply-anon-key.ts <anon-key>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { POSTER_ENV_FILE } from "./load-env";

function upsertEnvLine(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^#?\\s*${key}=.*$`, "m");
  if (re.test(content)) {
    return content.replace(re, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

const anonKey = process.argv[2]?.trim();
if (!anonKey) {
  console.error("Usage: npx tsx scripts/apply-anon-key.ts <anon-key>");
  process.exit(1);
}

let content = readFileSync(POSTER_ENV_FILE, "utf8");
content = upsertEnvLine(content, "TALLER_SUPABASE_ANON_KEY", anonKey);
content = upsertEnvLine(content, "NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey);
writeFileSync(POSTER_ENV_FILE, content, "utf8");

console.log("Updated taller_poster_bot/.env.local:");
console.log("  TALLER_SUPABASE_ANON_KEY=***");
console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY=***");
