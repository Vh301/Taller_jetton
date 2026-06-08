import {
  TALLER_JETTON_IMAGE_URL,
  TALLER_METADATA_URL,
  TALLER_TOKEN_NAME,
  TALLER_TOKEN_SYMBOL,
} from "./config";

export async function preflightTallerMetadata(options?: {
  metadataUrl?: string;
  expectedImageUrl?: string;
}): Promise<void> {
  const metadataUrl = options?.metadataUrl ?? TALLER_METADATA_URL;
  const expectedImageUrl = options?.expectedImageUrl ?? TALLER_JETTON_IMAGE_URL;

  console.log("Preflight: checking TALLER metadata (raw GitHub tag)...");

  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error(`Metadata not live (${response.status}): ${metadataUrl}`);
  }

  const body = await response.text();
  if (body.includes("vercel.app")) {
    throw new Error("Metadata must not reference vercel.app");
  }

  const metadata = JSON.parse(body) as {
    name?: string;
    symbol?: string;
    decimals?: number;
    image?: string;
  };

  const expected = {
    name: TALLER_TOKEN_NAME,
    symbol: TALLER_TOKEN_SYMBOL,
    decimals: 9,
    image: expectedImageUrl,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (metadata[key as keyof typeof expected] !== value) {
      throw new Error(
        `Metadata field "${key}" mismatch. Expected "${value}", got "${metadata[key as keyof typeof metadata]}".`,
      );
    }
  }

  if (metadata.image?.includes("vercel.app")) {
    throw new Error("Metadata image must not reference vercel.app");
  }

  const imageResponse = await fetch(metadata.image!);
  if (!imageResponse.ok) {
    throw new Error(`Image not live (${imageResponse.status}): ${metadata.image}`);
  }

  const contentType = imageResponse.headers.get("content-type") ?? "";
  if (!contentType.includes("image/png")) {
    throw new Error(`Image Content-Type expected image/png, got ${contentType}`);
  }

  console.log("Preflight: metadata + image OK");
}
