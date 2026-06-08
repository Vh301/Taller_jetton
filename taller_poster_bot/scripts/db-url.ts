import { loadPosterEnv } from "./load-env";

loadPosterEnv();

export function buildDatabaseUrl(): string {
  const direct = process.env.TALLER_SUPABASE_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (direct) {
    return direct;
  }

  const password = process.env.TALLER_POSTER_BOT_SUPABASE_PASSWORD?.trim();
  const supabaseUrl = process.env.TALLER_POSTER_BOT_SUPABASE_URL?.trim();
  if (!password || !supabaseUrl) {
    throw new Error("Need TALLER_POSTER_BOT_SUPABASE_PASSWORD + TALLER_POSTER_BOT_SUPABASE_URL");
  }

  const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!refMatch) {
    throw new Error("Invalid TALLER_POSTER_BOT_SUPABASE_URL");
  }

  const ref = refMatch[1];
  const enc = encodeURIComponent(password);
  return `postgresql://postgres.${ref}:${enc}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
}
