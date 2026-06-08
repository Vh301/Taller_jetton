import pg from "pg";
import { buildDatabaseUrl } from "./db-url";
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

async function main() {
  const client = new pg.Client({
    connectionString: buildDatabaseUrl().replace(":6543/", ":5432/"),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const queries = [
    "SELECT proname FROM pg_proc WHERE proname ILIKE '%jwt%' AND pronamespace = 'public'::regnamespace",
    "SELECT proname, pronamespace::regnamespace::text FROM pg_proc WHERE proname ILIKE '%jwt%' LIMIT 20",
    "SELECT auth.uid()",
  ];

  for (const q of queries) {
    try {
      const r = await client.query(q);
      console.log("OK", q.slice(0, 60), r.rows);
    } catch (e) {
      console.log("ERR", q.slice(0, 60), e instanceof Error ? e.message : e);
    }
  }

  await client.end();
}

main();
