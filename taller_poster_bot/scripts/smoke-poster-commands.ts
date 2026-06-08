/**
 * Smoke test poster bot webhook commands (production by default).
 * Usage: npx tsx scripts/smoke-poster-commands.ts [baseUrl]
 */
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

const baseUrl = process.argv[2] || "https://tallerposterbot.vercel.app";
const adminId = Number.parseInt(
  process.env.TALLER_POSTER_ADMIN_USER_IDS?.split(/[,\s]+/)[0] || "7963523915",
  10,
);

const scheduleDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const scheduleLine = scheduleDate.toISOString().slice(0, 16).replace("T", " ");

const COMMANDS = [
  "/queue",
  "/history",
  "/schedule",
  `${scheduleLine}\nSmoke schedule from TALLER RPC test`,
  "/post Test from TALLER RPC",
] as const;

async function sendCommand(command: string): Promise<{ status: number; body: string }> {
  const update = {
    update_id: Date.now() + Math.floor(Math.random() * 1000),
    message: {
      message_id: Date.now() + Math.floor(Math.random() * 1000),
      from: { id: adminId, is_bot: false, first_name: "Yan" },
      chat: { id: adminId, type: "private" },
      text: command,
      date: Math.floor(Date.now() / 1000),
    },
  };

  const url = `${baseUrl.replace(/\/$/, "")}/api/telegram/poster`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function main() {
  console.log("Smoke test base URL:", baseUrl);
  let failed = 0;

  for (const command of COMMANDS) {
    const label = command.includes("\n") ? command.split("\n")[0] + " + text" : command;
    const { status, body } = await sendCommand(command);
    const ok = status === 200 && body.includes('"ok":true');
    console.log(`${ok ? "OK" : "FAIL"} ${label} -> ${status} ${body.slice(0, 80)}`);
    if (!ok) {
      failed += 1;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
