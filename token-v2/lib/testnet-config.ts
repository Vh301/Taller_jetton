import * as dotenv from "dotenv";
import {
  TALLER_ADMIN_ADDRESS_TESTNET,
  TALLER_HOLDER_ADDRESS_TESTNET,
  TALLER_METADATA_URL,
  TALLER_TEST_MINT_AMOUNT,
  TALLER_TOKEN_NAME,
  TALLER_TOKEN_SYMBOL,
  tallerAmountToNano,
} from "./config";

dotenv.config({ path: ".env.local" });

export {
  TALLER_METADATA_URL,
  TALLER_TEST_MINT_AMOUNT,
  TALLER_ADMIN_ADDRESS_TESTNET,
  TALLER_HOLDER_ADDRESS_TESTNET,
  TALLER_TOKEN_NAME,
  TALLER_TOKEN_SYMBOL,
  tallerAmountToNano,
};

export const TESTNET_NETWORK_GLOBAL_ID = -3;
export const TESTNET_TONAPI = "https://testnet.tonapi.io";
export const TESTNET_TONCENTER_RPC =
  "https://testnet.toncenter.com/api/v2/jsonRPC";

export function loadTestnetDeployMnemonic(): string {
  const mnemonic = process.env.TALLER_TESTNET_DEPLOY_MNEMONIC?.trim();

  if (!mnemonic) {
    throw new Error(
      "TALLER_TESTNET_DEPLOY_MNEMONIC not set in token-v2/.env.local",
    );
  }

  return mnemonic.replace(/"/g, "").trim();
}

export function loadTestnetJettonMaster(): string {
  const master = process.env.TALLER_TESTNET_JETTON_MASTER?.trim();
  if (!master) {
    throw new Error("TALLER_TESTNET_JETTON_MASTER not set in token-v2/.env.local");
  }
  return master;
}

export function isPrepareOnly(argv: string[] = process.argv): boolean {
  return argv.includes("--prepare-only");
}

export function assertTestnetConfirm(): void {
  if (process.env.TALLER_TESTNET_CONFIRM !== "YES_I_UNDERSTAND") {
    throw new Error(
      "Set TALLER_TESTNET_CONFIRM=YES_I_UNDERSTAND in token-v2/.env.local to send testnet transactions.",
    );
  }
}

export function assertTestnetNetworkOnly(): void {
  console.log("Network guard: TESTNET endpoints only (testnet.tonapi.io, globalId -3)");
}

export function printTestnetPrepareSummary(walletAddress: string, supplyHuman: bigint): void {
  const supplyNano = tallerAmountToNano(supplyHuman);
  console.log("\n--- prepare-only summary ---");
  console.log("  Network: testnet");
  console.log("  networkGlobalId:", TESTNET_NETWORK_GLOBAL_ID);
  console.log("  TonAPI base:", TESTNET_TONAPI);
  console.log("  Admin / owner wallet:", walletAddress);
  console.log("  Holder wallet:", TALLER_HOLDER_ADDRESS_TESTNET);
  console.log("  Metadata URL:", TALLER_METADATA_URL);
  console.log("  Token name:", TALLER_TOKEN_NAME);
  console.log("  Symbol:", TALLER_TOKEN_SYMBOL);
  console.log("  Decimals: 9");
  console.log("  Supply human:", supplyHuman.toLocaleString(), TALLER_TOKEN_SYMBOL);
  console.log("  Supply smallest units:", supplyNano.toString());
}
