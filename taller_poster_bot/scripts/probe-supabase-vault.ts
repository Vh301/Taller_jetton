import pg from "pg";
import { buildDatabaseUrl } from "./db-url";
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

async function main() {
  const client = new pg.Client({
    connectionString: buildDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const queries = [
    "SELECT name FROM vault.secrets LIMIT 5",
    "SELECT name FROM vault.decrypted_secrets LIMIT 5",
    "SELECT name, setting FROM pg_settings WHERE name ILIKE '%jwt%' OR name ILIKE '%anon%'",
  ];

  for (const q of queries) {
    try {
      const r = await client.query(q);
      console.log("OK:", q.slice(0, 50), "rows:", r.rows.length);
      if (r.rows.length) console.log(r.rows);
    } catch (e) {
      console.log("ERR:", q.slice(0, 50), e instanceof Error ? e.message : e);
    }
  }

  await client.end();
}

main();
