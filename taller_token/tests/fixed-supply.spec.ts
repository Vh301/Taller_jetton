// SPDX-License-Identifier: MIT
// TALLER / TLR Phase A — fixed-supply sandbox proof (Tact base jetton)

import { beginCell, toNano } from "@ton/core";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import "@ton/test-utils";
import {
  JettonMinter,
  JettonUpdateContent,
  Mint,
} from "../output/TallerJetton_JettonMinter";
import { ExtendedJettonMinter } from "../wrappers/ExtendedJettonMinter";
import { ExtendedJettonWallet } from "../wrappers/ExtendedJettonWallet";
import { TALLER_METADATA_URL, TALLER_TEST_MINT_AMOUNT, tallerAmountToNano } from "../lib/config";
import {
  buildOffChainMetadataCell,
  cellsEqual,
} from "../lib/metadata";
import { isAdminRevoked, readJettonData } from "../lib/jetton-data";

describe("TALLER / TLR fixed-supply (Tact base)", () => {
  let blockchain: Blockchain;
  let jettonMinter: SandboxContract<ExtendedJettonMinter>;
  let deployer: SandboxContract<TreasuryContract>;
  let notDeployer: SandboxContract<TreasuryContract>;
  let jettonContent: ReturnType<typeof buildOffChainMetadataCell>;
  let mintAmount: bigint;

  beforeAll(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury("deployer");
    notDeployer = await blockchain.treasury("notDeployer");
    jettonContent = buildOffChainMetadataCell(TALLER_METADATA_URL);
    mintAmount = tallerAmountToNano(TALLER_TEST_MINT_AMOUNT);

    jettonMinter = blockchain.openContract(
      await ExtendedJettonMinter.fromInit(0n, deployer.address, jettonContent),
    );

    const deployMsg: JettonUpdateContent = {
      $$type: "JettonUpdateContent",
      queryId: 0n,
      content: jettonContent,
    };

    const deployResult = await jettonMinter.send(
      deployer.getSender(),
      { value: toNano("0.1") },
      deployMsg,
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: jettonMinter.address,
      deploy: true,
      success: true,
    });
  });

  it("1. deploy state — zero supply, mintable, owner, metadata", async () => {
    const data = await jettonMinter.getGetJettonData();

    expect(data.totalSupply).toBe(0n);
    expect(data.mintable).toBeTruthy();
    expect(data.adminAddress.equals(deployer.address)).toBe(true);
    expect(cellsEqual(data.jettonContent, jettonContent)).toBe(true);
  });

  it("2. mint test supply — 1,000,000 TLR to deploy wallet", async () => {
    const mintResult = await jettonMinter.sendMint(
      deployer.getSender(),
      deployer.address,
      mintAmount,
      toNano("0.05"),
      toNano("1"),
    );

    const deployerWallet = blockchain.openContract(
      new ExtendedJettonWallet(await jettonMinter.getGetWalletAddress(deployer.address)),
    );

    expect(mintResult.transactions).toHaveTransaction({
      from: jettonMinter.address,
      to: deployerWallet.address,
      deploy: true,
      success: true,
    });

    const data = await jettonMinter.getGetJettonData();
    expect(data.totalSupply).toBe(mintAmount);
    expect(data.mintable).toBeTruthy();

    const balance = await deployerWallet.getJettonBalance();
    expect(balance).toBe(mintAmount);
  });

  it("3. CloseMinting — mintable false, supply unchanged, owner retained", async () => {
    const supplyBefore = await jettonMinter.getTotalSupply();

    const closeResult = await jettonMinter.sendCloseMinting(deployer.getSender());
    expect(closeResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: jettonMinter.address,
      success: true,
    });

    const data = await jettonMinter.getGetJettonData();
    expect(data.mintable).toBeFalsy();
    expect(data.totalSupply).toBe(supplyBefore);
    expect(data.adminAddress.equals(deployer.address)).toBe(true);
  });

  it("4. mint after CloseMinting rejected — supply unchanged", async () => {
    const supplyBefore = await jettonMinter.getTotalSupply();

    const mintMsg: Mint = {
      $$type: "Mint",
      queryId: 0n,
      receiver: deployer.address,
      mintMessage: {
        $$type: "JettonTransferInternal",
        queryId: 0n,
        amount: toNano("1"),
        sender: deployer.address,
        responseDestination: deployer.address,
        forwardTonAmount: 0n,
        forwardPayload: beginCell().storeUint(0, 1).endCell().asSlice(),
      },
    };

    const mintTry = await jettonMinter.send(
      deployer.getSender(),
      { value: toNano("1") },
      mintMsg,
    );

    expect(mintTry.transactions).toHaveTransaction({
      from: deployer.address,
      to: jettonMinter.address,
      aborted: true,
      exitCode: JettonMinter.errors["Mint is closed"],
    });

    expect(await jettonMinter.getTotalSupply()).toBe(supplyBefore);
    expect((await jettonMinter.getGetJettonData()).mintable).toBeFalsy();
  });

  it("5. ChangeOwner(null) after CloseMinting — admin revoked, mintable stays false", async () => {
    const supplyBefore = await jettonMinter.getTotalSupply();

    const revokeResult = await jettonMinter.sendRevokeOwner(deployer.getSender());
    expect(revokeResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: jettonMinter.address,
      success: true,
    });

    const data = await readJettonData(blockchain.provider(jettonMinter.address));
    expect(isAdminRevoked(data.adminAddress)).toBe(true);
    expect(data.mintable).toBe(false);
    expect(data.totalSupply).toBe(supplyBefore);
  });

  it("6. JettonUpdateContent after owner null rejected — content unchanged", async () => {
    const provider = blockchain.provider(jettonMinter.address);
    const contentBefore = (await readJettonData(provider)).jettonContent;
    const newContent = buildOffChainMetadataCell("https://example.com/evil-metadata.json");

    const updateResult = await jettonMinter.sendChangeContent(deployer.getSender(), newContent);

    expect(updateResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: jettonMinter.address,
      aborted: true,
      exitCode: JettonMinter.errors["Incorrect sender"],
    });

    expect(cellsEqual((await readJettonData(provider)).jettonContent, contentBefore)).toBe(true);
    expect(isAdminRevoked((await readJettonData(provider)).adminAddress)).toBe(true);
  });

  it("7. ChangeOwner after owner null rejected — admin remains null", async () => {
    const changeResult = await jettonMinter.sendChangeOwner(
      deployer.getSender(),
      notDeployer.address,
    );

    expect(changeResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: jettonMinter.address,
      aborted: true,
      exitCode: JettonMinter.errors["Incorrect sender"],
    });

    expect(isAdminRevoked(
      (await readJettonData(blockchain.provider(jettonMinter.address))).adminAddress,
    )).toBe(true);
  });
});
