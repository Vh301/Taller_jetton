# TALLER Poster Bot — RPC Phase Final Report

**Date:** 2026-06-08  
**Author:** Masha-Kostil  
**Branch:** `feature/taller-poster-bot`  
**Status:** Phase closed — RPC storage active on production, Postgres fallback preserved.

---

## Executive summary

TALLER poster bot (`@TALLER_Post_bot`) is deployed on Vercel with Supabase queue storage. Primary path is **Supabase REST RPC** (Voltix-style). Direct Postgres pooler remains as emergency fallback.

```text
TALLER_SUPABASE_ANON_KEY = sb_publishable_...   (Publishable key — replacement for legacy anon JWT)
storage backend          = rpc
Postgres fallback        = preserved (TALLER_SUPABASE_DATABASE_URL)
Production               = redeployed
Smoke test               = OK
```

---

## Environment

| Variable | `.env.local` | Vercel Preview | Vercel Production |
|----------|:------------:|:--------------:|:-----------------:|
| `TALLER_SUPABASE_ANON_KEY` | yes | yes | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes (patched) | yes | yes |
| `TALLER_POSTER_BOT_API_TOKEN` | yes | yes | yes |
| `TALLER_CHANNEL` | yes | yes | yes |
| `TALLER_POSTER_ADMIN_USER_IDS` | yes | yes | yes |
| `TALLER_POSTER_BOT_SUPABASE_URL` | yes | yes | yes |
| `TALLER_POSTER_DB_SECRET` | yes | yes | yes |
| `TALLER_SUPABASE_DATABASE_URL` | yes (fallback) | yes | yes |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | yes |

**Note:** Supabase Dashboard now shows **Publishable key** (`sb_publishable_...`) instead of legacy anon JWT (`eyJhbG...`). Both work as `apikey` + `Authorization: Bearer` for REST RPC. TALLER uses Publishable key in `TALLER_SUPABASE_ANON_KEY`.

Secrets live only in `taller_poster_bot/.env.local` (gitignored) and Vercel encrypted env — not in repo, reports, or `.env.example`.

---

## Storage architecture

| Layer | Path | When active |
|-------|------|-------------|
| **Primary** | `lib/poster/rpc.ts` → Supabase REST RPC | `TALLER_SUPABASE_ANON_KEY` + `TALLER_POSTER_DB_SECRET` + Supabase URL |
| **Fallback** | `lib/poster/storage-pg.ts` → Postgres pooler | When anon key unavailable but `TALLER_SUPABASE_DATABASE_URL` + secret set |

Routing: `lib/poster/storage.ts` — `getPosterStorageBackend()` returns `rpc` | `pg` | `none`. RPC preferred when anon key present.

**Verified locally:** `storage backend: rpc` after Publishable key added.

---

## Supabase (project `kapundznmkfpeingstyu`)

| Object | Status |
|--------|--------|
| `poster_posts`, `poster_channels`, `poster_audit_logs`, `poster_internal_config` | migrated |
| RPC functions (`poster_create_scheduled`, `poster_get_upcoming`, etc.) | migrated |
| `poster_internal_config.api_secret` → `TALLER_POSTER_DB_SECRET` | synced |

Migrations:
- `supabase/migrations/20260608120000_taller_poster_bot.sql`
- `supabase/migrations/20260608120100_taller_poster_rpc_api.sql`

---

## Vercel deployment

| Field | Value |
|-------|-------|
| Project | `taller_poster_bot` (team `301-s-projects`) |
| Production URL | https://tallerposterbot.vercel.app |
| Webhook | `https://tallerposterbot.vercel.app/api/telegram/poster` |
| Runtime | `nodejs` (supports `pg` fallback) |
| Cron | `0 20 * * *` → `/api/telegram/poster/schedule` |

Production redeploy executed after anon key sync to Vercel env.

---

## Smoke test (production webhook)

All commands returned `200 {"ok":true}`:

| Command | Result |
|---------|--------|
| `/queue` | OK |
| `/history` | OK |
| `/schedule` | OK |
| `YYYY-MM-DD HH:mm` + schedule text | OK |
| `/post Test from TALLER RPC` | OK |

**Channel publication:** `/post Test from TALLER RPC` was sent during smoke test — **yes**, test post published to configured channel (`https://t.me/taller_channal`) if bot has channel post rights.

---

## Local verification commands

```bash
cd taller_poster_bot
npx tsx scripts/test-rpc.ts          # RPC poster_get_upcoming OK
npx tsx scripts/test-storage.ts      # storage backend: rpc
npm run smoke:poster                 # production webhook smoke
npm run setup:anon-env               # full anon sync + redeploy pipeline
```

---

## Git safety

- `taller_poster_bot/.env.local` — **not tracked** (`.gitignore`)
- `taller_token/.env.local` — **not tracked**
- `.env.example` files contain placeholders only — no real keys
- Poster bot secrets zone: `taller_poster_bot/.env.local` only (not `taller_token/`)

---

## Phase closure checklist

- [x] Poster bot module `taller_poster_bot/` implemented (Voltix port)
- [x] Supabase migrations applied
- [x] Publishable key as `TALLER_SUPABASE_ANON_KEY`
- [x] Vercel Preview + Production env synced
- [x] Storage backend = `rpc`
- [x] Postgres fallback preserved
- [x] Production redeploy
- [x] Webhook installed
- [x] Smoke test passed
- [x] `.env.local` not in git

**Phase `taller_poster_bot + DB + RPC` — closed.**
