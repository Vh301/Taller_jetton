/**
 * Simulate Telegram webhook update (smoke test).
 * Usage: npx tsx scripts/smoke-webhook.ts /start
 */
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

const baseUrl = process.argv[3] || "https://tallerposterbot.vercel.app";
const command = process.argv[2] || "/start";
const adminId = Number.parseInt(process.env.TALLER_POSTER_ADMIN_USER_IDS?.split(/[,\s]+/)[0] || "7963523915", 10);

const update = {
  update_id: Date.now(),
  message: {
    message_id: Date.now(),
    from: { id: adminId, is_bot: false, first_name: "Yan" },
    chat: { id: adminId, type: "private" },
    text: command,
    date: Math.floor(Date.now() / 1000),
  },
};

async function main() {
  const url = `${baseUrl.replace(/\/$/, "")}/api/telegram/poster`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  const text = await res.text();
  console.log("POST", command, "->", res.status, text.slice(0, 120));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
