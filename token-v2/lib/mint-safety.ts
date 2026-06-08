import { Address } from "@ton/core";

export const UNSAFE_RESPONSE_DESTINATION_ERROR =
  "Unsafe responseDestination: must not be jetton master address";

/** Reject mint payloads that route JettonExcesses TON to the jetton master. */
export function assertSafeMintResponseDestination(
  responseDestination: Address,
  masterAddress: Address,
): void {
  if (responseDestination.equals(masterAddress)) {
    throw new Error(UNSAFE_RESPONSE_DESTINATION_ERROR);
  }
}
