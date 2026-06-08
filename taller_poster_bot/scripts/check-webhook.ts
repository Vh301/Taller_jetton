import { loadPosterEnv } from "./load-env";

loadPosterEnv();

const token =
  process.env.TALLER_POSTER_BOT_API_TOKEN?.trim() ||
  process.env.TALLER_POSTER_BOT_TOKEN?.trim();

if (!token) {
  console.error("No bot token");
  process.exit(1);
}

async function main() {
  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const data = (await res.json()) as {
    ok: boolean;
    result?: {
      url?: string;
      pending_update_count?: number;
      last_error_message?: string;
    };
  };
  const w = data.result;
  console.log("webhook url:", w?.url || "(none)");
  console.log("pending updates:", w?.pending_update_count ?? 0);
  console.log("last error:", w?.last_error_message || "(none)");
}

main();
