// SPDX-License-Identifier: MIT
// Adapted from tact-lang/jetton ExtendedJettonMinter (base variant)

import {
  ChangeOwner,
  CloseMinting,
  JettonMinter,
  JettonUpdateContent,
  Mint,
} from "../output/TallerJetton_JettonMinter";
import { Address, beginCell, Cell, ContractProvider, Sender, toNano } from "@ton/core";
import { buildChangeOwnerNullBody } from "../lib/jetton-data";
import { assertSafeMintResponseDestination } from "../lib/mint-safety";

export class ExtendedJettonMinter extends JettonMinter {
  constructor(address: Address, init?: { code: Cell; data: Cell }) {
    super(address, init);
  }

  static async fromInit(totalSupply: bigint, owner: Address, jettonContent: Cell) {
    const base = await JettonMinter.fromInit(totalSupply, owner, jettonContent, true);
    if (base.init === undefined) {
      throw new Error("JettonMinter init is not defined");
    }
    return new ExtendedJettonMinter(base.address, { code: base.init.code, data: base.init.data });
  }

  async getTotalSupply(provider: ContractProvider): Promise<bigint> {
    const res = await this.getGetJettonData(provider);
    return res.totalSupply;
  }

  async getAdminAddress(provider: ContractProvider): Promise<Address> {
    const res = await this.getGetJettonData(provider);
    return res.adminAddress;
  }

  async getContent(provider: ContractProvider): Promise<Cell> {
    const res = await this.getGetJettonData(provider);
    return res.jettonContent;
  }

  async sendMint(
    provider: ContractProvider,
    via: Sender,
    to: Address,
    jettonAmount: bigint,
    forwardTonAmount: bigint,
    totalTonAmount: bigint,
    excessDestination: Address,
  ): Promise<void> {
    if (totalTonAmount <= forwardTonAmount) {
      throw new Error("Total TON amount should be greater than the forward amount");
    }
    // IMPORTANT: excess TON must return to deploy/admin wallet, not to jetton master.
    // Sending JettonExcesses to master caused exit 130 and trapped excess TON in previous mint.
    assertSafeMintResponseDestination(excessDestination, this.address);

    const msg: Mint = {
      $$type: "Mint",
      queryId: 0n,
      receiver: to,
      mintMessage: {
        $$type: "JettonTransferInternal",
        queryId: 0n,
        amount: jettonAmount,
        sender: this.address,
        responseDestination: excessDestination,
        forwardTonAmount: forwardTonAmount,
        forwardPayload: beginCell().storeUint(0, 1).asSlice(),
      },
    };
    await this.send(provider, via, { value: totalTonAmount + toNano("0.015") }, msg);
  }

  async sendCloseMinting(provider: ContractProvider, via: Sender): Promise<void> {
    const msg: CloseMinting = { $$type: "CloseMinting" };
    await this.send(provider, via, { value: toNano("0.05") }, msg);
  }

  async sendChangeOwner(
    provider: ContractProvider,
    via: Sender,
    newOwner: Address,
  ): Promise<void> {
    const msg: ChangeOwner = {
      $$type: "ChangeOwner",
      queryId: 0n,
      newOwner,
    };
    await this.send(provider, via, { value: toNano("0.05") }, msg);
  }

  async sendChangeContent(provider: ContractProvider, via: Sender, content: Cell): Promise<void> {
    const msg: JettonUpdateContent = {
      $$type: "JettonUpdateContent",
      queryId: 0n,
      content,
    };
    await this.send(provider, via, { value: toNano("0.05") }, msg);
  }

  /** ChangeOwner → addr_none (TEP-74 admin revoke). */
  async sendRevokeOwner(provider: ContractProvider, via: Sender) {
    return via.send({
      to: this.address,
      value: toNano("0.05"),
      bounce: true,
      body: buildChangeOwnerNullBody(),
    });
  }
}
