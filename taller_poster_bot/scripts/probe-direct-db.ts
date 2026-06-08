import pg from "pg";
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

async function tryConnect(label: string, connectionString: string) {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const r = await client.query("SELECT current_setting('app.settings.jwt_secret', true) AS jwt");
    console.log(label, "OK", "jwt_secret len:", String(r.rows[0]?.jwt ?? "").length);
    await client.end();
    return true;
  } catch (e) {
    console.log(label, "FAIL", e instanceof Error ? e.message : e);
    return false;
  }
}

async function main() {
  const password = process.env.TALLER_POSTER_BOT_SUPABASE_PASSWORD?.trim();
  if (!password) throw new Error("no password");
  const enc = encodeURIComponent(password);
  const ref = "kapundznmkfpeingstyu";

  await tryConnect("direct", `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`);
  await tryConnect("pooler6543", `postgresql://postgres.${ref}:${enc}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`);
  await tryConnect("pooler5432", `postgresql://postgres.${ref}:${enc}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`);
}

main();
