import { Address } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { buildOffChainMetadataCell } from "../lib/metadata";
import {
  TALLER_JETTON_IMAGE_URL,
  TALLER_MAINNET_MINT_AMOUNT,
  TALLER_METADATA_URL,
  tallerAmountToNano,
} from "../lib/config";
import {
  analyzeMasterInboundTrace,
  buildChangeOwnerInternalMessageBoc,
  buildCloseMintingInternalMessageBoc,
  buildMintInternalMessageBoc,
  buildUpdateContentInternalMessageBoc,
  INCORRECT_SENDER_EXIT_CODE,
  MINT_IS_CLOSED_EXIT_CODE,
  type EmulateResult,
  type TraceNode,
} from "../lib/emulate";
import {
  MAINNET_NETWORK_GLOBAL_ID,
  MAINNET_TONAPI,
  assertMainnetNetworkOnly,
  loadMainnetDeployMnemonic,
  loadMainnetJettonMaster,
} from "../lib/mainnet-config";
import {
  fetchGetJettonData,
  fetchHolderBalance,
  fetchJettonInfo,
  isAdminRevokedTonApi,
  isMintableFalseRaw,
  rawMintableFromStack,
} from "../lib/tonapi-jetton";
import { createMainnetWallet, fetchWalletSeqno } from "../lib/wallet-external";

