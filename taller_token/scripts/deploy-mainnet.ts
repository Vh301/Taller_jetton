import { beginCell, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { JettonUpdateContent, storeJettonUpdateContent } from "../output/TallerJetton_JettonMinter";
import { ExtendedJettonMinter } from "../wrappers/ExtendedJettonMinter";
import { buildOffChainMetadataCell } from "../lib/metadata";
import { preflightTallerMetadata } from "../lib/metadata-preflight";
import { TALLER_ADMIN_ADDRESS_MAINNET } from "../lib/config";
import { assertSameAddress } from "../lib/address-guard";
import {
  MAINNET_NETWORK_GLOBAL_ID,
  MAINNET_TONAPI,
  TALLER_MAINNET_MINT_AMOUNT,
  TALLER_METADATA_URL,
  assertMainnetConfirm,
  assertMainnetNetworkOnly,
  isPrepareOnly,
  loadMainnetDeployMnemonic,
  printMainnetPrepareSummary,
  resolveMainnetToncenterRpc,
} from "../lib/mainnet-config";
import { TALLER_HOLDER_ADDRESS_MAINNET } from "../lib/config";
import { printRefundSafetyReport } from "../lib/refund-safety";
import {
  buildSignedExternalBoc,
  createMainnetWallet,
  fetchWalletNeedsInit,
  fetchWalletSeqno,
  internal,
  sendExternalBoc,
} from "../lib/wallet-external";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForActiveAccount(addressRaw: string, label: string): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    await delay(5000);
    process.stdout.write(".");

    const checkResponse = await fetch(`${MAINNET_TONAPI}/v2/accounts/${addressRaw}`);
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

  console.log("Deploy TALLER / TLR Tact Jetton master — TON MAINNET\n");
  console.log("WARNING: real mainnet. No transaction without confirm flag.\n");

  assertMainnetNetworkOnly();
  await preflightTallerMetadata();

  const cleanMnemonic = loadMainnetDeployMnemonic();
  console.log("Mainnet mnemonic loaded from taller_token/.env.local");

  const keyPair = await mnemonicToPrivateKey(cleanMnemonic.split(" "));
  const wallet = createMainnetWallet(keyPair);
  const walletAddress = wallet.address;
  assertSameAddress(
    walletAddress.toString(),
    TALLER_ADMIN_ADDRESS_MAINNET,
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
  console.log("  Planned mainnet mint after deploy:", `${TALLER_MAINNET_MINT_AMOUNT.toLocaleString()} TLR`);
  console.log("  Mint/Close/Revoke: NOT running in this script");
  printMainnetPrepareSummary(walletAddress.toString(), 0n);

  console.log("\nAdd after deploy to taller_token/.env.local:");
  console.log(`TALLER_MAINNET_JETTON_MASTER=${masterAddress.toString()}`);

  printRefundSafetyReport({
    step: "deploy mainnet",
    network: "mainnet",
    networkGlobalId: MAINNET_NETWORK_GLOBAL_ID,
    master: masterAddress.toString(),
    adminDeployWallet: walletAddress.toString(),
    holderWallet: TALLER_HOLDER_ADDRESS_MAINNET,
    messageValue: "0.15 TON",
    responseDestination: "not applicable (JettonUpdateContent deploy init)",
    excessDestination: "not applicable (no JettonExcesses on deploy)",
    refundExcessDestinationSafe: true,
    riskTonStuckInMaster:
      "low-medium: unused deploy TON may remain on master balance (~minTonsForStorage 0.01 TON+); reclaim via ClaimTON if needed",
    willSendTx: !prepareOnly,
    notes: "First tx may include wallet init; surplus stays on master contract, not lost to wrong address",
  });

  if (prepareOnly) {
    console.log("\n--prepare-only: no transaction sent.");
    console.log("networkGlobalId check:", MAINNET_NETWORK_GLOBAL_ID === -239 ? "OK" : "MISMATCH");
    return;
  }

  assertMainnetConfirm();

  const needsInit = await fetchWalletNeedsInit(MAINNET_TONAPI, walletAddress);
  const seqno = await fetchWalletSeqno(MAINNET_TONAPI, walletAddress);
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

  console.log("\nSending deploy transaction via TonAPI MAINNET...");
  const sent = await sendExternalBoc(MAINNET_TONAPI, resolveMainnetToncenterRpc(), boc);
  if (!sent) {
    throw new Error("Failed to send deploy transaction.");
  }

  console.log("Transaction sent. Waiting for master activation (up to 60s)...");
  const active = await waitForActiveAccount(masterAddress.toRawString(), "Jetton master");

  if (!active) {
    console.log("\nDeploy not confirmed yet.");
    console.log("Tonviewer:", `https://tonviewer.com/${masterAddress.toString()}`);
    return;
  }

  console.log("\n=== Mainnet deploy result ===");
  console.log("Master address:", masterAddress.toString());
  console.log("Admin/owner:", walletAddress.toString());
  console.log("Tonviewer:", `https://tonviewer.com/${masterAddress.toString()}`);
  console.log("\nNext step (after Yan OK): npm run mint:mainnet");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
