# TALLER / TLR Jetton

TON fixed-supply jetton **TALLER (TLR)** — deploy tooling and pinned metadata.

| Field | Value |
|-------|-------|
| Symbol | TLR |
| Decimals | 9 |
| Mainnet supply | 100,000,000 TLR |
| Testnet proof mint | 1,000,000 TLR |

## Repository layout

```text
public/metadata/          — on-chain metadata JSON
public/jetton_image/      — jetton icon (pinned via git tag)
token-v2/                 — Tact jetton module + deploy scripts
reports/                  — lifecycle reports
```

## Metadata tag

```text
taller-mainnet-metadata
```

Do not delete or rewrite this tag after mainnet deploy.

## Quick start

```bash
cd token-v2
cp .env.example .env.local   # fill mnemonic locally, never commit
npm install
npm run build
npm run typecheck
```

See [`token-v2/README.md`](token-v2/README.md) for full deploy sequence.
