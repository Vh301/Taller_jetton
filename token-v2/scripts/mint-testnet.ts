import { Address, beginCell, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { Mint, storeMint } from "../output/TallerJetton_JettonMinter";
import {
  TALLER_METADATA_URL,
  TALLER_JETTON_IMAGE_URL,
  TALLER_TEST_MINT_AMOUNT,
  tallerAmountToNano,
} from "../lib/config";
import { assertSameAddress } from "../lib/address-guard";
import {
  TALLER_ADMIN_ADDRESS_TESTNET,
  TESTNET_NETWORK_GLOBAL_ID,
  TESTNET_TONAPI,
  TESTNET_TONCENTER_RPC,
  assertTestnetConfirm,
  assertTestnetNetworkOnly,
  isPrepareOnly,
  loadTestnetDeployMnemonic,
  loadTestnetJettonMaster,
  printTestnetPrepareSummary,
} from "../lib/testnet-config";
import { assertSafeMintResponseDestination } from "../lib/mint-safety";
import {
  buildSignedExternalBoc,
  createTestnetWallet,
  fetchWalletNeedsInit,
  fetchWalletSeqno,
  internal,
  sendExternalBoc,
} from "../lib/wallet-external";

const EXPECTED_IMAGE = TALLER_JETTON_IMAGE_URL;

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
      `${TESTNET_TONAPI}/v2/accounts/${walletRaw}/jettons/${masterRaw}`,
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

  console.log("Mint TALLER / TLR test supply — TON TESTNET ONLY\n");

  assertTestnetNetworkOnly();

  const jettonMaster = loadTestnetJettonMaster();
  const cleanMnemonic = loadTestnetDeployMnemonic();
  const keyPair = await mnemonicToPrivateKey(cleanMnemonic.split(" "));
  const wallet = createTestnetWallet(keyPair);
  const walletAddress = wallet.address;
  assertSameAddress(
    walletAddress.toString(),
    TALLER_ADMIN_ADDRESS_TESTNET,
    "Admin / owner wallet",
  );
  const masterAddress = Address.parse(jettonMaster);
  const mintAmountNano = tallerAmountToNano(TALLER_TEST_MINT_AMOUNT);

  console.log("Jetton master:", jettonMaster);
  console.log("CloseMinting: NOT running");
  console.log("Mainnet: NOT touched");
  printTestnetPrepareSummary(walletAddress.toString(), TALLER_TEST_MINT_AMOUNT);

  if (prepareOnly) {
    console.log("\n--prepare-only: no transaction sent.");
    console.log("networkGlobalId check:", TESTNET_NETWORK_GLOBAL_ID === -3 ? "OK" : "MISMATCH");
    return;
  }

  assertTestnetConfirm();

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

  const mintValue = toNano("1.1");
  const mintMessage = internal({
    to: masterAddress,
    value: mintValue,
    body: beginCell().store(storeMint(mintBody)).endCell(),
  });

  console.log("\nGetting wallet seqno...");
  const needsInit = await fetchWalletNeedsInit(TESTNET_TONAPI, walletAddress);
  const seqno = await fetchWalletSeqno(TESTNET_TONAPI, walletAddress);
  console.log("Current seqno:", seqno, needsInit ? "(wallet needs init)" : "");

  const boc = buildSignedExternalBoc(
    wallet,
    walletAddress,
    keyPair,
    seqno,
    [mintMessage],
    needsInit,
  );

  console.log("\nSending mint transaction via TonAPI testnet...");
  const sent = await sendExternalBoc(TESTNET_TONAPI, TESTNET_TONCENTER_RPC, boc);
  if (!sent) {
    throw new Error("Failed to send mint transaction.");
  }

  console.log("Mint transaction sent. Waiting for balance update (up to 60s)...");
  const confirmed = await waitForBalance(
    walletAddress.toRawString(),
    masterAddress.toRawString(),
    mintAmountNano,
  );

  const eventsResponse = await fetch(
    `${TESTNET_TONAPI}/v2/accounts/${walletAddress.toRawString()}/events?limit=3`,
  );
  let mintTxHash: string | undefined;
  if (eventsResponse.ok) {
    const events = await eventsResponse.json();
    mintTxHash = events.events?.[0]?.event_id;
  }

  const jettonInfoResponse = await fetch(`${TESTNET_TONAPI}/v2/jettons/${masterAddress.toRawString()}`);
  const jettonInfo = jettonInfoResponse.ok ? await jettonInfoResponse.json() : null;

  const balanceResponse = await fetch(
    `${TESTNET_TONAPI}/v2/accounts/${walletAddress.toRawString()}/jettons/${masterAddress.toRawString()}`,
  );
  const balanceData = balanceResponse.ok ? await balanceResponse.json() : null;
  const recipientBalanceNano = balanceData?.balance ? BigInt(balanceData.balance) : 0n;

  console.log("\n=== Step 2 mint result ===");
  console.log("Mint status:", confirmed ? "CONFIRMED" : "SENT — verify manually");
  if (mintTxHash) {
    console.log("Mint tx:", mintTxHash);
    console.log("Tonviewer tx:", `https://testnet.tonviewer.com/transaction/${mintTxHash}`);
  }
  console.log("Recipient wallet:", walletAddress.toString());
  console.log("Minted amount:", `${TALLER_TEST_MINT_AMOUNT.toLocaleString()} TLR`);
  console.log("Minted amount (nano):", mintAmountNano.toString());
  console.log("Total supply (TonAPI):", jettonInfo?.total_supply ?? "unknown");
  console.log("Recipient balance (nano):", recipientBalanceNano.toString());
  console.log("Mintable (TonAPI):", jettonInfo?.mintable ?? "unknown");
  console.log("Metadata name:", jettonInfo?.metadata?.name ?? "unknown");
  console.log("Metadata symbol:", jettonInfo?.metadata?.symbol ?? "unknown");
  console.log("Metadata image:", jettonInfo?.metadata?.image ?? "unknown");
  console.log(
    "Master Tonviewer:",
    `https://testnet.tonviewer.com/${masterAddress.toString()}`,
  );
  console.log("CloseMinting run: NO");
  console.log("Mainnet touched: NO");

  if (jettonInfo?.metadata?.image !== EXPECTED_IMAGE) {
    console.warn("WARNING: metadata image mismatch");
  }
  if (recipientBalanceNano !== mintAmountNano && confirmed) {
    console.warn("WARNING: recipient balance differs from mint amount");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
