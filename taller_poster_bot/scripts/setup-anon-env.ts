/**
 * After TALLER_SUPABASE_ANON_KEY is in .env.local:
 * sync Vercel env, verify RPC path, redeploy, smoke test.
 *
 * Usage: npx tsx scripts/setup-anon-env.ts
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { POSTER_ENV_FILE } from "./load-env";

function hasAnonKey(): boolean {
  if (!existsSync(POSTER_ENV_FILE)) {
    return false;
  }
  const content = readFileSync(POSTER_ENV_FILE, "utf8");
  const match = content.match(/^TALLER_SUPABASE_ANON_KEY=(.+)$/m);
  return Boolean(match?.[1]?.trim());
}

function run(cmd: string): void {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

if (!hasAnonKey()) {
  console.error("TALLER_SUPABASE_ANON_KEY missing in taller_poster_bot/.env.local");
  console.error("Add from Supabase Dashboard → Project Settings → API → anon public key");
  console.error("Or: npx tsx scripts/apply-anon-key.ts <anon-key>");
  process.exit(1);
}

run("npx tsx scripts/patch-env-local.ts");
run("npx tsx scripts/sync-vercel-poster-env.ts");
run("npx tsx scripts/test-rpc.ts");
run("npx tsx scripts/test-storage.ts");
run("vercel deploy --prod --yes");
run("npx tsx scripts/smoke-poster-commands.ts");

console.log("\nSetup complete: anon synced, RPC verified, production redeployed, smoke tests passed.");
