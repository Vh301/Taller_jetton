import { Address, beginCell, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { storeCloseMinting } from "../output/TallerJetton_JettonMinter";
import {
  TALLER_ADMIN_ADDRESS_TESTNET,
  TALLER_JETTON_IMAGE_URL,
  TALLER_TEST_MINT_AMOUNT,
  tallerAmountToNano,
} from "../lib/config";
import { assertSameAddress } from "../lib/address-guard";
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

async function waitForMintableFalse(masterRaw: string): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    await delay(5000);
    process.stdout.write(".");

    const info = await fetchJettonInfo(
      Address.parseRaw(masterRaw).toString({ bounceable: true }),
    );
    if (info.mintable === false) {
      console.log("\nTonAPI mintable=false confirmed.");
      return true;
    }
  }

  return false;
}

async function main() {
  const prepareOnly = isPrepareOnly();

  console.log("CloseMinting TALLER / TLR — TON TESTNET ONLY\n");

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

  console.log("Preflight before CloseMinting...");
  const preInfo = await fetchJettonInfo(jettonMaster);
  const preGet = await fetchGetJettonData(masterRaw);
  const preBalance = await fetchHolderBalance(walletRaw, masterRaw);

  console.log("  Network: testnet");
  console.log("  Symbol:", preInfo.metadata?.symbol ?? "unknown");
  console.log("  Total supply:", preInfo.total_supply ?? "unknown");
  console.log("  Recipient balance (nano):", preBalance.toString());
  console.log("  Mintable (TonAPI):", preInfo.mintable);
  console.log("  get_jetton_data mintable raw:", rawMintableFromStack(preGet.stack));
  console.log("  Admin:", preInfo.admin?.address ?? "unknown");
  console.log("  Owner wallet:", walletAddress.toString());

  if (preInfo.mintable !== true) {
    throw new Error("Preflight failed: mintable is not true — already closed?");
  }
  if (preInfo.total_supply !== EXPECTED_SUPPLY_NANO.toString()) {
    throw new Error(`Preflight failed: unexpected total_supply ${preInfo.total_supply}`);
  }
  if (preBalance !== EXPECTED_SUPPLY_NANO) {
    throw new Error(`Preflight failed: unexpected holder balance ${preBalance}`);
  }

  console.log("\nChangeOwner(null): NOT running");
  console.log("Mainnet: NOT touched");

  if (prepareOnly) {
    console.log("\n--prepare-only: no transaction sent.");
    return;
  }

  assertTestnetConfirm();

  const closeMessage = internal({
    to: masterAddress,
    value: toNano("0.05"),
    body: beginCell().store(storeCloseMinting({ $$type: "CloseMinting" })).endCell(),
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
    [closeMessage],
    needsInit,
  );

  console.log("\nSending CloseMinting transaction...");
  const sent = await sendExternalBoc(TESTNET_TONAPI, TESTNET_TONCENTER_RPC, boc);
  if (!sent) {
    throw new Error("Failed to send CloseMinting transaction.");
  }

  console.log("Transaction sent. Waiting for mintable=false (up to 60s)...");
  const closed = await waitForMintableFalse(masterRaw);

  const eventsResponse = await fetch(
    `${TESTNET_TONAPI}/v2/accounts/${walletRaw}/events?limit=3`,
  );
  let closeTxHash: string | undefined;
  if (eventsResponse.ok) {
    const events = await eventsResponse.json();
    closeTxHash = events.events?.[0]?.event_id;
  }

  const postInfo = await fetchJettonInfo(jettonMaster);
  const postGet = await fetchGetJettonData(masterRaw);
  const postBalance = await fetchHolderBalance(walletRaw, masterRaw);
  const rawMintable = rawMintableFromStack(postGet.stack);

  let tonviewerMintable = "unknown";
  try {
    const tonviewerResponse = await fetch(
      `https://testnet.tonviewer.com/${jettonMaster}`,
      { headers: { "User-Agent": "TallerJetton/1.0" } },
    );
    const html = await tonviewerResponse.text();
    if (/Mintable:\s*false/i.test(html)) {
      tonviewerMintable = "false";
    } else if (/Mintable:\s*true/i.test(html)) {
      tonviewerMintable = "true";
    }
  } catch {
    tonviewerMintable = "fetch failed — check manually";
  }

  console.log("\n=== Step 3 CloseMinting result ===");
  console.log("CloseMinting status:", closed ? "CONFIRMED" : "SENT — verify manually");
  if (closeTxHash) {
    console.log("Close tx:", closeTxHash);
    console.log("Tonviewer tx:", `https://testnet.tonviewer.com/transaction/${closeTxHash}`);
  }
  console.log("get_jetton_data mintable raw:", rawMintable);
  console.log("get_jetton_data mintable decoded:", postGet.decoded?.mintable);
  console.log("TonAPI mintable:", postInfo.mintable);
  console.log("Tonviewer Mintable:", tonviewerMintable);
  console.log("Total supply:", postInfo.total_supply);
  console.log("Holder balance (nano):", postBalance.toString());
  console.log("Admin (TonAPI):", postInfo.admin?.address ?? "unknown");
  console.log("Expected admin:", TALLER_ADMIN_ADDRESS_TESTNET);
  console.log("Metadata name:", postInfo.metadata?.name);
  console.log("Metadata symbol:", postInfo.metadata?.symbol);
  console.log("Metadata image:", postInfo.metadata?.image);
  console.log(
    "Master Tonviewer:",
    `https://testnet.tonviewer.com/${jettonMaster}`,
  );
  console.log("ChangeOwner(null) run: NO");
  console.log("Mainnet touched: NO");

  if (!isMintableFalseRaw(rawMintable) || postInfo.mintable !== false) {
    process.exitCode = 1;
    console.error("\nERROR: mintable is not false after CloseMinting");
  }
  if (postInfo.metadata?.image !== EXPECTED_IMAGE) {
    console.warn("WARNING: metadata image changed");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
