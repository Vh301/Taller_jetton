import { Address } from "@ton/core";

export function assertSameAddress(
  actual: string,
  expected: string,
  label: string,
): void {
  const a = Address.parse(actual);
  const e = Address.parse(expected);

  if (!a.equals(e)) {
    throw new Error(`${label} mismatch: got ${actual}, expected ${expected}`);
  }
}
