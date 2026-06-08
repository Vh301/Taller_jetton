/**
 * Fetch Supabase publishable/anon keys via Management API and update .env.local.
 * Requires SUPABASE_ACCESS_TOKEN in environment.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { POSTER_ENV_FILE, loadPosterEnv } from "./load-env";

loadPosterEnv();

const PROJECT_REF = "kapundznmkfpeingstyu";

function upsertEnvLine(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    return content.replace(re, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error("SUPABASE_ACCESS_TOKEN not set — cannot fetch anon key automatically.");
    console.error("Add TALLER_SUPABASE_ANON_KEY manually from Supabase Dashboard → Settings → API");
    process.exit(1);
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error("Management API failed:", res.status, (await res.text()).slice(0, 200));
    process.exit(1);
  }

  const keys = (await res.json()) as Array<{
    name?: string;
    api_key?: string;
    type?: string;
    disabled?: boolean;
  }>;

  const legacyAnon = keys.find((k) => k.name === "anon" && k.api_key && !k.disabled);
  const publishable = keys.find((k) => k.type === "publishable" && k.api_key && !k.disabled);
  const anonKey = legacyAnon?.api_key ?? publishable?.api_key;

  if (!anonKey) {
    console.error("No active anon/publishable key found");
    process.exit(1);
  }

  let content = readFileSync(POSTER_ENV_FILE, "utf8");
  content = upsertEnvLine(content, "TALLER_SUPABASE_ANON_KEY", anonKey);
  content = upsertEnvLine(content, "NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey);
  writeFileSync(POSTER_ENV_FILE, content, "utf8");

  console.log("Updated taller_poster_bot/.env.local:");
  console.log("  TALLER_SUPABASE_ANON_KEY=***");
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY=***");
}

main();
