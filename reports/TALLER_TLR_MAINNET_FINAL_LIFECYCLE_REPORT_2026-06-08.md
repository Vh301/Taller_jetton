# TALLER / TLR — Mainnet Final Lifecycle Report

**Date:** 2026-06-08  
**Author:** Masha-Kostil  
**Network:** TON mainnet (globalId `-239`)  
**Status:** Deploy + mint + close minting **completed**. Revoke owner **NOT executed** — admin preserved by Yan's decision.

---

## Executive summary

TALLER / TLR mainnet jetton master is live with fixed supply and minting closed. Admin/owner rights remain on Yan's deploy wallet until a separate explicit revoke decision.

```text
Revoke owner технически подготовлен и проверен через prepare-only, но НЕ выполнен.
Решение о revoke owner остаётся отдельным будущим решением Яна.
До отдельной команды Яна admin/owner сохраняется.
```

---

## Current mainnet status (on-chain, 2026-06-08)

| Field | Value |
|-------|-------|
| Network | mainnet |
| globalId | `-239` |
| TonAPI | `https://tonapi.io` |
| **Master** | `EQBbbUvr84qdfAAWUL8ZjRvO3FzEDKsLEFMiKlXg7d9u17Rq` |
| Name | TALLER |
| Symbol | TLR |
| Decimals | 9 |
| Total supply (human) | 100,000,000 TLR |
| Total supply (smallest units) | `100000000000000000` |
| Mintable | **false** |
| Admin / owner | `EQDZr3Ka6DE6wWZijBQDVbbJdMHYeqXiZ-VXsSeb4ypthxkG` |
| Holder | `EQDZr3Ka6DE6wWZijBQDVbbJdMHYeqXiZ-VXsSeb4ypthxkG` |
| Holder balance (nano) | `100000000000000000` |
| Metadata tag | `taller-mainnet-metadata` |
| Revoke owner | **NOT executed** |

### Metadata (tag-pinned, unchanged)

| Field | URL |
|-------|-----|
| JSON | https://raw.githubusercontent.com/Vh301/Taller_jetton/taller-mainnet-metadata/public/metadata/taller-jetton-metadata.json |
| Image | https://raw.githubusercontent.com/Vh301/Taller_jetton/taller-mainnet-metadata/public/jetton_image/taller_jetton_image.png |

### TON balances (snapshot after close minting)

| Account | Balance (nano) | ≈ TON |
|---------|----------------|-------|
| Deploy / holder wallet | `1,189,100,464` | ~1.189 |
| Jetton master | `149,825,074` | ~0.150 |

---

## Transaction chain

| Step | Status | Event / tx hash | Tonviewer |
|------|--------|-----------------|-----------|
| **Deploy** | ✅ executed | `2f1e7b0f9f2c8880977a2a0fda4e247c5df025016a0a4bb6bec5ebd838f8e65a` | [link](https://tonviewer.com/transaction/2f1e7b0f9f2c8880977a2a0fda4e247c5df025016a0a4bb6bec5ebd838f8e65a) |
| Deploy (master internal) | ✅ | `07c452145cb091fadd14d697c6dc46de3019b9576157685597519c443fdd23ba` | [link](https://tonviewer.com/transaction/07c452145cb091fadd14d697c6dc46de3019b9576157685597519c443fdd23ba) |
| **Mint** (100M TLR) | ✅ executed | `e889f1da69ffeefdebc069c0f10e8e242b1ea99e91ce0af14a6ab0b1674d8ad3` | [link](https://tonviewer.com/transaction/e889f1da69ffeefdebc069c0f10e8e242b1ea99e91ce0af14a6ab0b1674d8ad3) |
| **Close minting** | ✅ executed | `c78893df9f1a4f8caa7506a2857abf3599f293bcbaaf3f667c036b34fe14f4cd` | [link](https://tonviewer.com/transaction/c78893df9f1a4f8caa7506a2857abf3599f293bcbaaf3f667c036b34fe14f4cd) |
| **Revoke owner** | ❌ **NOT EXECUTED** | — | — |

Master Tonviewer: https://tonviewer.com/EQBbbUvr84qdfAAWUL8ZjRvO3FzEDKsLEFMiKlXg7d9u17Rq

---

## Revoke owner prepare-only

| Check | Result |
|-------|--------|
| prepare-only run | ✅ passed |
| admin == expected owner | yes |
| mintable == false | yes |
| total_supply == expected | yes |
| metadata unchanged | yes |
| refund safety block | yes |
| `TALLER_REVOKE_ADMIN_CONFIRM` | **not enabled** |
| on-chain revoke tx | **not sent** |

---

## Revoke Owner Decision

Revoke owner was intentionally **NOT executed**.

**Reason:**  
The token is prepared as fixed-supply because minting is closed, but admin/owner rights are preserved until a separate explicit decision by Yan.

**Current state:**

- `mintable = false`
- `total_supply` is final (100,000,000 TLR)
- admin/owner is still Yan's deploy wallet
- metadata/admin are **not** immutable yet
- revoke owner requires a separate future command:

  ```text
  revoke owner TALLER подтверждаю
  ```

**No revoke transaction was sent.**

---

## Gas / refund safety (executed steps)

| Step | Value | Refund/excess | Result |
|------|-------|---------------|--------|
| Deploy | 0.15 TON | not applicable | Surplus on master (~0.15 TON storage); no wrong-address trap |
| Mint | 1.1 TON | admin wallet | Excess returned to deploy wallet ✅ |
| Close minting | 0.05 TON | cashback(sender) → admin | ~0.0497 TON returned ✅ |
| Revoke | — | not executed | — |

---

## What was NOT done

```text
❌ revoke owner (ChangeOwner(null))
❌ TALLER_REVOKE_ADMIN_CONFIRM not enabled
❌ mainnet post-revoke emulate (master still has admin)
❌ repeat deploy
❌ repeat mint
❌ repeat close minting
❌ metadata change
❌ owner/admin change
```

---

## Testnet reference (Phase B — completed earlier)

| Field | Value |
|-------|-------|
| Testnet master | `EQDwmUChf504bGC9cxOL_7IW6VKmoyLiSJF-ov2wJsNWqgPH` |
| Testnet supply | 1,000,000 TLR (proof) |
| Testnet revoke | executed (admin=null) |

Testnet proved lifecycle mechanics; mainnet stopped before irreversible revoke per Yan decision.

---

## Env / secrets

- All secrets in `taller_token/.env.local` only — **never committed**
- `TALLER_MAINNET_JETTON_MASTER` set locally after deploy
- Confirm flags used for deploy/mint/close; revoke confirm **left commented/disabled**

---

## Next possible step

**Revoke owner** — only by separate explicit decision from Yan:

1. Enable `TALLER_REVOKE_ADMIN_CONFIRM=YES_REVOKE_OWNER` in `.env.local`
2. Yan phrase: `revoke owner TALLER подтверждаю`
3. `npm run revoke-owner:mainnet`
4. `npm run emulate:after-owner-null:mainnet` (post-revoke checks)

Until then: **admin/owner preserved** on deploy wallet.

---

## Related files

| Path | Purpose |
|------|---------|
| `taller_token/` | TALLER jetton module |
| `taller_token/.env.example` | Env template |
| `reports/TALLER_TLR_DEPLOY_PREPARATION_REPORT_2026-06-08.md` | Pre-deploy preparation |
| `C:\Projects\DEPLOY_MASTER_GUIDE\TON_JETTON_TESTNET_MAINNET_DEPLOY_MASTER_GUIDE.md` | Deploy master guide (incl. refund safety audit) |
