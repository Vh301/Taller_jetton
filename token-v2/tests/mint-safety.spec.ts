import { Address } from "@ton/core";
import {
  assertSafeMintResponseDestination,
  UNSAFE_RESPONSE_DESTINATION_ERROR,
} from "../lib/mint-safety";

describe("mint-safety", () => {
  const master = Address.parse("EQDULHGgJjOCfhADQTU7SOsW4JgFFfGjHus6gjAbiD1cKlcu");
  const deployWallet = Address.parse("EQDJxFuvYPhJseOWPtt_hRhQvUDHCaZVbN6jcA81JxbZH5El");

  it("allows deploy/admin wallet as responseDestination", () => {
    expect(() => assertSafeMintResponseDestination(deployWallet, master)).not.toThrow();
  });

  it("rejects jetton master as responseDestination before any tx is sent", () => {
    expect(() => assertSafeMintResponseDestination(master, master)).toThrow(
      UNSAFE_RESPONSE_DESTINATION_ERROR,
    );
  });
});
