/** TALLER poster bot — env helpers (names only in repo; values in .env.local). */

export function getBotToken(): string | undefined {
  return (
    process.env.TALLER_POSTER_BOT_API_TOKEN?.trim() ||
    process.env.TALLER_POSTER_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim()
  );
}

const CHANNEL_ENV_KEYS = [
  "TALLER_CHANNEL",
  "TALLER_POSTER_CHANNEL",
  "TALLER_TELEGRAM_CHANNEL_URL",
  "CHANNEL_ID",
] as const;

export function getChannelEnvSource():
  | { source: (typeof CHANNEL_ENV_KEYS)[number]; raw: string }
  | undefined {
  for (const key of CHANNEL_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (raw) {
      return { source: key, raw };
    }
  }
  return undefined;
}

export function getChannelTarget(): string | undefined {
  const envSource = getChannelEnvSource();
  if (!envSource) {
    return undefined;
  }

  const { raw } = envSource;
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
