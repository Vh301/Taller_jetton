# TALLER / TLR — Deploy Preparation Report

**Date:** 2026-06-08  
**Updated:** 2026-06-08 (revision: module rename + env structure)  
**Author:** Masha-Kostil  
**Status:** Preparation complete — awaiting GitHub push + testnet deploy prepare-only

---

## Revision log (2026-06-08)

| Change | Before | After |
|--------|--------|-------|
| Jetton module folder | `token-v2/` (Voltix copy name) | **`taller_token/`** |
| npm package name | `taller-tlr-token-v2` | **`taller-token`** |
| Env zone path | `token-v2/.env.local` | **`taller_token/.env.local`** |
| Env template | `token-v2/.env.example` | **`taller_token/.env.example`** |
| `.env.local` file | not created | **created locally** (empty structure, not in git) |
| Script / config messages | referenced `token-v2/.env.local` | updated to `taller_token/.env.local` |

**Reason:** TALLER project must not reuse Voltix `token-v2` naming — separate deploy contour per master-guide.

**Note:** If an old `token-v2/.env.local` exists locally — it is **stale**. Use only `taller_token/.env.local`.

---

## Git state

| Field | Value |
|-------|-------|
| Branch | `feature/taller-tlr-mainnet-deploy` |
| Commits (initial prep) | `0e43fec` (module+metadata), `b8159f4` (first report) |
| Pending uncommitted | rename `token-v2` → `taller_token`, path updates, report revision |
| Remote | `https://github.com/Vh301/Taller_jetton.git` |
| Local tag | `taller-mainnet-metadata` → `0e43fec` |
| Push status | **BLOCKED** — GitHub denied (`jl5047537` has no write access to `Vh301/Taller_jetton`) |

### Action required (Yan)

Push from account with write access to `Vh301/Taller_jetton` (after local changes committed):

```bash
cd C:\Projects\TALLER
git add .
git commit -m "Rename token-v2 to taller_token and update project paths"
git push -u origin feature/taller-tlr-mainnet-deploy
git push origin taller-mainnet-metadata
```

Until push completes, pinned metadata URLs return **HTTP 404**.

---

## Project layout

```text
TALLER/
├── public/
│   ├── metadata/taller-jetton-metadata.json
│   └── jetton_image/taller_jetton_image.png
├── taller_token/              ← jetton module + deploy scripts (NOT token-v2)
│   ├── .env.example           ← template (in git)
│   ├── .env.local             ← secrets (local only, gitignored)
│   ├── contracts/
│   ├── lib/
│   ├── scripts/
│   └── tests/
├── reports/
│   └── TALLER_TLR_DEPLOY_PREPARATION_REPORT_2026-06-08.md
└── LOGO/                      ← source images (gitignored)
```

**Not touched:** Voltix / VLTX mainnet contracts, `VOLTIX WHEEL/token-v2` production state.

---

## Token parameters (confirmed by Yan)

| Field | Value |
|-------|-------|
| Name | TALLER |
| Symbol | TLR |
| Decimals | 9 |
| Mainnet supply | 100,000,000 TLR |
| Mainnet smallest units | `100_000_000_000_000_000` |
| Testnet proof mint | 1,000,000 TLR |
| Testnet smallest units | `1_000_000_000_000_000` |

---

## Wallets

| Role | Testnet | Mainnet |
|------|---------|---------|
| Admin / owner | `0QDTlkC0OE4CRqOMzBiRTiOcNKTq8spJjGI8gIlU6-xOUz5s` | `UQDZr3Ka6DE6wWZijBQDVbbJdMHYeqXiZ-VXsSeb4ypth0TD` |
| Holder after mint | same | same |

---

## Metadata

**Tag:** `taller-mainnet-metadata`

**JSON path:** `public/metadata/taller-jetton-metadata.json`

```json
{
  "name": "TALLER",
  "symbol": "TLR",
  "decimals": 9,
  "description": "TALLER is a digital token created for community and club-based use within the TALLER ecosystem.",
  "image": "https://raw.githubusercontent.com/Vh301/Taller_jetton/taller-mainnet-metadata/public/jetton_image/taller_jetton_image.png"
}
```

**Pinned URLs (after push):**

- Metadata: `https://raw.githubusercontent.com/Vh301/Taller_jetton/taller-mainnet-metadata/public/metadata/taller-jetton-metadata.json`
- Image: `https://raw.githubusercontent.com/Vh301/Taller_jetton/taller-mainnet-metadata/public/jetton_image/taller_jetton_image.png`

**Preflight check (2026-06-08):**

| URL | HTTP 200 |
|-----|----------|
| Metadata JSON | **no** (404 — repo not pushed) |
| Image PNG | **no** (404 — repo not pushed) |

---

## Image

| Field | Value |
|-------|-------|
| Source | `LOGO/Taller_Tiser.png` (local only, gitignored) |
| Processed | `public/jetton_image/taller_jetton_image.png` |
| Dimensions | 512 × 512 px |
| File size | ~505 KB (was 2.76 MB — unacceptable) |

---

## Env zone

| File | Path | In git |
|------|------|--------|
| Template | `taller_token/.env.example` | yes |
| Local secrets | `taller_token/.env.local` | **no** (gitignored) |

`.env.local` created with correct structure (testnet + mainnet sections, confirm flags commented).

Yan fills locally:

```env
TALLER_TESTNET_DEPLOY_MNEMONIC=...
# TALLER_TESTNET_CONFIRM=YES_I_UNDERSTAND   # only before real tx, not --prepare-only
TALLER_TESTNET_JETTON_MASTER=             # after deploy
TONCENTER_TESTNET_API_KEY=                # optional
```

Mainnet variables remain empty until testnet phase complete.

---

## Quality checks

| Check | Result |
|-------|--------|
| `npm run build` | PASS |
| `npm run typecheck` | PASS (re-checked after rename) |
| `npm test` | PASS (9/9) |
| Network guards testnet | globalId -3, testnet.tonapi.io |
| Network guards mainnet | globalId -239, tonapi.io |
| VLTX hardcoded masters removed | yes |
| Module naming TALLER-specific | yes (`taller_token/`) |

---

## Readiness: testnet `deploy --prepare-only`

| Item | Status |
|------|--------|
| Branch | yes |
| `taller_token/` module | yes |
| Metadata files local | yes |
| Tag created locally | yes |
| Tag pushed to GitHub | **no** — blocked |
| Metadata HTTP 200 | **no** — blocked by push |
| `taller_token/.env.local` exists | yes (structure; mnemonic = Yan fills) |
| On-chain deploy | **not run** |

**Overall:** `partial` — code ready; **blocked on GitHub push** before metadata preflight can pass.

---

## Commands (updated paths)

```bash
cd C:\Projects\TALLER\taller_token

# after push + mnemonic filled:
npm run deploy:testnet -- --prepare-only
```

---

## Next steps (staged-flow)

1. Commit rename changes locally (if not yet committed)
2. Yan pushes branch + tag to `Vh301/Taller_jetton`
3. Verify metadata + image HTTP 200
4. Fill `taller_token/.env.local` mnemonic (if not done)
5. `npm run deploy:testnet -- --prepare-only` → report → Yan OK
6. `npm run deploy:testnet` → STOP
7. Continue: mint → close → revoke → testnet checks → mainnet preflight → ...

---

## What was NOT done

- No testnet deploy
- No testnet mint / close / revoke
- No mainnet operations
- No `.env.local` committed
- No push to GitHub (permission denied)
- No on-chain steps of any kind
