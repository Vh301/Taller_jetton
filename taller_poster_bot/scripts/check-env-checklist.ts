import { readFileSync } from "node:fs";
import { POSTER_ENV_FILE } from "./load-env";

const required = [
  "TALLER_POSTER_BOT_API_TOKEN",
  "TALLER_CHANNEL",
  "TALLER_POSTER_ADMIN_USER_IDS",
  "TALLER_POSTER_BOT_SUPABASE_URL",
  "TALLER_SUPABASE_ANON_KEY",
  "TALLER_POSTER_DB_SECRET",
];

const content = readFileSync(POSTER_ENV_FILE, "utf8");
const keys = new Map<string, boolean>();

for (const line of content.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim();
  keys.set(k, Boolean(v));
}

console.log(`ENV checklist: ${POSTER_ENV_FILE}`);
console.log("(values not shown)");
for (const k of required) {
  console.log(`  ${k}: ${keys.get(k) ? "SET" : "MISSING"}`);
}
