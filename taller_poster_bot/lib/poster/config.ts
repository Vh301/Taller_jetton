/**
 * TALLER poster bot — env and channel helpers (adapted from Voltix poster bot).
 */

import {
  getBotToken,
  getChannelTarget,
  getPosterAdminUserIds,
  isPosterAdmin,
  isPosterAdminConfigured,
} from "@/lib/telegram/env";

export {
  getBotToken as getPosterBotToken,
  getChannelTarget,
  getPosterAdminUserIds,
  isPosterAdmin,
  isPosterAdminConfigured,
};

export function getPosterApiUrl(): string | null {
  const token = getBotToken();
  if (!token) {
    return null;
  }
  return `https://api.telegram.org/bot${token}`;
}

/** Resolved channel target for Telegram API (@username or numeric id). */
export function getPosterChannelId(): string | undefined {
  return getChannelTarget();
}

export function resolveChannelChatId(channelId: string): string | number {
  if (/^-?\d+$/.test(channelId.trim())) {
    return Number.parseInt(channelId.trim(), 10);
  }
  return channelId;
}

/** Human-readable channel label for bot messages. */
export function getChannelDisplayName(): string {
  const channel = getChannelTarget();
  if (!channel) {
    return "TALLER channel";
  }
  if (channel.startsWith("@")) {
    return channel;
  }
  return `channel ${channel}`;
}

export function getSupabaseUrl(): string | undefined {
  return (
    process.env.TALLER_POSTER_BOT_SUPABASE_URL?.trim() ||
    process.env.TALLER_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  );
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return (
    process.env.TALLER_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getDatabaseUrl(): string | undefined {
  return (
    process.env.TALLER_SUPABASE_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim()
  );
}

export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.TALLER_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

export function getPosterDbSecret(): string | undefined {
  return process.env.TALLER_POSTER_DB_SECRET?.trim();
}
