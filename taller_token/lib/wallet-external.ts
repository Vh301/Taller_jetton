import {
  WalletContractV5R1,
  beginCell,
  external,
  internal,
  SendMode,
  storeMessage,
  type MessageRelaxed,
} from "@ton/ton";
import type { Address } from "@ton/core";
import type { KeyPair } from "@ton/crypto";

export async function fetchWalletNeedsInit(
  tonapiBase: string,
  walletAddress: Address,
): Promise<boolean> {
  const response = await fetch(
    `${tonapiBase}/v2/accounts/${walletAddress.toRawString()}`,
  );
  const data = await response.json();
  return data.status !== "active";
}

export async function fetchWalletSeqno(
  tonapiBase: string,
  walletAddress: Address,
): Promise<number> {
  const seqnoResponse = await fetch(
    `${tonapiBase}/v2/blockchain/accounts/${walletAddress.toRawString()}/methods/seqno`,
  );
  const seqnoData = await seqnoResponse.json();
  return seqnoData.decoded?.state || 0;
}

export function buildSignedExternalBoc(
  wallet: WalletContractV5R1,
  walletAddress: WalletContractV5R1["address"],
  keyPair: KeyPair,
  seqno: number,
  messages: MessageRelaxed[],
  includeWalletInit = false,
): string {
  const transfer = wallet.createTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });

  const msg = external({
    to: walletAddress,
    init: includeWalletInit && wallet.init ? wallet.init : undefined,
    body: transfer,
  });

  const cell = beginCell().store(storeMessage(msg)).endCell();
  return cell.toBoc().toString("base64");
}

export async function sendExternalBoc(
  tonapiBase: string,
  toncenterRpc: string,
  boc: string,
): Promise<boolean> {
  const sendResponse = await fetch(`${tonapiBase}/v2/blockchain/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boc }),
  });

  if (sendResponse.ok) {
    return true;
  }

  const error = await sendResponse.text();
  console.log("TonAPI send failed:", error);
  console.log("Trying toncenter...");

  const toncenterResponse = await fetch(toncenterRpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "1",
      jsonrpc: "2.0",
      method: "sendBoc",
      params: { boc },
    }),
  });

  const toncenterResult = await toncenterResponse.json();
  console.log("Toncenter response:", JSON.stringify(toncenterResult));
  return toncenterResponse.ok && !toncenterResult.error;
}

export function createTestnetWallet(keyPair: KeyPair): WalletContractV5R1 {
  return WalletContractV5R1.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
    walletId: { networkGlobalId: -3 },
  });
}

export function createMainnetWallet(keyPair: KeyPair): WalletContractV5R1 {
  return WalletContractV5R1.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
    walletId: { networkGlobalId: -239 },
  });
}

export { internal };