const EXPECTED_IMAGE = TALLER_JETTON_IMAGE_URL;
const EXPECTED_SUPPLY_NANO = tallerAmountToNano(TALLER_MAINNET_MINT_AMOUNT);
const EMULATE_MINT_TLR = 1n;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await sleep(750 * (i + 1));
      }
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${String(lastError)}`);
}

async function emulateTrace(bocBase64: string): Promise<TraceNode> {
  const response = await fetch(
    `${MAINNET_TONAPI}/v2/traces/emulate?ignore_signature_check=true`,
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

function printEmulationResult(name: string, result: EmulateResult): boolean {
  const ok = result.rejected && !result.accepted;
  console.log(`\n--- ${name} ---`);
  console.log("Status:", ok ? "REJECTED (expected)" : result.accepted ? "ACCEPTED (unexpected!)" : "INCONCLUSIVE");
  console.log("Exit code:", result.exitCode ?? "n/a");
  console.log("Exit description:", result.exitDescription ?? "n/a");
  return ok;
}

async function main() {
  console.log("Mainnet post-revoke emulate after owner null (NO on-chain tx)\n");

  assertMainnetNetworkOnly();
  console.log("  Network: mainnet");
  console.log("  networkGlobalId:", MAINNET_NETWORK_GLOBAL_ID);
  console.log("  TonAPI base:", MAINNET_TONAPI);

  const jettonMaster = loadMainnetJettonMaster();
  const masterAddress = Address.parse(jettonMaster);
  const masterRaw = masterAddress.toRawString();

  const cleanMnemonic = loadMainnetDeployMnemonic();
  const keyPair = await mnemonicToPrivateKey(cleanMnemonic.split(" "));
  const wallet = createMainnetWallet(keyPair);
  const walletAddress = wallet.address;
  const walletRaw = walletAddress.toRawString();

  console.log("  Jetton master:", jettonMaster);
  console.log("  Metadata URL:", TALLER_METADATA_URL);

  console.log("\nPreflight state...");
  const preInfo = await fetchJettonInfo(jettonMaster, MAINNET_TONAPI);
  const preGet = await fetchGetJettonData(masterRaw, MAINNET_TONAPI);
  const preBalance = await fetchHolderBalance(walletRaw, masterRaw, MAINNET_TONAPI);
  const seqnoBefore = await fetchWalletSeqno(MAINNET_TONAPI, walletAddress);

  if (preInfo.mintable !== false) {
    throw new Error(`Preflight failed: mintable=${preInfo.mintable}`);
  }
  if (!isMintableFalseRaw(rawMintableFromStack(preGet.stack))) {
    throw new Error("Preflight failed: get_jetton_data mintable not false");
  }
  if (!isAdminRevokedTonApi(preInfo, preGet)) {
    throw new Error("Preflight failed: admin is not revoked");
  }

  console.log("  sender (former owner):", walletAddress.toString());
  console.log("  mintable:", preInfo.mintable, "| raw:", rawMintableFromStack(preGet.stack));
  console.log("  admin revoked:", isAdminRevokedTonApi(preInfo, preGet));
  console.log("  total_supply:", preInfo.total_supply);
  console.log("  expected supply (nano):", EXPECTED_SUPPLY_NANO.toString());
  console.log("  holder balance:", preBalance.toString());
  console.log("  wallet seqno:", seqnoBefore);

  const evilContent = buildOffChainMetadataCell("https://example.com/evil-metadata.json");
  const contentBefore = preGet.decoded?.jetton_content;

  const cases: Array<{ name: string; boc: string; expectedExit?: number }> = [
    {
      name: "JettonUpdateContent",
      boc: buildUpdateContentInternalMessageBoc({
        from: walletAddress,
        to: masterAddress,
        content: evilContent,
      }),
      expectedExit: INCORRECT_SENDER_EXIT_CODE,
    },
    {
      name: "ChangeOwner",
      boc: buildChangeOwnerInternalMessageBoc({
        from: walletAddress,
        to: masterAddress,
        newOwner: walletAddress,
      }),
      expectedExit: INCORRECT_SENDER_EXIT_CODE,
    },
    {
      name: "CloseMinting",
      boc: buildCloseMintingInternalMessageBoc({
        from: walletAddress,
        to: masterAddress,
      }),
      expectedExit: INCORRECT_SENDER_EXIT_CODE,
    },
    {
      name: "Mint",
      boc: buildMintInternalMessageBoc({
        from: walletAddress,
        to: masterAddress,
        mintAmountNano: tallerAmountToNano(EMULATE_MINT_TLR),
      }),
      expectedExit: INCORRECT_SENDER_EXIT_CODE,
    },
  ];

  const results: Record<string, EmulateResult> = {};
  let allRejected = true;

  for (const testCase of cases) {
    const trace = await emulateTrace(testCase.boc);
    const result = analyzeMasterInboundTrace(trace, masterRaw);
    results[testCase.name] = result;
    const ok = printEmulationResult(testCase.name, result);
    if (!ok) {
      allRejected = false;
    }
    if (testCase.expectedExit !== undefined && result.exitCode !== testCase.expectedExit) {
      const mintClosedOk =
        testCase.name === "Mint" && result.exitCode === MINT_IS_CLOSED_EXIT_CODE;
      if (!mintClosedOk) {
        console.log(`Expected exit ${testCase.expectedExit}, got ${result.exitCode ?? "n/a"}`);
        allRejected = false;
      } else {
        console.log(`Exit ${result.exitCode} (Mint is closed) — rejected as expected`);
      }
    }
  }

  await sleep(1000);

  const postInfo = await withRetry("fetchJettonInfo", () =>
    fetchJettonInfo(jettonMaster, MAINNET_TONAPI),
  );
  const postGet = await withRetry("fetchGetJettonData", () =>
    fetchGetJettonData(masterRaw, MAINNET_TONAPI),
  );
  const postBalance = await withRetry("fetchHolderBalance", async () => {
    const balance = await fetchHolderBalance(walletRaw, masterRaw, MAINNET_TONAPI);
    if (balance === 0n) {
      throw new Error("holder balance returned 0 — likely TonAPI rate limit");
    }
    return balance;
  });
  const seqnoAfter = await withRetry("fetchWalletSeqno", async () => {
    const seqno = await fetchWalletSeqno(MAINNET_TONAPI, walletAddress);
    if (seqno === 0) {
      throw new Error("wallet seqno returned 0 — likely TonAPI rate limit");
    }
    return seqno;
  });

  console.log("\n=== Mainnet post-revoke final state ===");
  console.log("mintable (TonAPI):", postInfo.mintable);
  console.log("mintable raw:", rawMintableFromStack(postGet.stack));
  console.log("admin (TonAPI):", postInfo.admin?.address ?? "null / empty");
  console.log("admin revoked:", isAdminRevokedTonApi(postInfo, postGet));
  console.log("total_supply:", postInfo.total_supply);
  console.log("holder balance:", postBalance.toString());
  console.log("metadata name:", postInfo.metadata?.name);
  console.log("metadata symbol:", postInfo.metadata?.symbol);
  console.log("metadata image:", postInfo.metadata?.image);
  console.log("jetton_content unchanged:", postGet.decoded?.jetton_content === contentBefore);
  console.log("wallet seqno before/after:", seqnoBefore, "/", seqnoAfter);
  console.log("Real on-chain transaction sent: NO");

  const stateOk =
    postInfo.mintable === false &&
    isMintableFalseRaw(rawMintableFromStack(postGet.stack)) &&
    isAdminRevokedTonApi(postInfo, postGet) &&
    postInfo.total_supply === EXPECTED_SUPPLY_NANO.toString() &&
    postBalance === EXPECTED_SUPPLY_NANO &&
    postInfo.metadata?.name === "TALLER" &&
    postInfo.metadata?.symbol === "TLR" &&
    postInfo.metadata?.image === EXPECTED_IMAGE &&
    postGet.decoded?.jetton_content === contentBefore &&
    seqnoAfter === seqnoBefore;

  const passed = allRejected && stateOk;

  console.log("\n=== Mainnet post-revoke emulate verdict ===");
  console.log(passed ? "PASSED" : "NOT PASSED");

  if (!passed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
