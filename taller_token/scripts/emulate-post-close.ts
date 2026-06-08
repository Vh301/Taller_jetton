import { Address, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { tallerAmountToNano } from "../lib/config";
import {
  buildMintInternalMessageBoc,
  findRejectedMintTrace,
  MINT_IS_CLOSED_EXIT_CODE,
  traceHasSuccessfulMint,
  type TraceNode,
} from "../lib/emulate";
import {
  TESTNET_TONAPI,
  assertTestnetNetworkOnly,
  loadTestnetDeployMnemonic,
  loadTestnetJettonMaster,
} from "../lib/testnet-config";
import {
  fetchGetJettonData,
  fetchHolderBalance,
  fetchJettonInfo,
  isMintableFalseRaw,
  rawMintableFromStack,
} from "../lib/tonapi-jetton";
import { createTestnetWallet, fetchWalletSeqno } from "../lib/wallet-external";

const EXPECTED_SUPPLY_NANO = tallerAmountToNano(1_000_000n);
/** Small test mint for emulation only — no on-chain send. */
const EMULATE_MINT_TLR = 1n;

async function emulateTrace(bocBase64: string): Promise<TraceNode> {
  const response = await fetch(
    `${TESTNET_TONAPI}/v2/traces/emulate?ignore_signature_check=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boc: bocBase64 }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Trace emulate failed: HTTP ${response.status} ${text}`);
  }

  return response.json();
}

async function main() {
  console.log("Step 4 — emulate mint after CloseMinting (NO on-chain tx)\n");

  assertTestnetNetworkOnly();

  const jettonMaster = loadTestnetJettonMaster();
  const masterAddress = Address.parse(jettonMaster);
  const masterRaw = masterAddress.toRawString();

  const cleanMnemonic = loadTestnetDeployMnemonic();
  const keyPair = await mnemonicToPrivateKey(cleanMnemonic.split(" "));
  const wallet = createTestnetWallet(keyPair);
  const walletAddress = wallet.address;
  const walletRaw = walletAddress.toRawString();

  const mintAmountNano = tallerAmountToNano(EMULATE_MINT_TLR);

  console.log("Preflight state...");
  const preInfo = await fetchJettonInfo(jettonMaster);
  const preGet = await fetchGetJettonData(masterRaw);
  const preBalance = await fetchHolderBalance(walletRaw, masterRaw);
  const seqnoBefore = await fetchWalletSeqno(TESTNET_TONAPI, walletAddress);

  if (preInfo.mintable !== false) {
    throw new Error(`Preflight failed: mintable is ${preInfo.mintable}, expected false`);
  }
  if (!isMintableFalseRaw(rawMintableFromStack(preGet.stack))) {
    throw new Error("Preflight failed: get_jetton_data mintable is not false");
  }

  console.log("  mintable (TonAPI):", preInfo.mintable);
  console.log("  get_jetton_data mintable raw:", rawMintableFromStack(preGet.stack));
  console.log("  total_supply:", preInfo.total_supply);
  console.log("  holder balance (nano):", preBalance.toString());
  console.log("  wallet seqno before:", seqnoBefore);

  const boc = buildMintInternalMessageBoc({
    from: walletAddress,
    to: masterAddress,
    mintAmountNano,
  });

  console.log("\nEmulating mint via TonAPI /v2/traces/emulate ...");
  console.log("  sender (owner/admin):", walletAddress.toString());
  console.log("  destination (master):", jettonMaster);
  console.log(`  emulate mint amount: ${EMULATE_MINT_TLR} TLR (${mintAmountNano} nano)`);

  const trace = await emulateTrace(boc);
  const rejection = findRejectedMintTrace(trace, masterRaw);
  const accepted = traceHasSuccessfulMint(trace, masterRaw);

  const postInfo = await fetchJettonInfo(jettonMaster);
  const postBalance = await fetchHolderBalance(walletRaw, masterRaw);
  const seqnoAfter = await fetchWalletSeqno(TESTNET_TONAPI, walletAddress);

  const rejected =
    rejection !== null &&
    !accepted &&
    (rejection.exitCode === MINT_IS_CLOSED_EXIT_CODE || rejection.aborted);

  console.log("\n=== Step 4 emulation result ===");
  console.log("Emulation status:", rejected ? "REJECTED (expected)" : accepted ? "ACCEPTED (unexpected!)" : "INCONCLUSIVE");
  console.log("Sender:", walletAddress.toString());
  console.log("Emulated mint amount:", `${EMULATE_MINT_TLR} TLR`);
  console.log("Result:", rejected ? "rejected" : accepted ? "accepted" : "inconclusive");
  console.log("Exit code:", rejection?.exitCode ?? "n/a");
  console.log("Exit description:", rejection?.exitDescription ?? "n/a");
  console.log("Expected exit code:", MINT_IS_CLOSED_EXIT_CODE, "(Mint is closed)");
  console.log("Total supply after emulation:", postInfo.total_supply);
  console.log("Holder balance after emulation (nano):", postBalance.toString());
  console.log("Wallet seqno before/after:", seqnoBefore, "/", seqnoAfter);
  console.log("Real on-chain transaction sent: NO");
  console.log("Step 5 ChangeOwner(null) ready:", rejected ? "YES (after Yan OK)" : "NO — fix emulation first");

  if (!rejected) {
    console.error("\nERROR: mint emulation was not clearly rejected");
    process.exit(1);
  }
  if (postInfo.total_supply !== EXPECTED_SUPPLY_NANO.toString()) {
    console.error("\nERROR: total_supply changed without on-chain tx (unexpected)");
    process.exit(1);
  }
  if (postBalance !== preBalance) {
    console.error("\nERROR: holder balance changed");
    process.exit(1);
  }
  if (seqnoAfter !== seqnoBefore) {
    console.error("\nERROR: wallet seqno changed — possible real tx?");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
