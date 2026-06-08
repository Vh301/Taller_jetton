import { Address, beginCell, Cell } from "@ton/core";

/** TEP-64 off-chain metadata URI cell (0x01 prefix + snake URI). */
export function buildOffChainMetadataCell(uri: string): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return a.hash().equals(b.hash());
}
