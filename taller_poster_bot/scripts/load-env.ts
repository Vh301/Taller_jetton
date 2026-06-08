import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Local env for poster bot service (never commit). */
export const POSTER_ENV_FILE = resolve(process.cwd(), ".env.local");

export function loadPosterEnv(): void {
  if (!existsSync(POSTER_ENV_FILE)) {
    throw new Error(`Missing ${POSTER_ENV_FILE} — copy from .env.example`);
  }
  dotenv.config({ path: POSTER_ENV_FILE });
}
