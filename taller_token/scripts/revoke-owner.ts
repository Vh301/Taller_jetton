import { Address, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import {
  TALLER_ADMIN_ADDRESS_TESTNET,
  TALLER_JETTON_IMAGE_URL,
  TALLER_TEST_MINT_AMOUNT,
  tallerAmountToNano,
} from "../lib/config";
import { assertSameAddress } from "../lib/address-guard";
import { buildChangeOwnerNullBody } from "../lib/jetton-data";
import {
  TESTNET_TONAPI,
  TESTNET_TONCENTER_RPC,
  assertTestnetConfirm,
  assertTestnetNetworkOnly,
  isPrepareOnly,
  loadTestnetDeployMnemonic,
  loadTestnetJettonMaster,
} from "../lib/testnet-config";
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
  createTestnetWallet,
  fetchWalletNeedsInit,
  fetchWalletSeqno,
  internal,
  sendExternalBoc,
} from "../lib/wallet-external";

const EXPECTED_IMAGE = TALLER_JETTON_IMAGE_URL;
const EXPECTED_SUPPLY_NANO = tallerAmountToNano(TALLER_TEST_MINT_AMOUNT);

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForAdminRevoked(masterRaw: string, masterBounceable: string): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    await delay(5000);
    process.stdout.write(".");

    const info = await fetchJettonInfo(masterBounceable);
    const getData = await fetchGetJettonData(masterRaw);
    if (isAdminRevokedTonApi(info, getData)) {
      console.log("\nAdmin revoke confirmed on-chain.");
      return true;
    }
  }

  return false;
}

async function main() {
  const prepareOnly = isPrepareOnly();

  console.log("ChangeOwner(null) TALLER / TLR — TON TESTNET ONLY\n");

  assertTestnetNetworkOnly();

  const jettonMaster = loadTestnetJettonMaster();
  const masterAddress = Address.parse(jettonMaster);
  const masterRaw = masterAddress.toRawString();

  const cleanMnemonic = loadTestnetDeployMnemonic();
  const keyPair = await mnemonicToPrivateKey(cleanMnemonic.split(" "));
  const wallet = createTestnetWallet(keyPair);
  const walletAddress = wallet.address;
  assertSameAddress(
    walletAddress.toString(),
    TALLER_ADMIN_ADDRESS_TESTNET,
    "Admin / owner wallet",
  );
  const walletRaw = walletAddress.toRawString();

  console.log("Preflight before ChangeOwner(null)...");
  const preInfo = await fetchJettonInfo(jettonMaster);
  const preGet = await fetchGetJettonData(masterRaw);
  const preBalance = await fetchHolderBalance(walletRaw, masterRaw);

  console.log("  mintable (TonAPI):", preInfo.mintable);
  console.log("  get_jetton_data mintable raw:", rawMintableFromStack(preGet.stack));
  console.log("  total_supply:", preInfo.total_supply);
  console.log("  holder balance (nano):", preBalance.toString());
  console.log("  admin (TonAPI):", preInfo.admin?.address ?? "null");
  console.log("  owner wallet:", walletAddress.toString());

  if (preInfo.mintable !== false) {
    throw new Error("Preflight failed: mintable must be false before owner revoke");
  }
  if (!isMintableFalseRaw(rawMintableFromStack(preGet.stack))) {
    throw new Error("Preflight failed: get_jetton_data mintable is not false");
  }
  if (
    !preInfo.admin?.address ||
    !Address.parse(preInfo.admin.address).equals(walletAddress)
  ) {
    throw new Error("Preflight failed: admin is not deploy wallet");
  }

  console.log("\nMainnet: NOT touched");

  if (prepareOnly) {
    console.log("\n--prepare-only: no transaction sent.");
    return;
  }

  assertTestnetConfirm();

  const revokeMessage = internal({
    to: masterAddress,
    value: toNano("0.05"),
    body: buildChangeOwnerNullBody(),
  });

  console.log("\nGetting wallet seqno...");
  const needsInit = await fetchWalletNeedsInit(TESTNET_TONAPI, walletAddress);
  const seqno = await fetchWalletSeqno(TESTNET_TONAPI, walletAddress);
  console.log("Current seqno:", seqno);

  const boc = buildSignedExternalBoc(
    wallet,
    walletAddress,
    keyPair,
    seqno,
    [revokeMessage],
    needsInit,
  );

  console.log("\nSending ChangeOwner(null) transaction...");
  const sent = await sendExternalBoc(TESTNET_TONAPI, TESTNET_TONCENTER_RPC, boc);
  if (!sent) {
    throw new Error("Failed to send ChangeOwner(null) transaction.");
  }

  console.log("Transaction sent. Waiting for admin revoke (up to 60s)...");
  const revoked = await waitForAdminRevoked(masterRaw, jettonMaster);

  const eventsResponse = await fetch(
    `${TESTNET_TONAPI}/v2/accounts/${walletRaw}/events?limit=3`,
  );
  let revokeTxHash: string | undefined;
  if (eventsResponse.ok) {
    const events = await eventsResponse.json();
    revokeTxHash = events.events?.[0]?.event_id;
  }

  const postInfo = await fetchJettonInfo(jettonMaster);
  const postGet = await fetchGetJettonData(masterRaw);
  const postBalance = await fetchHolderBalance(walletRaw, masterRaw);

  console.log("\n=== Step 5 ChangeOwner(null) result ===");
  console.log("Revoke status:", revoked ? "CONFIRMED" : "SENT — verify manually");
  if (revokeTxHash) {
    console.log("Revoke tx:", revokeTxHash);
    console.log("Tonviewer tx:", `https://testnet.tonviewer.com/transaction/${revokeTxHash}`);
  }
  console.log("Final admin (TonAPI):", postInfo.admin?.address ?? "null / empty");
  console.log("Final admin (get_jetton_data decoded):", postGet.decoded?.admin_address ?? "null / empty");
  console.log("Admin revoked:", isAdminRevokedTonApi(postInfo, postGet));
  console.log("Final mintable (TonAPI):", postInfo.mintable);
  console.log("Final mintable raw:", rawMintableFromStack(postGet.stack));
  console.log("Final total_supply:", postInfo.total_supply);
  console.log("Final holder balance (nano):", postBalance.toString());
  console.log("Metadata name:", postInfo.metadata?.name);
  console.log("Metadata symbol:", postInfo.metadata?.symbol);
  console.log("Metadata image:", postInfo.metadata?.image);
  console.log(
    "Master Tonviewer:",
    `https://testnet.tonviewer.com/${jettonMaster}`,
  );
  console.log("Mainnet touched: NO");
  console.log("Step 6 emulation ready:", revoked ? "YES (after Yan OK)" : "NO");

  if (!revoked) {
    process.exitCode = 1;
    console.error("\nERROR: admin revoke not confirmed");
  }
  if (postInfo.mintable !== false) {
    process.exitCode = 1;
    console.error("\nERROR: mintable changed from false");
  }
  if (postInfo.total_supply !== EXPECTED_SUPPLY_NANO.toString()) {
    process.exitCode = 1;
    console.error("\nERROR: total_supply changed");
  }
  if (postBalance !== EXPECTED_SUPPLY_NANO) {
    process.exitCode = 1;
    console.error("\nERROR: holder balance changed");
  }
  if (postInfo.metadata?.image !== EXPECTED_IMAGE) {
    console.warn("WARNING: metadata image mismatch");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
