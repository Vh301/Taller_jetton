# TALLER Poster Bot

Telegram poster bot for the TALLER channel — ported from Voltix Wheel poster bot.

## Quick start

```bash
cd taller_poster_bot
cp .env.example .env.local   # poster bot only — not taller_token/
npm install
npm run apply:db             # Supabase migrations
npm run type-check
```

See [`docs/runbooks/TALLER_POSTER_BOT.md`](docs/runbooks/TALLER_POSTER_BOT.md) for deploy and webhook setup.

## Structure

```text
app/api/telegram/poster/     — webhook + cron schedule
lib/poster/                  — storage, scheduler, RPC client
lib/telegram/                — env + bot helpers
supabase/migrations/         — tables + RPC functions
scripts/                     — webhook setup, DB apply
```

## Source

Adapted from **Voltix Wheel** (`lib/poster/*`, `app/api/telegram/poster/*`).
