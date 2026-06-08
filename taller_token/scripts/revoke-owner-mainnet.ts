import { Address, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { TALLER_ADMIN_ADDRESS_MAINNET, TALLER_JETTON_IMAGE_URL } from "../lib/config";
import { assertSameAddress } from "../lib/address-guard";
import { buildChangeOwnerNullBody } from "../lib/jetton-data";
import { printRefundSafetyReport } from "../lib/refund-safety";
import {
  MAINNET_NETWORK_GLOBAL_ID,
  MAINNET_TONAPI,
  assertMainnetNetworkOnly,
  assertRevokeConfirm,
  isPrepareOnly,
  loadMainnetDeployMnemonic,
  loadMainnetJettonMaster,
  resolveMainnetToncenterRpc,
} from "../lib/mainnet-config";
import {
  fetchGetJettonData,
  fetchHolderBalance,
  fetchJettonInfo,
  isAdminRevokedTonApi,
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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForAdminRevoked(masterRaw: string, masterBounceable: string): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    await delay(5000);
    process.stdout.write(".");

    const info = await fetchJettonInfo(masterBounceable, MAINNET_TONAPI);
    const getData = await fetchGetJettonData(masterRaw, MAINNET_TONAPI);
    if (isAdminRevokedTonApi(info, getData)) {
      console.log("\nAdmin revoke confirmed on-chain.");
      return true;
    }
  }

  return false;
}

async function main() {
  const prepareOnly = isPrepareOnly();

  console.log("ChangeOwner(null) TALLER / TLR — TON MAINNET\n");
  console.log("WARNING: real mainnet. Revoke requires separate confirm flag.\n");

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

  console.log("  mintable (TonAPI):", preInfo.mintable);
  console.log("  get_jetton_data mintable raw:", rawMintableFromStack(preGet.stack));
  console.log("  total_supply:", preInfo.total_supply);
  console.log("  holder balance (nano):", preBalance.toString());
  console.log("  admin (TonAPI):", preInfo.admin?.address ?? "null");

  assertSameAddress(
    walletAddress.toString(),
    TALLER_ADMIN_ADDRESS_MAINNET,
    "Admin / owner wallet",
  );

  if (
    !preInfo.admin?.address ||
    !Address.parse(preInfo.admin.address).equals(walletAddress)
  ) {
    throw new Error("Preflight failed: admin is not deploy wallet");
  }

  if (!prepareOnly) {
    if (preInfo.mintable !== false) {
      throw new Error("Preflight failed: mintable must be false before owner revoke");
    }
    if (!isMintableFalseRaw(rawMintableFromStack(preGet.stack))) {
      throw new Error("Preflight failed: get_jetton_data mintable is not false");
    }
  }

  printRefundSafetyReport({
    step: "revoke-owner mainnet",
    network: "mainnet",
    networkGlobalId: MAINNET_NETWORK_GLOBAL_ID,
    master: jettonMaster,
    adminDeployWallet: walletAddress.toString(),
    holderWallet: TALLER_ADMIN_ADDRESS_MAINNET,
    messageValue: "0.05 TON",
    responseDestination: "not applicable (ChangeOwner has no responseDestination)",
    excessDestination: "contract cashback not explicit; small surplus may remain on master",
    refundExcessDestinationSafe: true,
    riskTonStuckInMaster: "low (0.05 TON; ChangeOwner handler has no cashback)",
    willSendTx: !prepareOnly,
    notes: "Requires TALLER_REVOKE_ADMIN_CONFIRM=YES_REVOKE_OWNER",
  });

  if (prepareOnly) {
    console.log("\n--prepare-only: no transaction sent.");
    return;
  }

  assertRevokeConfirm();

  const revokeMessage = internal({
    to: masterAddress,
    value: toNano("0.05"),
    body: buildChangeOwnerNullBody(),
  });

  const needsInit = await fetchWalletNeedsInit(MAINNET_TONAPI, walletAddress);
  const seqno = await fetchWalletSeqno(MAINNET_TONAPI, walletAddress);

  const boc = buildSignedExternalBoc(
    wallet,
    walletAddress,
    keyPair,
    seqno,
    [revokeMessage],
    needsInit,
  );

  console.log("\nSending ChangeOwner(null) transaction via TonAPI MAINNET...");
  const sent = await sendExternalBoc(MAINNET_TONAPI, resolveMainnetToncenterRpc(), boc);
  if (!sent) {
    throw new Error("Failed to send ChangeOwner(null) transaction.");
  }

  console.log("Transaction sent. Waiting for admin revoke (up to 60s)...");
  const revoked = await waitForAdminRevoked(masterRaw, jettonMaster);

  const postGet = await fetchGetJettonData(masterRaw, MAINNET_TONAPI);
  const postInfo = await fetchJettonInfo(jettonMaster, MAINNET_TONAPI);

  console.log("\n=== Mainnet ChangeOwner(null) result ===");
  console.log("Revoke status:", revoked ? "CONFIRMED" : "SENT — verify manually");
  console.log("Admin revoked:", isAdminRevokedTonApi(postInfo, postGet));
  console.log("Metadata image:", postInfo.metadata?.image);
  console.log("Expected image:", TALLER_JETTON_IMAGE_URL);
  console.log("Tonviewer:", `https://tonviewer.com/${jettonMaster}`);

  if (!revoked) {
    process.exitCode = 1;
    console.error("\nERROR: admin revoke not confirmed");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
