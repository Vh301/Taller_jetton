/**
 * Test Supabase RPC connectivity (does not print secrets).
 */
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

async function main() {
  const url = process.env.TALLER_POSTER_BOT_SUPABASE_URL?.trim();
  const anon = process.env.TALLER_SUPABASE_ANON_KEY?.trim();
  const secret = process.env.TALLER_POSTER_DB_SECRET?.trim();

  if (!url || !anon || !secret) {
    console.error("Missing TALLER_POSTER_BOT_SUPABASE_URL, TALLER_SUPABASE_ANON_KEY, or TALLER_POSTER_DB_SECRET");
    process.exit(1);
  }

  const res = await fetch(`${url}/rest/v1/rpc/poster_get_upcoming`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ p_secret: secret, p_limit: 1 }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("RPC test failed:", res.status, text.slice(0, 200));
    process.exit(1);
  }

  console.log("RPC poster_get_upcoming OK");
}

main();
