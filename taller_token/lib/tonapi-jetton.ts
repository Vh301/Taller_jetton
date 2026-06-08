import { Address } from "@ton/core";
import { TESTNET_TONAPI } from "./testnet-config";

export type TonApiGetJettonData = {
  success: boolean;
  stack: Array<{ type: string; num?: string; cell?: string }>;
  decoded?: {
    total_supply?: string;
    mintable?: boolean;
    admin_address?: string;
    jetton_content?: string;
  };
};

export type TonApiJettonInfo = {
  mintable?: boolean;
  total_supply?: string;
  admin?: { address?: string };
  metadata?: {
    name?: string;
    symbol?: string;
    decimals?: string;
    image?: string;
  };
};

export async function fetchGetJettonData(
  masterRaw: string,
  tonapiBase: string = TESTNET_TONAPI,
): Promise<TonApiGetJettonData> {
  const response = await fetch(
    `${tonapiBase}/v2/blockchain/accounts/${masterRaw}/methods/get_jetton_data`,
  );
  if (!response.ok) {
    throw new Error(`get_jetton_data failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchJettonInfo(
  master: string,
  tonapiBase: string = TESTNET_TONAPI,
): Promise<TonApiJettonInfo> {
  const masterRaw = Address.parse(master).toRawString();
  const response = await fetch(`${tonapiBase}/v2/jettons/${masterRaw}`);
  if (!response.ok) {
    throw new Error(`jettons info failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchHolderBalance(
  walletRaw: string,
  masterRaw: string,
  tonapiBase: string = TESTNET_TONAPI,
): Promise<bigint> {
  const response = await fetch(
    `${tonapiBase}/v2/accounts/${walletRaw}/jettons/${masterRaw}`,
  );
  if (!response.ok) {
    return 0n;
  }
  const data = await response.json();
  return data.balance ? BigInt(data.balance) : 0n;
}

/** stack[1] mintable raw num from get_jetton_data (TEP-74 bool as int). */
export function rawMintableFromStack(stack: TonApiGetJettonData["stack"]): string | undefined {
  return stack[1]?.num;
}

export function isMintableFalseRaw(rawMintable: string | undefined): boolean {
  if (!rawMintable) {
    return false;
  }
  return rawMintable === "0x0" || rawMintable === "0" || rawMintable === "-0x0";
}

/** Admin revoked when TonAPI omits admin or get_jetton_data has no admin_address. */
export function isAdminRevokedTonApi(
  jettonInfo: TonApiJettonInfo,
  getData: TonApiGetJettonData,
): boolean {
  const noJettonAdmin = !jettonInfo.admin?.address;
  const noDecodedAdmin = !getData.decoded?.admin_address;
  return noJettonAdmin && noDecodedAdmin;
}
