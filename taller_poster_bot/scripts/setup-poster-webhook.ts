/**
 * Установка Telegram webhook для TALLER poster bot (@TALLER_Post_bot).
 *
 * Usage:
 *   npm run setup:poster-webhook https://your-project.vercel.app/api/telegram/poster
 */

import { loadPosterEnv } from "./load-env";

loadPosterEnv();

const BOT_TOKEN =
  process.env.TALLER_POSTER_BOT_API_TOKEN?.trim() ||
  process.env.TALLER_POSTER_BOT_TOKEN?.trim() ||
  process.env.TELEGRAM_BOT_TOKEN?.trim();

if (!BOT_TOKEN) {
  console.error("❌ TALLER_POSTER_BOT_API_TOKEN не установлен");
  console.log("\nДобавьте в .env.local или Vercel:");
  console.log("  TALLER_POSTER_BOT_API_TOKEN=ваш_токен_бота");
  process.exit(1);
}

async function setupWebhook() {
  const webhookUrl =
    process.argv[2] ||
    process.env.TALLER_POSTER_WEBHOOK_URL?.trim() ||
    process.env.POSTER_WEBHOOK_URL?.trim() ||
    process.env.TELEGRAM_WEBHOOK_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/telegram/poster` : undefined);

  if (!webhookUrl) {
    console.error("❌ Укажите URL webhook");
    console.log("\nИспользование:");
    console.log("  npm run setup:poster-webhook https://ваш-проект.vercel.app/api/telegram/poster");
    process.exit(1);
  }

  const fullWebhookUrl = webhookUrl.startsWith("http")
    ? webhookUrl
    : `https://${webhookUrl}/api/telegram/poster`;

  console.log("🔧 Настройка Telegram Webhook для TALLER poster bot...");
  console.log(`📡 URL: ${fullWebhookUrl}`);
  console.log(`🤖 Bot Token: ${BOT_TOKEN!.substring(0, 10)}...`);

  try {
    console.log("\n🧹 Удаление polling (deleteWebhook)...");
    const deleteResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, {
      method: "POST",
    });
    const deleteData = (await deleteResponse.json()) as { ok?: boolean; description?: string };
    if (!deleteData.ok) {
      console.warn("⚠️ deleteWebhook:", deleteData.description);
    } else {
      console.log("✅ Polling/webhook сброшен");
    }

    const setResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fullWebhookUrl, drop_pending_updates: false }),
    });
    const data = (await setResponse.json()) as { ok?: boolean; description?: string };

    if (data.ok) {
      console.log("✅ Webhook успешно установлен!");
    } else {
      console.error("❌ Ошибка setWebhook:", data.description);
      process.exit(1);
    }

    const checkResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const checkData = (await checkResponse.json()) as {
      ok?: boolean;
      result?: {
        url?: string;
        pending_update_count?: number;
        last_error_message?: string;
      };
    };

    if (checkData.ok && checkData.result) {
      console.log(`   URL: ${checkData.result.url || "не установлен"}`);
      console.log(`   Pending: ${checkData.result.pending_update_count ?? 0}`);
      if (checkData.result.last_error_message) {
        console.log(`   ⚠️ Последняя ошибка: ${checkData.result.last_error_message}`);
      }
    }
  } catch (error) {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  }
}

setupWebhook();
