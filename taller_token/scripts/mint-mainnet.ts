import { Address, beginCell, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { Mint, storeMint } from "../output/TallerJetton_JettonMinter";
import {
  TALLER_ADMIN_ADDRESS_MAINNET,
  TALLER_HOLDER_ADDRESS_MAINNET,
  TALLER_MAINNET_MINT_AMOUNT,
  tallerAmountToNano,
} from "../lib/config";
import { assertSameAddress } from "../lib/address-guard";
import {
  MAINNET_NETWORK_GLOBAL_ID,
  MAINNET_TONAPI,
  assertMainnetConfirm,
  assertMainnetNetworkOnly,
  isPrepareOnly,
  loadMainnetDeployMnemonic,
  loadMainnetJettonMaster,
  printMainnetPrepareSummary,
  resolveMainnetToncenterRpc,
} from "../lib/mainnet-config";
import {
  fetchGetJettonData,
  fetchHolderBalance,
  fetchJettonInfo,
  rawMintableFromStack,
} from "../lib/tonapi-jetton";
import { assertSafeMintResponseDestination } from "../lib/mint-safety";
import {
  buildSignedExternalBoc,
  createMainnetWallet,
  fetchWalletNeedsInit,
  fetchWalletSeqno,
  internal,
  sendExternalBoc,
} from "../lib/wallet-external";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForBalance(
  walletRaw: string,
  masterRaw: string,
  expectedNano: bigint,
): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    await delay(5000);
    process.stdout.write(".");

    const response = await fetch(
      `${MAINNET_TONAPI}/v2/accounts/${walletRaw}/jettons/${masterRaw}`,
    );
    if (!response.ok) {
      continue;
    }

    const data = await response.json();
    if (data.balance && BigInt(data.balance) >= expectedNano) {
      console.log("\nMint balance confirmed on-chain.");
      return true;
    }
  }

  return false;
}

