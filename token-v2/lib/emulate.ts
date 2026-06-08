import {
  Address,
  beginCell,
  Cell,
  Message,
  storeMessage,
  toNano,
} from "@ton/core";
import {
  CloseMinting,
  Mint,
  storeChangeOwner,
  storeCloseMinting,
  storeJettonUpdateContent,
  storeMint,
} from "../output/TallerJetton_JettonMinter";
import { assertSafeMintResponseDestination } from "./mint-safety";

export const MINT_IS_CLOSED_EXIT_CODE = 51950;
export const INCORRECT_SENDER_EXIT_CODE = 9215;

function buildInternalMessageBoc(params: {
  from: Address;
  to: Address;
  body: Cell;
  attachedTon?: bigint;
}): string {
  const message: Message = {
    info: {
      type: "internal",
      ihrDisabled: true,
      bounce: true,
      bounced: false,
      src: params.from,
      dest: params.to,
      value: { coins: params.attachedTon ?? toNano("0.05") },
      ihrFee: 0n,
      forwardFee: 0n,
      createdLt: 0n,
      createdAt: 0,
    },
    body: params.body,
  };

  return beginCell().store(storeMessage(message)).endCell().toBoc().toString("base64");
}

export function buildMintInternalMessageBoc(params: {
  from: Address;
  to: Address;
  mintAmountNano: bigint;
  forwardTonAmount?: bigint;
  attachedTon?: bigint;
}): string {
  const forwardTonAmount = params.forwardTonAmount ?? toNano("0.05");
  const attachedTon = params.attachedTon ?? toNano("1.1");
  const responseDestination = params.from;

  assertSafeMintResponseDestination(responseDestination, params.to);

  const mintBody: Mint = {
    $$type: "Mint",
    queryId: 0n,
    receiver: params.from,
    mintMessage: {
      $$type: "JettonTransferInternal",
      queryId: 0n,
      amount: params.mintAmountNano,
      sender: params.to,
      responseDestination,
      forwardTonAmount,
      forwardPayload: beginCell().storeUint(0, 1).endCell().asSlice(),
    },
  };

  return buildInternalMessageBoc({
    from: params.from,
    to: params.to,
    attachedTon,
    body: beginCell().store(storeMint(mintBody)).endCell(),
  });
}

export function buildUpdateContentInternalMessageBoc(params: {
  from: Address;
  to: Address;
  content: Cell;
}): string {
  return buildInternalMessageBoc({
    from: params.from,
    to: params.to,
    body: beginCell()
      .store(
        storeJettonUpdateContent({
          $$type: "JettonUpdateContent",
          queryId: 0n,
          content: params.content,
        }),
      )
      .endCell(),
  });
}

export function buildChangeOwnerInternalMessageBoc(params: {
  from: Address;
  to: Address;
  newOwner: Address;
}): string {
  return buildInternalMessageBoc({
    from: params.from,
    to: params.to,
    body: beginCell()
      .store(
        storeChangeOwner({
          $$type: "ChangeOwner",
          queryId: 0n,
          newOwner: params.newOwner,
        }),
      )
      .endCell(),
  });
}

export function buildCloseMintingInternalMessageBoc(params: {
  from: Address;
  to: Address;
}): string {
  return buildInternalMessageBoc({
    from: params.from,
    to: params.to,
    body: beginCell().store(storeCloseMinting({ $$type: "CloseMinting" })).endCell(),
  });
}

export type EmulateResult = {
  rejected: boolean;
  accepted: boolean;
  exitCode?: number;
  exitDescription?: string;
};

export function analyzeMasterInboundTrace(
  trace: TraceNode,
  masterRaw: string,
): EmulateResult {
  const stack: TraceNode[] = [trace];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const tx = node.transaction;
    if (tx?.in_msg?.destination?.address === masterRaw) {
      const exitCode = tx.compute_phase?.exit_code;
      const aborted = tx.aborted === true || tx.compute_phase?.success === false;
      const accepted =
        tx.aborted !== true &&
        tx.compute_phase?.success === true &&
        exitCode === 0;
      return {
        rejected: aborted || (exitCode !== undefined && exitCode !== 0),
        accepted,
        exitCode,
        exitDescription: tx.compute_phase?.exit_code_description,
      };
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return { rejected: false, accepted: false };
}

export type TraceNode = {
  transaction?: {
    aborted?: boolean;
    destroy?: boolean;
    success?: boolean;
    compute_phase?: {
      exit_code?: number;
      exit_code_description?: string;
      success?: boolean;
    };
    in_msg?: {
      destination?: { address?: string };
      source?: { address?: string };
    };
  };
  interfaces?: string[];
  children?: TraceNode[];
};

export function findRejectedMintTrace(
  trace: TraceNode,
  masterRaw: string,
): {
  aborted: boolean;
  exitCode?: number;
  exitDescription?: string;
} | null {
  const stack: TraceNode[] = [trace];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const tx = node.transaction;
    if (tx?.in_msg?.destination?.address === masterRaw) {
      const exitCode = tx.compute_phase?.exit_code;
      const aborted = tx.aborted === true || tx.compute_phase?.success === false;
      if (aborted || exitCode === MINT_IS_CLOSED_EXIT_CODE) {
        return {
          aborted: true,
          exitCode,
          exitDescription: tx.compute_phase?.exit_code_description,
        };
      }
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return null;
}

export function traceHasSuccessfulMint(trace: TraceNode, masterRaw: string): boolean {
  const stack: TraceNode[] = [trace];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const tx = node.transaction;
    if (
      tx?.in_msg?.destination?.address === masterRaw &&
      tx.aborted !== true &&
      tx.compute_phase?.success === true &&
      tx.compute_phase?.exit_code === 0
    ) {
      return true;
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return false;
}
