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
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'instances'
    ORDER BY ordinal_position
  `);
  console.log("auth.instances columns:", r.rows);

  const data = await client.query("SELECT * FROM auth.instances LIMIT 1");
  if (data.rows[0]) {
    const row = data.rows[0] as Record<string, unknown>;
    for (const [k, v] of Object.entries(row)) {
      const s = String(v ?? "");
      console.log(k, s ? `${s.slice(0, 6)}... len=${s.length}` : "(null)");
    }
  }

  await client.end();
}

main();
