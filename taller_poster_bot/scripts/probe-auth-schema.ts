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
    "SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('auth','storage','realtime','_supabase') ORDER BY 1,2 LIMIT 30",
    "SELECT table_name FROM information_schema.tables WHERE table_schema='auth' ORDER BY table_name",
    "SELECT * FROM auth.schema_migrations LIMIT 3",
  ];

  for (const q of queries) {
    try {
      const r = await client.query(q);
      console.log("\nOK", q.slice(0, 70), "->", r.rows.length, "rows");
      if (r.rows.length) console.log(r.rows.slice(0, 5));
    } catch (e) {
      console.log("\nERR", q.slice(0, 70), "->", e instanceof Error ? e.message : e);
    }
  }

  await client.end();
}

main();
