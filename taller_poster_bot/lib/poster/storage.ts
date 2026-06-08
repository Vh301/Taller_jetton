/**
 * Storage для очереди постов TALLER poster bot (Supabase RPC).
 */

import { isPosterDbConfigured, rpc } from "./rpc";
import { isPosterPgConfigured, pgCreateScheduled, pgRecordPublished, pgGetScheduledDue, pgGetUpcoming, pgGetById, pgMarkPublished, pgMarkCanceled, pgUpdateError, pgGetByStatus } from "./storage-pg";

export interface Post {
  id: string;
  publish_at: string;
  text: string;
  status: "scheduled" | "published" | "canceled";
  created_at: string;
  published_at: string | null;
  last_error: string | null;
}

type DbPostRow = {
  id: string;
  publish_at: string;
  text: string;
  status: string;
  created_at: string;
  published_at: string | null;
  last_error: string | null;
};

function rowToPost(row: DbPostRow): Post {
  return {
    id: row.id,
    publish_at: row.publish_at,
    text: row.text,
    status: row.status as Post["status"],
    created_at: row.created_at,
    published_at: row.published_at,
    last_error: row.last_error,
  };
}

function assertDbConfigured(): void {
  if (!isPosterDbConfigured() && !isPosterPgConfigured()) {
    throw new Error(
      "Poster DB not configured: set TALLER_SUPABASE_ANON_KEY + TALLER_POSTER_DB_SECRET, or TALLER_SUPABASE_DATABASE_URL + TALLER_POSTER_DB_SECRET",
    );
  }
}

function usePgStorage(): boolean {
  return !isPosterDbConfigured() && isPosterPgConfigured();
}

/** Active storage backend: RPC preferred when anon key is set (Voltix-style). */
export function getPosterStorageBackend(): "rpc" | "pg" | "none" {
  if (isPosterDbConfigured()) {
    return "rpc";
  }
  if (isPosterPgConfigured()) {
    return "pg";
  }
  return "none";
}

export async function logAudit(): Promise<void> {
  // Audit handled inside RPC functions
}

export async function createPost(
  publishAt: string,
  text: string,
  actorTelegramId?: number,
): Promise<Post> {
  assertDbConfigured();
  void actorTelegramId;

  if (usePgStorage()) {
    const row = await pgCreateScheduled(publishAt, text);
    return rowToPost(row);
  }

  const row = await rpc<DbPostRow>("poster_create_scheduled", {
    p_publish_at: publishAt,
    p_text: text,
  });

  return rowToPost(row);
}

export function isPosterStorageConfigured(): boolean {
  return isPosterDbConfigured() || isPosterPgConfigured();
}

export async function recordInstantPublishedPost(
  text: string,
  actorTelegramId?: number,
  telegramMessageId?: number,
): Promise<Post> {
  assertDbConfigured();

  if (usePgStorage()) {
    const row = await pgRecordPublished(text, actorTelegramId, telegramMessageId);
    return rowToPost(row);
  }

  const row = await rpc<DbPostRow>("poster_record_published", {
    p_text: text,
    p_actor: actorTelegramId ?? null,
    p_message_id: telegramMessageId ?? null,
  });

  return rowToPost(row);
}

export async function getScheduledPosts(limit: number = 10): Promise<Post[]> {
  assertDbConfigured();

  if (usePgStorage()) {
    const rows = await pgGetScheduledDue(limit);
    return rows.map(rowToPost);
  }

  const rows = await rpc<DbPostRow[]>("poster_get_scheduled_due", {
    p_limit: limit,
  });

  return (rows ?? []).map(rowToPost);
}

export async function getUpcomingPosts(limit: number = 10): Promise<Post[]> {
  assertDbConfigured();

  if (usePgStorage()) {
    const rows = await pgGetUpcoming(limit);
    return rows.map(rowToPost);
  }

  const rows = await rpc<DbPostRow[]>("poster_get_upcoming", {
    p_limit: limit,
  });

  return (rows ?? []).map(rowToPost);
}

export async function getPostById(id: string): Promise<Post | null> {
  assertDbConfigured();

  if (usePgStorage()) {
    const row = await pgGetById(id);
    return row ? rowToPost(row) : null;
  }

  const row = await rpc<DbPostRow | null>("poster_get_by_id", {
    p_id: id,
  });

  return row ? rowToPost(row) : null;
}

export async function markPostAsPublished(
  id: string,
  telegramMessageId?: number,
): Promise<void> {
  assertDbConfigured();

  if (usePgStorage()) {
    await pgMarkPublished(id, telegramMessageId);
    return;
  }

  await rpc("poster_mark_published", {
    p_id: id,
    p_message_id: telegramMessageId ?? null,
  });
}

export async function markPostAsCanceled(
  id: string,
  actorTelegramId?: number,
): Promise<void> {
  assertDbConfigured();

  if (usePgStorage()) {
    await pgMarkCanceled(id, actorTelegramId);
    return;
  }

  await rpc("poster_mark_canceled", {
    p_id: id,
    p_actor: actorTelegramId ?? null,
  });
}

export async function updatePostError(id: string, errorText: string): Promise<void> {
  assertDbConfigured();

  if (usePgStorage()) {
    await pgUpdateError(id, errorText);
    return;
  }

  await rpc("poster_update_error", {
    p_id: id,
    p_error: errorText,
  });
}

export async function getPostsByStatus(
  status: "scheduled" | "published" | "canceled",
  limit: number = 50,
): Promise<Post[]> {
  assertDbConfigured();

  if (usePgStorage()) {
    const rows = await pgGetByStatus(status, limit);
    return rows.map(rowToPost);
  }

  const rows = await rpc<DbPostRow[]>("poster_get_by_status", {
    p_status: status,
    p_limit: limit,
  });

  return (rows ?? []).map(rowToPost);
}
