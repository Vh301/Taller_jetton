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

  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'poster_%'
    ORDER BY table_name
  `);

  const funcs = await client.query(`
    SELECT proname FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'poster_%'
    ORDER BY proname
  `);

  console.log("Tables:", tables.rows.map((r) => r.table_name).join(", "));
  console.log("RPC functions:", funcs.rows.map((r) => r.proname).join(", "));
  console.log("poster_internal_config row exists:", (await client.query("SELECT count(*) FROM poster_internal_config")).rows[0].count);

  await client.end();
}

main();
