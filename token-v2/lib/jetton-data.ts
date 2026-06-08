import { Address, beginCell, Cell, ContractProvider } from "@ton/core";

export type JettonDataSnapshot = {
  totalSupply: bigint;
  mintable: boolean;
  adminAddress: Address | null;
  jettonContent: Cell;
};

/** Raw get_jetton_data — adminAddress uses loadMaybeAddress (supports addr_none). */
export async function readJettonData(provider: ContractProvider): Promise<JettonDataSnapshot> {
  const result = await provider.get("get_jetton_data", []);
  const reader = result.stack;
  const totalSupply = reader.readBigNumber();
  const mintable = reader.readBoolean();
  const adminAddress = reader.readCell().beginParse().loadMaybeAddress();
  const jettonContent = reader.readCell();
  reader.readCell(); // jettonWalletCode
  return { totalSupply, mintable, adminAddress, jettonContent };
}

/** ChangeOwner { queryId: 0, newOwner: addr_none } — opcode 3. */
export function buildChangeOwnerNullBody(): Cell {
  return beginCell().storeUint(3, 32).storeUint(0, 64).storeAddress(null).endCell();
}

export function isAdminRevoked(adminAddress: Address | null): boolean {
  return adminAddress === null;
}
