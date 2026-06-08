/**
 * Direct Postgres storage fallback (when REST RPC anon key is unavailable).
 * Same behavior as poster_* RPC functions.
 */

import pg from "pg";
import { getDatabaseUrl, getPosterDbSecret } from "./config";

type DbPostRow = {
  id: string;
  publish_at: string;
  text: string;
  status: string;
  created_at: string;
  published_at: string | null;
  last_error: string | null;
};

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    const url = getDatabaseUrl();
    if (!url) {
      throw new Error("TALLER_SUPABASE_DATABASE_URL not set");
    }
    pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
  }
  return pool;
}

function assertSecret(pSecret: string): void {
  const expected = getPosterDbSecret();
  if (!expected || pSecret !== expected) {
    throw new Error("forbidden");
  }
}

async function verifySecret(): Promise<void> {
  const secret = getPosterDbSecret();
  if (!secret) {
    throw new Error("TALLER_POSTER_DB_SECRET not set");
  }
  const client = getPool();
  const r = await client.query(
    "SELECT value FROM poster_internal_config WHERE key = 'api_secret' LIMIT 1",
  );
  if (r.rows[0]?.value !== secret) {
    throw new Error("Poster DB secret mismatch");
  }
}

export function isPosterPgConfigured(): boolean {
  return Boolean(getDatabaseUrl() && getPosterDbSecret());
}

export async function pgCreateScheduled(publishAt: string, text: string): Promise<DbPostRow> {
  await verifySecret();
  const client = getPool();
  const insert = await client.query<DbPostRow>(
    `INSERT INTO poster_posts (publish_at, text, status)
     VALUES ($1, $2, 'scheduled') RETURNING *`,
    [publishAt, text],
  );
  const row = insert.rows[0];
  await client.query(
    `INSERT INTO poster_audit_logs (post_id, action, details)
     VALUES ($1, 'post_scheduled', jsonb_build_object('publish_at', $2::text))`,
    [row.id, publishAt],
  );
  return row;
}

export async function pgRecordPublished(
  text: string,
  actor?: number,
  messageId?: number,
): Promise<DbPostRow> {
  await verifySecret();
  const client = getPool();
  const insert = await client.query<DbPostRow>(
    `INSERT INTO poster_posts (publish_at, text, status, published_at, telegram_message_id)
     VALUES (NOW(), $1, 'published', NOW(), $2) RETURNING *`,
    [text, messageId ?? null],
  );
  const row = insert.rows[0];
  await client.query(
    `INSERT INTO poster_audit_logs (post_id, action, actor_telegram_id, details)
     VALUES ($1, 'post_published_instant', $2, jsonb_build_object('telegram_message_id', $3))`,
    [row.id, actor ?? null, messageId ?? null],
  );
  return row;
}

export async function pgGetScheduledDue(limit: number): Promise<DbPostRow[]> {
  await verifySecret();
  const r = await getPool().query<DbPostRow>(
    `SELECT * FROM poster_posts
     WHERE status = 'scheduled' AND publish_at <= NOW()
     ORDER BY publish_at ASC LIMIT $1`,
    [limit],
  );
  return r.rows;
}

export async function pgGetUpcoming(limit: number): Promise<DbPostRow[]> {
  await verifySecret();
  const r = await getPool().query<DbPostRow>(
    `SELECT * FROM poster_posts WHERE status = 'scheduled' ORDER BY publish_at ASC LIMIT $1`,
    [limit],
  );
  return r.rows;
}

export async function pgGetById(id: string): Promise<DbPostRow | null> {
  await verifySecret();
  const r = await getPool().query<DbPostRow>("SELECT * FROM poster_posts WHERE id = $1", [id]);
  return r.rows[0] ?? null;
}

export async function pgGetByStatus(status: string, limit: number): Promise<DbPostRow[]> {
  await verifySecret();
  const r = await getPool().query<DbPostRow>(
    "SELECT * FROM poster_posts WHERE status = $1 ORDER BY created_at DESC LIMIT $2",
    [status, limit],
  );
  return r.rows;
}

export async function pgMarkPublished(id: string, messageId?: number): Promise<void> {
  await verifySecret();
  const client = getPool();
  await client.query(
    `UPDATE poster_posts
     SET status = 'published', published_at = NOW(), last_error = NULL, telegram_message_id = $2
     WHERE id = $1`,
    [id, messageId ?? null],
  );
  await client.query(
    `INSERT INTO poster_audit_logs (post_id, action, details)
     VALUES ($1, 'post_published_scheduled', jsonb_build_object('telegram_message_id', $2))`,
    [id, messageId ?? null],
  );
}

export async function pgMarkCanceled(id: string, actor?: number): Promise<void> {
  await verifySecret();
  const client = getPool();
  await client.query("UPDATE poster_posts SET status = 'canceled' WHERE id = $1", [id]);
  await client.query(
    "INSERT INTO poster_audit_logs (post_id, action, actor_telegram_id) VALUES ($1, 'post_canceled', $2)",
    [id, actor ?? null],
  );
}

export async function pgUpdateError(id: string, errorText: string): Promise<void> {
  await verifySecret();
  const client = getPool();
  await client.query("UPDATE poster_posts SET last_error = $2 WHERE id = $1", [id, errorText]);
  await client.query(
    `INSERT INTO poster_audit_logs (post_id, action, details)
     VALUES ($1, 'post_publish_error', jsonb_build_object('error', $2))`,
    [id, errorText],
  );
}
