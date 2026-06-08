/** TALLER / TLR uses 9 decimals */
export const TALLER_DECIMALS = 9;

export const TALLER_TOKEN_NAME = "TALLER";
export const TALLER_TOKEN_SYMBOL = "TLR";

export function tallerAmountToNano(amount: bigint | number | string): bigint {
  const whole = BigInt(amount);
  return whole * 10n ** BigInt(TALLER_DECIMALS);
}

export const TALLER_METADATA_URL =
  "https://raw.githubusercontent.com/Vh301/Taller_jetton/taller-mainnet-metadata/public/metadata/taller-jetton-metadata.json";

export const TALLER_JETTON_IMAGE_URL =
  "https://raw.githubusercontent.com/Vh301/Taller_jetton/taller-mainnet-metadata/public/jetton_image/taller_jetton_image.png";

/** Mainnet fixed supply: 100,000,000 TLR (human units). */
export const TALLER_MAINNET_MINT_AMOUNT = 100_000_000n;

/** Testnet proof mint amount (cost control, VLTX pattern). */
export const TALLER_TEST_MINT_AMOUNT = 1_000_000n;

export const TALLER_ADMIN_ADDRESS_TESTNET =
  "0QDTlkC0OE4CRqOMzBiRTiOcNKTq8spJjGI8gIlU6-xOUz5s";

export const TALLER_HOLDER_ADDRESS_TESTNET =
  "0QDTlkC0OE4CRqOMzBiRTiOcNKTq8spJjGI8gIlU6-xOUz5s";

export const TALLER_ADMIN_ADDRESS_MAINNET =
  "UQDZr3Ka6DE6wWZijBQDVbbJdMHYeqXiZ-VXsSeb4ypth0TD";

export const TALLER_HOLDER_ADDRESS_MAINNET =
  "UQDZr3Ka6DE6wWZijBQDVbbJdMHYeqXiZ-VXsSeb4ypth0TD";
