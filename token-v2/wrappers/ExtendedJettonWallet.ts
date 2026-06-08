// SPDX-License-Identifier: MIT
// Adapted from tact-lang/jetton ExtendedJettonWallet (base variant)

import { JettonWallet } from "../output/TallerJetton_JettonWallet";
import { Address, Cell, ContractProvider } from "@ton/core";

export class ExtendedJettonWallet extends JettonWallet {
  constructor(address: Address, init?: { code: Cell; data: Cell }) {
    super(address, init);
  }

  static async fromInit(owner: Address, minter: Address, balance: bigint) {
    const base = await JettonWallet.fromInit(owner, minter, balance);
    if (base.init === undefined) {
      throw new Error("JettonWallet init is not defined");
    }
    return new ExtendedJettonWallet(base.address, { code: base.init.code, data: base.init.data });
  }

  getJettonBalance = async (provider: ContractProvider): Promise<bigint> => {
    const state = await provider.getState();
    if (state.state.type !== "active") {
      return 0n;
    }
    return (await this.getGetWalletData(provider)).balance;
  };
}