async function main() {
  const prepareOnly = isPrepareOnly();

  console.log("Mint TALLER / TLR mainnet supply — TON MAINNET\n");
  console.log("WARNING: real mainnet. No transaction without confirm flag.\n");

  assertMainnetNetworkOnly();

  const jettonMaster = loadMainnetJettonMaster();
  const cleanMnemonic = loadMainnetDeployMnemonic();
  const keyPair = await mnemonicToPrivateKey(cleanMnemonic.split(" "));
  const wallet = createMainnetWallet(keyPair);
  const walletAddress = wallet.address;
  assertSameAddress(
    walletAddress.toString(),
    TALLER_ADMIN_ADDRESS_MAINNET,
    "Admin / owner wallet",
  );
  assertSameAddress(
    walletAddress.toString(),
    TALLER_HOLDER_ADDRESS_MAINNET,
    "Holder wallet",
  );

  const masterAddress = Address.parse(jettonMaster);
  const masterRaw = masterAddress.toRawString();
  const mintAmountNano = tallerAmountToNano(TALLER_MAINNET_MINT_AMOUNT);

  if (TALLER_MAINNET_MINT_AMOUNT !== 100_000_000n) {
    throw new Error(`Unexpected mint amount constant: ${TALLER_MAINNET_MINT_AMOUNT}`);
  }

  const preInfo = await fetchJettonInfo(jettonMaster, MAINNET_TONAPI);
  const preGet = await fetchGetJettonData(masterRaw, MAINNET_TONAPI);
  const rawMintable = rawMintableFromStack(preGet.stack);

  console.log("  Jetton master:", jettonMaster);
  console.log("  Current total_supply:", preInfo.total_supply ?? "unknown");
  console.log("  Current mintable (TonAPI):", preInfo.mintable);
  console.log("  get_jetton_data mintable raw:", rawMintable);
  console.log("  CloseMinting: NOT running");
  console.log("  ChangeOwner(null): NOT running");
  printMainnetPrepareSummary(walletAddress.toString(), TALLER_MAINNET_MINT_AMOUNT);

  if (preInfo.total_supply !== "0") {
    throw new Error(`Preflight failed: total_supply is ${preInfo.total_supply}, expected 0`);
  }
  if (preInfo.mintable !== true) {
    throw new Error(`Preflight failed: mintable is ${preInfo.mintable}, expected true`);
  }
  if (rawMintable !== "-0x1" && rawMintable !== "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") {
    throw new Error(`Preflight failed: get_jetton_data mintable raw is ${rawMintable}, expected true (-0x1)`);
  }

  if (prepareOnly) {
    console.log("\n--prepare-only: no transaction sent.");
    return;
  }

  assertMainnetConfirm();

  // IMPORTANT: excess TON must return to deploy/admin wallet, not to jetton master.
  // Sending JettonExcesses to master caused exit 130 and trapped excess TON in previous mint.
  const responseDestination = walletAddress;
  assertSafeMintResponseDestination(responseDestination, masterAddress);

  const mintBody: Mint = {
    $$type: "Mint",
    queryId: 0n,
    receiver: walletAddress,
    mintMessage: {
      $$type: "JettonTransferInternal",
      queryId: 0n,
      amount: mintAmountNano,
      sender: masterAddress,
      responseDestination,
      forwardTonAmount: toNano("0.05"),
      forwardPayload: beginCell().storeUint(0, 1).endCell().asSlice(),
    },
  };

  const mintMessage = internal({
    to: masterAddress,
    value: toNano("1.1"),
    body: beginCell().store(storeMint(mintBody)).endCell(),
  });

  const needsInit = await fetchWalletNeedsInit(MAINNET_TONAPI, walletAddress);
  const seqno = await fetchWalletSeqno(MAINNET_TONAPI, walletAddress);

  const boc = buildSignedExternalBoc(
    wallet,
    walletAddress,
    keyPair,
    seqno,
    [mintMessage],
    needsInit,
  );

  console.log("\nSending mint transaction via TonAPI MAINNET...");
  const sent = await sendExternalBoc(MAINNET_TONAPI, resolveMainnetToncenterRpc(), boc);
  if (!sent) {
    throw new Error("Failed to send mint transaction.");
  }

  console.log("Mint transaction sent. Waiting for balance update (up to 60s)...");
  const confirmed = await waitForBalance(
    walletAddress.toRawString(),
    masterAddress.toRawString(),
    mintAmountNano,
  );

  const postInfo = await fetchJettonInfo(jettonMaster, MAINNET_TONAPI);
  const postGet = await fetchGetJettonData(masterRaw, MAINNET_TONAPI);
  const postBalance = await fetchHolderBalance(
    walletAddress.toRawString(),
    masterRaw,
    MAINNET_TONAPI,
  );

  const eventsResponse = await fetch(
    `${MAINNET_TONAPI}/v2/accounts/${walletAddress.toRawString()}/events?limit=3`,
  );
  let mintTxHash: string | undefined;
  if (eventsResponse.ok) {
    const events = await eventsResponse.json();
    mintTxHash = events.events?.[0]?.event_id;
  }

  console.log("\n=== Mainnet mint result ===");
  console.log("Mint status:", confirmed ? "CONFIRMED" : "SENT — verify manually");
  if (mintTxHash) {
    console.log("Mint tx:", mintTxHash);
    console.log("Tonviewer tx:", `https://tonviewer.com/transaction/${mintTxHash}`);
  }
  console.log("Recipient:", walletAddress.toString());
  console.log("Minted:", `${TALLER_MAINNET_MINT_AMOUNT.toLocaleString()} TLR`);
  console.log("Minted (nano):", mintAmountNano.toString());
  console.log("Total supply:", postInfo.total_supply);
  console.log("Mintable:", postInfo.mintable);
  console.log("Admin:", postInfo.admin?.address ?? "unknown");
  console.log("Holder balance (nano):", postBalance.toString());
  console.log("Metadata symbol:", postInfo.metadata?.symbol);
  console.log("Next step (after Yan OK): npm run close-minting:mainnet");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
