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
    SELECT name, setting
    FROM pg_settings
    WHERE name ILIKE '%jwt%' OR name ILIKE '%api%' OR name ILIKE '%secret%'
    ORDER BY name
  `);
  console.log("settings count:", r.rows.length);
  for (const row of r.rows) {
    const val = String(row.setting ?? "");
    console.log(row.name, val ? `${val.slice(0, 4)}...(${val.length})` : "(empty)");
  }

  await client.end();
}

main();
