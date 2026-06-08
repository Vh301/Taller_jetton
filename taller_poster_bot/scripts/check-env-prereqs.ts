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

  const checks = [
    "SELECT key, left(value, 8) || '...' AS value_preview FROM poster_internal_config",
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
  ];

  for (const q of checks) {
    console.log("\n--", q.split("\n")[0].slice(0, 60));
    const r = await client.query(q);
    console.log(r.rows);
  }

  await client.end();
}

main();
