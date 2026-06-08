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

  const r = await client.query(`
    SELECT nspname FROM pg_namespace
    WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
    ORDER BY nspname
  `);
  console.log(r.rows.map((x) => x.nspname).join(", "));

  await client.end();
}

main();
