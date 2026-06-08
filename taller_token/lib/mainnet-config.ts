import * as dotenv from "dotenv";
import {
  TALLER_ADMIN_ADDRESS_MAINNET,
  TALLER_HOLDER_ADDRESS_MAINNET,
  TALLER_JETTON_IMAGE_URL,
  TALLER_MAINNET_MINT_AMOUNT,
  TALLER_METADATA_URL,
  TALLER_TOKEN_NAME,
  TALLER_TOKEN_SYMBOL,
  tallerAmountToNano,
} from "./config";

dotenv.config({ path: ".env.local" });

export {
  TALLER_METADATA_URL,
  TALLER_JETTON_IMAGE_URL,
  TALLER_MAINNET_MINT_AMOUNT,
  TALLER_ADMIN_ADDRESS_MAINNET,
  TALLER_HOLDER_ADDRESS_MAINNET,
  TALLER_TOKEN_NAME,
  TALLER_TOKEN_SYMBOL,
  tallerAmountToNano,
};

export const MAINNET_NETWORK_GLOBAL_ID = -239;
export const MAINNET_TONAPI = "https://tonapi.io";
export const MAINNET_TONCENTER_RPC = "https://toncenter.com/api/v2/jsonRPC";

export const MAINNET_CONFIRM_VALUE = "YES_I_UNDERSTAND";
export const MAINNET_MINT_CONFIRM_VALUE = "YES_MINT_TALLER";
export const REVOKE_CONFIRM_VALUE = "YES_REVOKE_OWNER";
export const CLOSE_MINTING_CONFIRM_VALUE = "YES_CLOSE_MINTING";

export function isPrepareOnly(argv: string[] = process.argv): boolean {
  return argv.includes("--prepare-only");
}

export function loadMainnetDeployMnemonic(): string {
  const mnemonic = process.env.TALLER_MAINNET_DEPLOY_MNEMONIC?.trim();

  if (!mnemonic) {
    throw new Error(
      "TALLER_MAINNET_DEPLOY_MNEMONIC not set in taller_token/.env.local",
    );
  }

  return mnemonic.replace(/"/g, "").trim();
}

export function loadMainnetJettonMaster(): string {
  const master = process.env.TALLER_MAINNET_JETTON_MASTER?.trim();

  if (!master) {
    throw new Error(
      "TALLER_MAINNET_JETTON_MASTER not set in taller_token/.env.local",
    );
  }

  return master;
}

export function assertMainnetConfirm(): void {
  const confirm = process.env.TALLER_MAINNET_CONFIRM?.trim();

  if (confirm !== MAINNET_CONFIRM_VALUE) {
    throw new Error(
      `Mainnet action blocked. Set TALLER_MAINNET_CONFIRM=${MAINNET_CONFIRM_VALUE} in taller_token/.env.local`,
    );
  }
}

export function assertMainnetMintConfirm(): void {
  const mintConfirm = process.env.TALLER_MAINNET_MINT_CONFIRM?.trim();

  if (mintConfirm !== MAINNET_MINT_CONFIRM_VALUE) {
    throw new Error(
      `Mainnet mint blocked. Set TALLER_MAINNET_MINT_CONFIRM=${MAINNET_MINT_CONFIRM_VALUE} in taller_token/.env.local`,
    );
  }
}

export function assertCloseMintingConfirm(): void {
  const closeConfirm = process.env.TALLER_CLOSE_MINTING_CONFIRM?.trim();

  if (closeConfirm !== CLOSE_MINTING_CONFIRM_VALUE) {
    throw new Error(
      `Close minting blocked. Set TALLER_CLOSE_MINTING_CONFIRM=${CLOSE_MINTING_CONFIRM_VALUE} in taller_token/.env.local`,
    );
  }
}

export function assertRevokeConfirm(): void {
  const revokeConfirm = process.env.TALLER_REVOKE_ADMIN_CONFIRM?.trim();

  if (revokeConfirm !== REVOKE_CONFIRM_VALUE) {
    throw new Error(
      `Revoke blocked. Set TALLER_REVOKE_ADMIN_CONFIRM=${REVOKE_CONFIRM_VALUE} in taller_token/.env.local`,
    );
  }
}

export function assertMainnetNetworkOnly(): void {
  console.log("Network guard: MAINNET endpoints only (tonapi.io, globalId -239)");
}

export function resolveMainnetToncenterRpc(): string {
  return process.env.TONCENTER_MAINNET_API_KEY
    ? `${MAINNET_TONCENTER_RPC}?api_key=${process.env.TONCENTER_MAINNET_API_KEY}`
    : MAINNET_TONCENTER_RPC;
}

export function printMainnetPrepareSummary(walletAddress: string, supplyHuman: bigint): void {
  const supplyNano = tallerAmountToNano(supplyHuman);
  console.log("\n--- prepare-only summary ---");
  console.log("  Network: mainnet");
  console.log("  networkGlobalId:", MAINNET_NETWORK_GLOBAL_ID);
  console.log("  TonAPI base:", MAINNET_TONAPI);
  console.log("  Admin / owner wallet:", walletAddress);
  console.log("  Holder wallet:", TALLER_HOLDER_ADDRESS_MAINNET);
  console.log("  Metadata URL:", TALLER_METADATA_URL);
  console.log("  Token name:", TALLER_TOKEN_NAME);
  console.log("  Symbol:", TALLER_TOKEN_SYMBOL);
  console.log("  Decimals: 9");
  console.log("  Supply human:", supplyHuman.toLocaleString(), TALLER_TOKEN_SYMBOL);
  console.log("  Supply smallest units:", supplyNano.toString());
}
