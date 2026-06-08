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

  const r = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_name ILIKE '%config%' OR table_name ILIKE '%secret%' OR table_name ILIKE '%key%'
    ORDER BY 1,2
  `);
  console.log(r.rows);

  await client.end();
}

main();
