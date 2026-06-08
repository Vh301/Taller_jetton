/**
 * Supabase REST RPC client for poster bot (works on Vercel without direct Postgres).
 */

import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  getPosterDbSecret,
} from "./config";

type RpcRow = Record<string, unknown>;

function getRestConfig(): { url: string; anon: string; secret: string } {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  const secret = getPosterDbSecret();

  if (!url || !anon || !secret) {
    throw new Error(
      "Poster RPC not configured: TALLER_POSTER_BOT_SUPABASE_URL, TALLER_SUPABASE_ANON_KEY, TALLER_POSTER_DB_SECRET",
    );
  }

  return { url, anon, secret };
}

export function isPosterDbConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey() && getPosterDbSecret());
}

async function rpc<T>(functionName: string, args: Record<string, unknown>): Promise<T> {
  const { url, anon, secret } = getRestConfig();

  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ p_secret: secret, ...args }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RPC ${functionName} failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as T;
  return data;
}

export { rpc };
