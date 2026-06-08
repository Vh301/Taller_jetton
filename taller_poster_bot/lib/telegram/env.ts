/** TALLER poster bot — env helpers (names only in repo; values in .env.local). */

export function getBotToken(): string | undefined {
  return (
    process.env.TALLER_POSTER_BOT_API_TOKEN?.trim() ||
    process.env.TALLER_POSTER_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim()
  );
}

export function getChannelTarget(): string | undefined {
  const raw =
    process.env.TALLER_CHANNEL?.trim() ||
    process.env.TALLER_POSTER_CHANNEL?.trim() ||
    process.env.TALLER_TELEGRAM_CHANNEL_URL?.trim() ||
    process.env.CHANNEL_ID?.trim();

  if (!raw) {
    return undefined;
  }

  const tMeMatch = raw.match(/(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]+)/i);
  if (tMeMatch) {
    return `@${tMeMatch[1]}`;
  }

  return raw;
}

export function getPosterAdminUserIds(): number[] {
  const raw =
    process.env.TALLER_POSTER_ADMIN_USER_IDS?.trim() ||
    process.env.ADMIN_USER_IDS?.trim();

  if (!raw) {
    return [];
  }

  return raw
    .split(/[,\s]+/)
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isFinite(id));
}

export function isPosterAdminConfigured(): boolean {
  return getPosterAdminUserIds().length > 0;
}

/** Empty admin list = deny all (Voltix/ECU-style). */
export function isPosterAdmin(userId: number | undefined): boolean {
  if (!userId) {
    return false;
  }

  const admins = getPosterAdminUserIds();
  if (admins.length === 0) {
    return false;
  }

  return admins.includes(userId);
}
