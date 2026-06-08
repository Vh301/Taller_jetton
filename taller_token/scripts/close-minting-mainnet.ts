import { Address, beginCell, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { storeCloseMinting } from "../output/TallerJetton_JettonMinter";
import {
  TALLER_ADMIN_ADDRESS_MAINNET,
  TALLER_MAINNET_MINT_AMOUNT,
  TALLER_JETTON_IMAGE_URL,
  tallerAmountToNano,
} from "../lib/config";
import { printRefundSafetyReport } from "../lib/refund-safety";
import {
  MAINNET_NETWORK_GLOBAL_ID,
  MAINNET_TONAPI,
  assertCloseMintingConfirm,
  assertMainnetNetworkOnly,
  isPrepareOnly,
  loadMainnetDeployMnemonic,
  loadMainnetJettonMaster,
  resolveMainnetToncenterRpc,
} from "../lib/mainnet-config";
import {
  fetchGetJettonData,
  fetchHolderBalance,
  fetchJettonInfo,
  isMintableFalseRaw,
  rawMintableFromStack,
} from "../lib/tonapi-jetton";
import {
  buildSignedExternalBoc,
  createMainnetWallet,
  fetchWalletNeedsInit,
  fetchWalletSeqno,
  internal,
  sendExternalBoc,
} from "../lib/wallet-external";

const EXPECTED_SUPPLY_NANO = tallerAmountToNano(TALLER_MAINNET_MINT_AMOUNT);

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForMintableFalse(masterBounceable: string): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    await delay(5000);
    process.stdout.write(".");

    const info = await fetchJettonInfo(masterBounceable, MAINNET_TONAPI);
    if (info.mintable === false) {
      console.log("\nTonAPI mintable=false confirmed.");
      return true;
    }
  }

  return false;
}

async function main() {
  const prepareOnly = isPrepareOnly();

  console.log("CloseMinting TALLER / TLR — TON MAINNET\n");
  console.log("WARNING: real mainnet. No transaction without confirm flag.\n");

  assertMainnetNetworkOnly();

  const jettonMaster = loadMainnetJettonMaster();
  const masterAddress = Address.parse(jettonMaster);
  const masterRaw = masterAddress.toRawString();

  const cleanMnemonic = loadMainnetDeployMnemonic();
  const keyPair = await mnemonicToPrivateKey(cleanMnemonic.split(" "));
  const wallet = createMainnetWallet(keyPair);
  const walletAddress = wallet.address;
  const walletRaw = walletAddress.toRawString();

  console.log("  Network: MAINNET");
  console.log("  networkGlobalId:", MAINNET_NETWORK_GLOBAL_ID);
  console.log("  Owner wallet:", walletAddress.toString());
  console.log("  Jetton master:", jettonMaster);

  const preInfo = await fetchJettonInfo(jettonMaster, MAINNET_TONAPI);
  const preGet = await fetchGetJettonData(masterRaw, MAINNET_TONAPI);
  const preBalance = await fetchHolderBalance(walletRaw, masterRaw, MAINNET_TONAPI);

  console.log("  Symbol:", preInfo.metadata?.symbol ?? "unknown");
  console.log("  Total supply:", preInfo.total_supply ?? "unknown");
  console.log("  Holder balance (nano):", preBalance.toString());
  console.log("  Mintable (TonAPI):", preInfo.mintable);
  console.log("  get_jetton_data mintable raw:", rawMintableFromStack(preGet.stack));

  if (!prepareOnly) {
    if (preInfo.mintable !== true) {
      throw new Error("Preflight failed: mintable is not true — already closed?");
    }
    if (preInfo.total_supply !== EXPECTED_SUPPLY_NANO.toString()) {
      throw new Error(`Preflight failed: unexpected total_supply ${preInfo.total_supply}`);
    }
    if (preBalance !== EXPECTED_SUPPLY_NANO) {
      throw new Error(`Preflight failed: unexpected holder balance ${preBalance}`);
    }
  }

  console.log("  ChangeOwner(null): NOT running in this script");

  printRefundSafetyReport({
    step: "close-minting mainnet",
    network: "mainnet",
    networkGlobalId: MAINNET_NETWORK_GLOBAL_ID,
    master: jettonMaster,
    adminDeployWallet: walletAddress.toString(),
    holderWallet: TALLER_ADMIN_ADDRESS_MAINNET,
    messageValue: "0.05 TON",
    responseDestination: "not applicable",
    excessDestination: walletAddress.toString() + " (cashback(sender) in contract)",
    refundExcessDestinationSafe: true,
    riskTonStuckInMaster: "no (CloseMinting calls cashback to admin sender)",
    willSendTx: !prepareOnly,
    notes: "Requires TALLER_CLOSE_MINTING_CONFIRM=YES_CLOSE_MINTING",
  });

  if (prepareOnly) {
    console.log("\n--prepare-only: no transaction sent.");
    return;
  }

  assertCloseMintingConfirm();

  const closeMessage = internal({
    to: masterAddress,
    value: toNano("0.05"),
    body: beginCell().store(storeCloseMinting({ $$type: "CloseMinting" })).endCell(),
  });

  const needsInit = await fetchWalletNeedsInit(MAINNET_TONAPI, walletAddress);
  const seqno = await fetchWalletSeqno(MAINNET_TONAPI, walletAddress);

  const boc = buildSignedExternalBoc(
    wallet,
    walletAddress,
    keyPair,
    seqno,
    [closeMessage],
    needsInit,
  );

  console.log("\nSending CloseMinting transaction via TonAPI MAINNET...");
  const sent = await sendExternalBoc(MAINNET_TONAPI, resolveMainnetToncenterRpc(), boc);
  if (!sent) {
    throw new Error("Failed to send CloseMinting transaction.");
  }

  console.log("Transaction sent. Waiting for mintable=false (up to 60s)...");
  await waitForMintableFalse(jettonMaster);

  const postInfo = await fetchJettonInfo(jettonMaster, MAINNET_TONAPI);
  const postGet = await fetchGetJettonData(masterRaw, MAINNET_TONAPI);
  const rawMintable = rawMintableFromStack(postGet.stack);

  console.log("\n=== Mainnet CloseMinting result ===");
  console.log("get_jetton_data mintable raw:", rawMintable);
  console.log("TonAPI mintable:", postInfo.mintable);
  console.log("Metadata image:", postInfo.metadata?.image);
  console.log("Expected image:", TALLER_JETTON_IMAGE_URL);
  console.log("Tonviewer:", `https://tonviewer.com/${jettonMaster}`);
  console.log("Next step (after Yan OK): npm run revoke-owner:mainnet");

  if (!isMintableFalseRaw(rawMintable) || postInfo.mintable !== false) {
    process.exitCode = 1;
    console.error("\nERROR: mintable is not false after CloseMinting");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
