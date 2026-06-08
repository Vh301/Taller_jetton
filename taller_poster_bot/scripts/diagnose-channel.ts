/**
 * Runtime channel diagnostic — no tokens or secrets in output.
 * Usage: npx tsx scripts/diagnose-channel.ts [--post]
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(process.cwd(), ".env.local");
const SEND_TEST = process.argv.includes("--post");
const TEST_TEXT = "TALLER BC bot test: channel routing check.";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function maskChannelValue(raw: string | undefined): string {
  if (!raw) {
    return "(unset)";
  }
  if (/^-?\d+$/.test(raw.trim())) {
    return `numeric:${raw.trim()}`;
  }
  return raw.trim();
}

async function main() {
  loadEnvFile(ENV_FILE);

  const { getChannelTarget } = await import("../lib/telegram/env");
  const { resolveChannelChatId } = await import("../lib/poster/config");

  const sources = [
    ["TALLER_CHANNEL", process.env.TALLER_CHANNEL],
    ["TALLER_POSTER_CHANNEL", process.env.TALLER_POSTER_CHANNEL],
    ["TALLER_TELEGRAM_CHANNEL_URL", process.env.TALLER_TELEGRAM_CHANNEL_URL],
    ["CHANNEL_ID", process.env.CHANNEL_ID],
  ] as const;

  console.log("=== TALLER poster bot — channel diagnostic ===");
  console.log(`env file: ${existsSync(ENV_FILE) ? ENV_FILE : "(missing)"}`);
  console.log("");

  for (const [name, value] of sources) {
    console.log(`${name}: ${maskChannelValue(value)}`);
  }

  const target = getChannelTarget();
  const apiChatId = target ? resolveChannelChatId(target) : undefined;

  console.log("");
  console.log(`getChannelTarget(): ${target ?? "(undefined)"}`);
  console.log(
    `Telegram API chat_id: ${apiChatId === undefined ? "(undefined)" : typeof apiChatId === "number" ? `numeric:${apiChatId}` : apiChatId}`,
  );

  const token = process.env.TALLER_POSTER_BOT_API_TOKEN?.trim();
  if (!token) {
    console.log("\nBot token: (unset) — skip getChat");
    return;
  }

  for (const handle of ["@taller_bc", "@taller_channal"]) {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: handle }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      description?: string;
      result?: { id?: number; title?: string; username?: string };
    };
    if (data.ok && data.result) {
      console.log(
        `\ngetChat ${handle}: OK id=${data.result.id} title="${data.result.title}" username=@${data.result.username ?? "?"}`,
      );
    } else {
      console.log(`\ngetChat ${handle}: FAIL ${data.description ?? "unknown"}`);
    }
  }

  if (!SEND_TEST) {
    console.log("\nAdd --post to send one test message to getChannelTarget().");
    return;
  }

  if (!target) {
    console.error("\nCannot post: channel target is unset.");
    process.exit(1);
  }

  const postRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: apiChatId,
      text: TEST_TEXT,
    }),
  });
  const postData = (await postRes.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number; chat?: { id?: number; username?: string; title?: string } };
  };

  if (postData.ok && postData.result) {
    const chat = postData.result.chat;
    console.log(
      `\nTest post: OK message_id=${postData.result.message_id} chat_id=${chat?.id} username=@${chat?.username ?? "?"} title="${chat?.title ?? "?"}"`,
    );
  } else {
    console.error(`\nTest post: FAIL ${postData.description ?? "unknown"}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
