import { Address } from "@ton/core";

export const UNSAFE_RESPONSE_DESTINATION_ERROR =
  "Unsafe responseDestination: must not be jetton master address";

/** Reject mint payloads that route JettonExcesses TON to the jetton master. */
export function assertSafeMintResponseDestination(
  responseDestination: Address,
  masterAddress: Address,
): void {
  if (responseDestination.equals(masterAddress)) {
    throw new Error(
      `${UNSAFE_RESPONSE_DESTINATION_ERROR} (${masterAddress.toString()})`,
    );
  }
}

/** Reject refund/excess routing to jetton master (deployed or predicted). */
export function assertSafeRefundDestination(
  destination: Address,
  masterAddress: Address,
  label = "refund/excess destination",
): void {
  if (destination.equals(masterAddress)) {
    throw new Error(
      `Unsafe ${label}: must not be jetton master address (${masterAddress.toString()})`,
    );
  }
}
