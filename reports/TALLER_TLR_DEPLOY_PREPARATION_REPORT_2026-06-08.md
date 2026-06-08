# TALLER / TLR — Deploy Preparation Report

**Date:** 2026-06-08  
**Author:** Masha-Kostil  
**Status:** Preparation complete — awaiting GitHub push + testnet deploy prepare-only

---

## Git state

| Field | Value |
|-------|-------|
| Branch | `feature/taller-tlr-mainnet-deploy` |
| Commit (after prep) | `0e43fecac328b95c4610ed64c3a2a23fcaf03504` |
| Remote | `https://github.com/Vh301/Taller_jetton.git` |
| Local tag | `taller-mainnet-metadata` → `0e43fec` |
| Push status | **BLOCKED** — GitHub denied (`jl5047537` has no write access to `Vh301/Taller_jetton`) |

### Action required (Yan)

Push from account with write access to `Vh301/Taller_jetton`:

```bash
cd C:\Projects\TALLER
git push -u origin feature/taller-tlr-mainnet-deploy
git push origin taller-mainnet-metadata
```

Until push completes, pinned metadata URLs return **HTTP 404**.

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

## Changed / created files

```text
.gitignore
README.md
public/metadata/taller-jetton-metadata.json
public/jetton_image/taller_jetton_image.png
token-v2/                    (full module adapted from Voltix token-v2)
reports/                     (this report)
```

**Not touched:** Voltix / VLTX mainnet contracts, `VOLTIX WHEEL/token-v2` production state.

---

## Env zone

Template: `token-v2/.env.example`

Local secrets: `token-v2/.env.local` — **not committed** (Yan confirmed mnemonic ready locally).

Required variables:

```env
TALLER_TESTNET_DEPLOY_MNEMONIC=...
TALLER_TESTNET_CONFIRM=YES_I_UNDERSTAND   # only when sending txs
TALLER_TESTNET_JETTON_MASTER=             # after deploy
TONCENTER_TESTNET_API_KEY=                # optional
```

---

## Quality checks

| Check | Result |
|-------|--------|
| `npm run build` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS (9/9) |
| Network guards testnet | globalId -3, testnet.tonapi.io |
| Network guards mainnet | globalId -239, tonapi.io |
| VLTX hardcoded masters removed | yes |

---

## Readiness: testnet `deploy --prepare-only`

| Item | Status |
|------|--------|
| Branch + commit | yes |
| token-v2 module | yes |
| Metadata files local | yes |
| Tag created locally | yes |
| Tag pushed to GitHub | **no** — blocked |
| Metadata HTTP 200 | **no** — blocked by push |
| `.env.local` mnemonic | Yan confirmed ready |
| On-chain deploy | **not run** |

**Overall:** `partial` — code ready; **blocked on GitHub push** before metadata preflight can pass.

---

## Next steps (staged-flow)

1. Yan pushes branch + tag to `Vh301/Taller_jetton`
2. Verify metadata + image HTTP 200
3. `npm run deploy:testnet -- --prepare-only` → report → Yan OK
4. `npm run deploy:testnet` → STOP
5. Continue: mint → close → revoke → testnet checks → mainnet preflight → ...

---

## What was NOT done

- No testnet deploy
- No testnet mint / close / revoke
- No mainnet operations
- No `.env.local` committed
- No push to GitHub (permission denied)
