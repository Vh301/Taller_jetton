/**
 * Sync poster bot env vars to Vercel (preview + production).
 * Reads taller_poster_bot/.env.local — does not print secret values.
 *
 * Usage: npx tsx scripts/sync-vercel-poster-env.ts
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(process.cwd(), ".env.local");

const VARS = [
  "TALLER_POSTER_BOT_API_TOKEN",
  "TALLER_CHANNEL",
  "TALLER_POSTER_ADMIN_USER_IDS",
  "TALLER_POSTER_BOT_SUPABASE_URL",
  "TALLER_POSTER_DB_SECRET",
  "TALLER_SUPABASE_DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const;

const OPTIONAL_VARS = ["TALLER_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) {
    return out;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value) {
      out[key] = value;
    }
  }
  return out;
}

function setVercelEnv(name: string, value: string, target: string): void {
  execSync(`vercel env add ${name} ${target} --force --sensitive`, {
    input: value,
    stdio: ["pipe", "ignore", "pipe"],
    cwd: process.cwd(),
  });
}

const env = parseEnvFile(ENV_FILE);
const results: { name: string; status: string }[] = [];

for (const name of VARS) {
  const value = env[name];
  if (!value) {
    results.push({ name, status: "missing in taller_poster_bot/.env.local" });
    continue;
  }

  let ok = true;
  for (const target of ["preview", "production"] as const) {
    try {
      setVercelEnv(name, value, target);
    } catch {
      ok = false;
      results.push({ name: `${name}@${target}`, status: "failed" });
    }
  }
  if (ok) {
    results.push({ name, status: "set (preview + production)" });
  }
}

for (const name of OPTIONAL_VARS) {
  const value = env[name];
  if (!value) {
    results.push({ name, status: "skipped (optional)" });
    continue;
  }
  let ok = true;
  for (const target of ["preview", "production"] as const) {
    try {
      setVercelEnv(name, value, target);
    } catch {
      ok = false;
      results.push({ name: `${name}@${target}`, status: "failed" });
    }
  }
  if (ok) {
    results.push({ name, status: "set (preview + production)" });
  }
}

console.log("Vercel env sync results:");
for (const r of results) {
  console.log(`  ${r.name}: ${r.status}`);
}
