# TALLER / TLR — Tact Fixed-Supply Jetton

Isolated module for **TALLER / TLR** jetton on Tact base jetton (`tact-lang/jetton`).

| Phase | Status |
|-------|--------|
| **Phase A** — sandbox compile + fixed-supply tests | ✅ passed |
| **Phase B** — testnet deploy proof | ✅ completed |
| **Mainnet** — deploy + mint + close | ✅ completed |
| **Mainnet** — revoke owner | ⏸ **NOT executed** (admin preserved; Yan decision pending) |

**Mainnet master:** `EQBbbUvr84qdfAAWUL8ZjRvO3FzEDKsLEFMiKlXg7d9u17Rq`  
**Supply:** 100,000,000 TLR · **Mintable:** false · **Admin:** Yan deploy wallet (not revoked)

Final report: [`reports/TALLER_TLR_MAINNET_FINAL_LIFECYCLE_REPORT_2026-06-08.md`](../reports/TALLER_TLR_MAINNET_FINAL_LIFECYCLE_REPORT_2026-06-08.md)

> Revoke owner was prepared via `--prepare-only` but **not executed**. Admin/owner stays on deploy wallet until Yan sends a separate `revoke owner TALLER подтверждаю` command.

Deploy master guide: `TON_JETTON_TESTNET_MAINNET_DEPLOY_MASTER_GUIDE.md`

## Token parameters

| Field | Value |
|-------|-------|
| Name | TALLER |
| Symbol | TLR |
| Decimals | 9 |
| Mainnet supply | 100,000,000 TLR |
| Testnet proof mint | 1,000,000 TLR |

**Metadata (tag-pinned):**

```text
https://raw.githubusercontent.com/Vh301/Taller_jetton/taller-mainnet-metadata/public/metadata/taller-jetton-metadata.json
https://raw.githubusercontent.com/Vh301/Taller_jetton/taller-mainnet-metadata/public/jetton_image/taller_jetton_image.png
```

Tag: `taller-mainnet-metadata` — **do not delete or rewrite**.

## Commands

```bash
cd taller_token
npm install
npm run build
npm test
npm run typecheck
```

Testnet (gated by `TALLER_TESTNET_CONFIRM`):

```bash
npm run deploy:testnet -- --prepare-only
npm run deploy:testnet
npm run mint:testnet -- --prepare-only
npm run mint:testnet
npm run close-minting:testnet -- --prepare-only
npm run close-minting:testnet
npm run revoke-owner:testnet -- --prepare-only
npm run revoke-owner:testnet
```

Mainnet (separate confirm flags per step — see `.env.example`):

```bash
npm run deploy:mainnet -- --prepare-only      # TALLER_MAINNET_CONFIRM
npm run mint:mainnet -- --prepare-only        # TALLER_MAINNET_MINT_CONFIRM
npm run close-minting:mainnet -- --prepare-only  # TALLER_CLOSE_MINTING_CONFIRM
npm run revoke-owner:mainnet -- --prepare-only   # TALLER_REVOKE_ADMIN_CONFIRM (not executed yet)
npm run emulate:after-owner-null:mainnet    # after revoke only
```

**Revoke owner:** prepare-only passed; real revoke **intentionally not run** — admin preserved.

All env lives in **`taller_token/.env.local` only**. See [`.env.example`](.env.example).

## Fixed-supply sequence

```text
1. Deploy master (mintable=true)
2. Mint supply
3. CloseMinting (mintable=false)
4. ChangeOwner(null) (admin=null)
5. Post-revoke checks
```

Never commit `.env.local`, mnemonics, or private keys.
