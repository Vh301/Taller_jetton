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

  const names = [
    "app.settings.jwt_secret",
    "app.settings.jwt_exp",
    "app.settings.service_role_key",
    "app.settings.anon_key",
  ];

  for (const name of names) {
    try {
      const r = await client.query("SELECT current_setting($1, true) AS v", [name]);
      const v = String(r.rows[0]?.v ?? "");
      console.log(name, v ? `len=${v.length}` : "(empty)");
    } catch (e) {
      console.log(name, "ERR", e instanceof Error ? e.message : e);
    }
  }

  await client.end();
}

main();
