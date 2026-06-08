import { beginCell, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { JettonUpdateContent, storeJettonUpdateContent } from "../output/TallerJetton_JettonMinter";
import { ExtendedJettonMinter } from "../wrappers/ExtendedJettonMinter";
import { buildOffChainMetadataCell } from "../lib/metadata";
import { preflightTallerMetadata } from "../lib/metadata-preflight";
import { assertSameAddress } from "../lib/address-guard";
import {
  TESTNET_NETWORK_GLOBAL_ID,
  TESTNET_TONAPI,
  TESTNET_TONCENTER_RPC,
  TALLER_ADMIN_ADDRESS_TESTNET,
  TALLER_METADATA_URL,
  assertTestnetConfirm,
  assertTestnetNetworkOnly,
  isPrepareOnly,
  loadTestnetDeployMnemonic,
  printTestnetPrepareSummary,
} from "../lib/testnet-config";
import {
  buildSignedExternalBoc,
  createTestnetWallet,
  fetchWalletNeedsInit,
  fetchWalletSeqno,
  internal,
  sendExternalBoc,
} from "../lib/wallet-external";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string): Promise<Response> {
  return fetch(url);
}

async function waitForActiveAccount(addressRaw: string, label: string): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    await delay(5000);
    process.stdout.write(".");

    const checkResponse = await fetchJson(`${TESTNET_TONAPI}/v2/accounts/${addressRaw}`);
    if (!checkResponse.ok) {
      continue;
    }

    const checkData = await checkResponse.json();
    if (checkData.status === "active") {
      console.log(`\n${label} is active on-chain.`);
      return true;
    }
  }

  return false;
}

async function main() {
  const prepareOnly = isPrepareOnly();

  console.log("Deploy TALLER / TLR Tact Jetton master — TON TESTNET ONLY\n");

  assertTestnetNetworkOnly();
  await preflightTallerMetadata();

  const cleanMnemonic = loadTestnetDeployMnemonic();
  console.log(
    "Testnet mnemonic loaded (first 3 words):",
    cleanMnemonic.split(" ").slice(0, 3).join(" ") + "...",
  );

  const keyPair = await mnemonicToPrivateKey(cleanMnemonic.split(" "));
  const wallet = createTestnetWallet(keyPair);
  const walletAddress = wallet.address;
  assertSameAddress(
    walletAddress.toString(),
    TALLER_ADMIN_ADDRESS_TESTNET,
    "Admin / owner wallet",
  );
  const contentCell = buildOffChainMetadataCell(TALLER_METADATA_URL);

  const jettonMinter = await ExtendedJettonMinter.fromInit(
    0n,
    walletAddress,
    contentCell,
  );

  if (!jettonMinter.init) {
    throw new Error("JettonMinter init is not defined");
  }

  const masterAddress = jettonMinter.address;

  console.log("\nPrepared deployment:");
  console.log("  Jetton master (predicted):", masterAddress.toString());
  console.log("  Expected initial mintable: true");
  console.log("  Expected initial total_supply: 0");
  console.log("  Planned testnet mint after deploy: 1,000,000 TLR");
  console.log("  Mainnet: NOT touched");
  printTestnetPrepareSummary(walletAddress.toString(), 0n);

  console.log("\nAdd after deploy to token-v2/.env.local:");
  console.log(`TALLER_TESTNET_JETTON_MASTER=${masterAddress.toString()}`);

  if (prepareOnly) {
    console.log("\n--prepare-only: no transaction sent.");
    console.log("networkGlobalId check:", TESTNET_NETWORK_GLOBAL_ID === -3 ? "OK" : "MISMATCH");
    return;
  }

  assertTestnetConfirm();

  console.log("\nGetting wallet seqno...");
  const needsInit = await fetchWalletNeedsInit(TESTNET_TONAPI, walletAddress);
  const seqno = await fetchWalletSeqno(TESTNET_TONAPI, walletAddress);
  console.log("Current seqno:", seqno, needsInit ? "(wallet needs init)" : "");

  const deployBody: JettonUpdateContent = {
    $$type: "JettonUpdateContent",
    queryId: 0n,
    content: contentCell,
  };

  const deployMessage = internal({
    to: masterAddress,
    value: toNano("0.15"),
    init: {
      code: jettonMinter.init.code,
      data: jettonMinter.init.data,
    },
    body: beginCell().store(storeJettonUpdateContent(deployBody)).endCell(),
  });

  const boc = buildSignedExternalBoc(
    wallet,
    walletAddress,
    keyPair,
    seqno,
    [deployMessage],
    needsInit,
  );

  console.log("\nSending deploy transaction via TonAPI testnet...");
  const sent = await sendExternalBoc(TESTNET_TONAPI, TESTNET_TONCENTER_RPC, boc);
  if (!sent) {
    throw new Error("Failed to send deploy transaction.");
  }

  console.log("Transaction sent. Waiting for master activation (up to 60s)...");
  const active = await waitForActiveAccount(masterAddress.toRawString(), "Jetton master");

  if (!active) {
    console.log("\nDeploy not confirmed yet.");
    console.log("Tonviewer:", `https://testnet.tonviewer.com/${masterAddress.toString()}`);
    return;
  }

  const jettonInfoResponse = await fetch(
    `${TESTNET_TONAPI}/v2/jettons/${masterAddress.toRawString()}`,
  );
  let mintable: boolean | string = "unknown";
  let totalSupply = "unknown";
  if (jettonInfoResponse.ok) {
    const jettonInfo = await jettonInfoResponse.json();
    mintable = jettonInfo.mintable;
    totalSupply = jettonInfo.total_supply ?? "0";
  }

  const eventsResponse = await fetch(
    `${TESTNET_TONAPI}/v2/accounts/${walletAddress.toRawString()}/events?limit=5`,
  );
  let deployTxHash: string | undefined;
  if (eventsResponse.ok) {
    const events = await eventsResponse.json();
    deployTxHash = events.events?.[0]?.event_id;
  }

  console.log("\n=== Step 1 deploy result ===");
  console.log("Master address:", masterAddress.toString());
  console.log("Admin/owner:", walletAddress.toString());
  console.log("Tonviewer master:", `https://testnet.tonviewer.com/${masterAddress.toString()}`);
  if (deployTxHash) {
    console.log("Deploy tx:", deployTxHash);
    console.log("Tonviewer tx:", `https://testnet.tonviewer.com/transaction/${deployTxHash}`);
  }
  console.log("TonAPI mintable:", mintable);
  console.log("TonAPI total_supply:", totalSupply);
  console.log("metadata URL:", TALLER_METADATA_URL);
  console.log("Mainnet touched: NO");
  console.log("\nAdd to token-v2/.env.local:");
  console.log(`TALLER_TESTNET_JETTON_MASTER=${masterAddress.toString()}`);
  console.log("\nNext step (after Yan OK): npm run mint:testnet");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
