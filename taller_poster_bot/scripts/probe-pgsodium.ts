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
    "SELECT * FROM pgsodium.valid_key LIMIT 3",
    "SELECT extname FROM pg_extension WHERE extname LIKE '%sodium%' OR extname LIKE '%vault%'",
    "SELECT proname FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'pgsodium') LIMIT 10",
  ];

  for (const q of queries) {
    try {
      const r = await client.query(q);
      console.log("OK", q.slice(0, 50), r.rows.length);
      if (r.rows.length) console.log(r.rows);
    } catch (e) {
      console.log("ERR", q.slice(0, 50), e instanceof Error ? e.message : e);
    }
  }

  await client.end();
}

main();
