# TALLER Poster Bot — runbook

Webhook-based admin bot for publishing to the TALLER Telegram channel (`@TALLER_Post_bot` → `@taller_channal`).

## Architecture

- **Webhook:** `POST /api/telegram/poster` (Vercel)
- **Scheduler cron (backup):** `GET /api/telegram/poster/schedule` — daily at 20:00 UTC
- **Queue check:** webhook handler also runs scheduler every 60 seconds
- **DB:** Supabase tables `poster_posts`, `poster_channels`, `poster_audit_logs`

Local polling in `tools/taller-poster-bot/` is **dev-only** — do not use in production.

## Required env (Vercel + `taller_poster_bot/.env.local`)

| Variable | Purpose |
|----------|---------|
| `TALLER_POSTER_BOT_API_TOKEN` | Bot token |
| `TALLER_CHANNEL` | Channel (`https://t.me/taller_channal` or `@taller_channal`) |
| `TALLER_POSTER_ADMIN_USER_IDS` | Comma-separated admin Telegram IDs |
| `TALLER_POSTER_BOT_SUPABASE_URL` | Supabase project URL |
| `TALLER_SUPABASE_ANON_KEY` | Anon key (RPC client) |
| `TALLER_POSTER_DB_SECRET` | RPC secret (matches `poster_internal_config.api_secret`) |

## Database setup

```bash
cd taller_poster_bot
npm install
npm run apply:db
```

Or apply SQL in Supabase SQL Editor:

1. `supabase/migrations/20260608120000_taller_poster_bot.sql`
2. `supabase/migrations/20260608120100_taller_poster_rpc_api.sql`

After migration, copy `api_secret` from `poster_internal_config` into `TALLER_POSTER_DB_SECRET`.

## Deploy & webhook

1. Push feature branch → Vercel preview deploy (root: `taller_poster_bot/`)
2. Set env vars on Vercel (Preview + Production)
3. Run webhook setup:

```bash
cd taller_poster_bot
npm run setup:poster-webhook https://YOUR-PREVIEW.vercel.app/api/telegram/poster
```

4. Verify: `GET https://YOUR-PREVIEW.vercel.app/api/telegram/poster` → `{ ok: true }`

## Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/start`, `/help` | All | Help text |
| `/whoami` | All | Telegram user ID |
| `/time` | All | UTC+3 time |
| `/post`, `/schedule`, `/queue`, `/history`, `/cancel`, `/status`, `/chatid` | Admin only | Poster admin |

### Schedule format

```text
YYYY-MM-DD HH:mm
<текст поста>
---
<текст поста>
```

Multiple posts: separate blocks with blank line.

## Smoke test

1. `/start`, `/help`, `/whoami`, `/time`
2. Set admin ID → `/post Test from TALLER bot`
3. Check channel + `poster_posts` in Supabase
4. `/schedule` with future datetime → `/queue` → wait or trigger cron
5. `/history`, `/status <id>`, `/cancel <id>`
