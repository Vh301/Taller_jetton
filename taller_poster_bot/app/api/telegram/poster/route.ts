import { NextRequest, NextResponse } from "next/server";
import {
  createPost,
  getUpcomingPosts,
  getPostById,
  markPostAsCanceled,
  getPostsByStatus,
  recordInstantPublishedPost,
  isPosterStorageConfigured,
  type Post,
} from "@/lib/poster/storage";
import { processScheduledPosts } from "@/lib/poster/scheduler";
import {
  parseScheduleDateTime,
  formatDateTime,
  isAdmin,
  getCurrentDateTime,
} from "@/lib/poster/utils";
import {
  getPosterApiUrl,
  getPosterChannelId,
  getChannelDisplayName,
  isPosterAdminConfigured,
  getPosterAdminUserIds,
  resolveChannelChatId,
} from "@/lib/poster/config";
import { getChannelEnvSource } from "@/lib/telegram/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  text?: string;
  date: number;
  forward_from_chat?: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

let lastQueueCheck = 0;
const QUEUE_CHECK_INTERVAL = 60000;

const waitingForPostText = new Map<number, number>();
const WAIT_TIMEOUT = 5 * 60 * 1000;

function getChannelEnvHint(): string {
  return "TALLER_CHANNEL или TALLER_POSTER_CHANNEL";
}

function getAdminEnvHint(): string {
  return "TALLER_POSTER_ADMIN_USER_IDS";
}

function getMenuKeyboard(isAdminUser: boolean) {
  const keyboard: { keyboard: { text: string }[][]; resize_keyboard: boolean; one_time_keyboard: boolean } = {
    keyboard: [
      [
        { text: "📋 Помощь" },
        { text: "🕐 Время" },
        { text: "👤 Мой ID" },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };

  if (isAdminUser) {
    keyboard.keyboard.push(
      [{ text: "📝 Опубликовать" }, { text: "📅 Запланировать" }],
      [{ text: "📊 Очередь" }, { text: "📜 История" }],
    );
  }

  return keyboard;
}

async function sendMessage(
  chatId: number,
  text: string,
  showMenu: boolean = false,
  isAdminUser: boolean = false,
): Promise<boolean> {
  const apiUrl = getPosterApiUrl();
  if (!apiUrl) {
    console.error("[POSTER] TALLER_POSTER_BOT_API_TOKEN is not set");
    return false;
  }

  try {
    const payload: Record<string, unknown> = { chat_id: chatId, text };

    if (showMenu) {
      payload.reply_markup = getMenuKeyboard(isAdminUser);
    }

    const response = await fetch(`${apiUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as { ok?: boolean; description?: string; error_code?: number };

    if (!data.ok) {
      console.error("[POSTER] Telegram API error:", data.description, "code:", data.error_code);
    }
    return data.ok === true;
  } catch (error) {
    console.error("[POSTER] Exception sending message:", error);
    return false;
  }
}

async function checkQueueIfNeeded(): Promise<void> {
  if (!isPosterStorageConfigured()) {
    return;
  }

  const now = Date.now();
  if (now - lastQueueCheck < QUEUE_CHECK_INTERVAL) {
    return;
  }

  lastQueueCheck = now;
  try {
    await processScheduledPosts();
  } catch (error) {
    console.error("[POSTER] Error checking queue:", error);
  }
}

function getPostTitle(text: string): string {
  const maxLength = 60;
  if (text.length <= maxLength) {
    return text;
  }
  const trimmed = text.substring(0, maxLength);
  const lastSpace = trimmed.lastIndexOf(" ");
  const lastNewline = trimmed.lastIndexOf("\n");
  const cutPoint = Math.max(lastSpace, lastNewline);

  if (cutPoint > maxLength * 0.7) {
    return `${trimmed.substring(0, cutPoint)}...`;
  }
  return `${trimmed}...`;
}

function getRemainingPostsMessage(count: number): string {
  if (count === 0) {
    return "📍 Посты закончились";
  }
  if (count <= 3) {
    const word = count === 1 ? "пост" : count === 2 || count === 3 ? "поста" : "постов";
    return `⚠️ Осталось ${count} ${word}`;
  }
  return `🔍 Осталось ${count} постов`;
}

async function notifyAdminAboutPost(postText: string): Promise<void> {
  const apiUrl = getPosterApiUrl();
  if (!apiUrl || !isPosterAdminConfigured()) {
    return;
  }

  const adminIds = getPosterAdminUserIds();

  if (adminIds.length === 0) {
    return;
  }

  let remainingCount = 0;
  if (isPosterStorageConfigured()) {
    try {
      remainingCount = (await getUpcomingPosts(100)).length;
    } catch (error) {
      console.error("[POSTER] Error getting upcoming posts:", error);
    }
  }

  const channelName = getChannelDisplayName();
  const postTitle = getPostTitle(postText);
  const remainingMessage = getRemainingPostsMessage(remainingCount);
  const notificationMessage = `✅ Пост опубликован (${channelName}): ${postTitle}\n\n${remainingMessage}`;

  for (const adminId of adminIds) {
    try {
      await fetch(`${apiUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: adminId, text: notificationMessage }),
      });
    } catch (error) {
      console.error(`[POSTER] Error notifying admin ${adminId}:`, error);
    }
  }
}

async function publishToChannel(
  postText: string,
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  const apiUrl = getPosterApiUrl();
  if (!apiUrl) {
    return { ok: false, error: "TALLER_POSTER_BOT_API_TOKEN is not set" };
  }

  const channelId = getPosterChannelId();
  if (!channelId) {
    return { ok: false, error: `${getChannelEnvHint()} is not set` };
  }

  if (postText.length > 4096) {
    return {
      ok: false,
      error: `Сообщение слишком длинное (${postText.length} символов, максимум 4096)`,
    };
  }

  const channelChatId = resolveChannelChatId(channelId);

  const response = await fetch(`${apiUrl}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: channelChatId,
      text: postText,
      parse_mode: "HTML",
    }),
  });

  const data = (await response.json()) as {
    ok?: boolean;
    description?: string;
    error_code?: number;
    result?: { message_id?: number };
  };

  if (data.ok) {
    return { ok: true, messageId: data.result?.message_id };
  }

  console.error("[POSTER] Telegram API error:", JSON.stringify(data));
  return {
    ok: false,
    error: data.description || `Unknown error (code: ${data.error_code})`,
  };
}

function buildHelpText(isAdminUser: boolean): string {
  const channelName = getChannelDisplayName();

  const publicPart = `🤖 TALLER Poster Bot (@TALLER_Post_bot)

Публикация постов TALLER в канал ${channelName}.

Команды:
/start или /help — справка
/whoami — ваш Telegram User ID
/time — текущая дата и время (UTC+3)`;

  const adminPart = `
/post <текст> — мгновенно опубликовать в ${channelName}
/schedule — запланировать пост (формат ниже)
/queue — ближайшие 10 запланированных постов
/history — история опубликованных постов
/cancel <id> — отменить запланированный пост
/status <id> — статус поста
/chatid — ID текущего чата

Формат для /schedule:
YYYY-MM-DD HH:mm
<текст поста>

Пример:
2026-06-08 12:00
TALLER — новый пост в канале.`;

  if (isAdminUser) {
    return `${publicPart}${adminPart}`.trim();
  }

  return `${publicPart}

Публикация доступна только администраторам TALLER.`.trim();
}

function adminDeniedMessage(): string {
  if (!isPosterAdminConfigured()) {
    return `⛔ Админ-доступ не настроен: ${getAdminEnvHint()} пуст на сервере.

Используйте /whoami, добавьте ID в env и перезапустите деплой.`;
  }
  return "⛔ Эта команда доступна только администраторам TALLER.";
}

export async function GET() {
  const channelEnv = getChannelEnvSource();
  const channelTarget = getPosterChannelId();

  return NextResponse.json({
    ok: true,
    message: "TALLER poster bot webhook endpoint is running",
    timestamp: new Date().toISOString(),
    channel: {
      source: channelEnv?.source ?? null,
      raw: channelEnv?.raw ?? null,
      target: channelTarget ?? null,
      apiChatId: channelTarget ? resolveChannelChatId(channelTarget) : null,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    await checkQueueIfNeeded();

    if (!getPosterApiUrl()) {
      console.error("[POSTER] TALLER_POSTER_BOT_API_TOKEN is not set");
      return NextResponse.json({ ok: true });
    }

    let update: TelegramUpdate;
    try {
      update = (await request.json()) as TelegramUpdate;
    } catch (parseError) {
      console.error("[POSTER] Error parsing request body:", parseError);
      return NextResponse.json({ ok: true });
    }

    if (!update?.message) {
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text;
    const userId = message.from?.id;
    const chatType = message.chat.type;
    const isUserAdmin = userId ? isAdmin(userId) : false;
    const channelName = getChannelDisplayName();

    if (chatType === "channel" && userId && isUserAdmin) {
      await sendMessage(
        userId,
        `📢 ID канала: ${chatId}\n\nНазвание: ${message.chat.title || "Unknown"}\n\nИспользуйте в ${getChannelEnvHint()}`,
        false,
        true,
      );
    }

    if (message.forward_from_chat?.type === "channel" && userId && isUserAdmin) {
      const fwd = message.forward_from_chat;
      await sendMessage(
        userId,
        `📢 ID канала (из пересланного): ${fwd.id}\n\nНазвание: ${fwd.title || "Unknown"}\n\nИспользуйте в ${getChannelEnvHint()}`,
        false,
        true,
      );
    }

    if (text === "📋 Помощь" || text === "/start" || text === "/help") {
      await sendMessage(chatId, buildHelpText(isUserAdmin), true, isUserAdmin);
      return NextResponse.json({ ok: true });
    }

    if (text === "/whoami" || text === "👤 Мой ID") {
      if (!userId) {
        await sendMessage(chatId, "Could not determine your Telegram user ID.", true, isUserAdmin);
        return NextResponse.json({ ok: true });
      }

      const username = message.from?.username;
      const usernameLine = username ? `Username: @${username}` : "Username: (not set)";
      const whoamiText = [
        `Your Telegram User ID: ${userId}`,
        usernameLine,
        "",
        `Add this ID to ${getAdminEnvHint()} to allow admin commands.`,
      ].join("\n");

      await sendMessage(chatId, whoamiText, true, isUserAdmin);
      return NextResponse.json({ ok: true });
    }

    if (text === "/time" || text === "🕐 Время") {
      await sendMessage(
        chatId,
        `Текущая дата и время (UTC+3):\n${getCurrentDateTime()}`,
        true,
        isUserAdmin,
      );
      return NextResponse.json({ ok: true });
    }

    if (!userId || !isUserAdmin) {
      if (
        text?.startsWith("/post") ||
        text?.startsWith("/schedule") ||
        text?.startsWith("/queue") ||
        text?.startsWith("/history") ||
        text?.startsWith("/cancel") ||
        text?.startsWith("/status") ||
        text === "/chatid" ||
        text === "📝 Опубликовать" ||
        text === "📅 Запланировать" ||
        text === "📊 Очередь" ||
        text === "📜 История"
      ) {
        await sendMessage(chatId, adminDeniedMessage(), true, false);
      }
      return NextResponse.json({ ok: true });
    }

    if (text === "/chatid") {
      await sendMessage(
        chatId,
        `Chat ID: ${chatId}\n\nЕсли это канал, используйте в ${getChannelEnvHint()}`,
        true,
        true,
      );
      console.log(`[POSTER] Chat ID requested: ${chatId} (type: ${message.chat.type})`);
      return NextResponse.json({ ok: true });
    }

    if (text?.startsWith("/post ") || text === "📝 Опубликовать") {
      if (text === "📝 Опубликовать") {
        waitingForPostText.set(userId, Date.now());
        await sendMessage(
          chatId,
          `📝 Отправьте текст поста для публикации в ${channelName}`,
          true,
          true,
        );
        return NextResponse.json({ ok: true });
      }

      const postText = text.substring(6).trim();
      if (!postText) {
        await sendMessage(chatId, "Usage: /post your text", true, true);
        return NextResponse.json({ ok: true });
      }

      try {
        const result = await publishToChannel(postText);
        if (result.ok) {
          waitingForPostText.delete(userId);
          await sendMessage(chatId, `✅ Пост опубликован в ${channelName}`, true, true);
          if (isPosterStorageConfigured()) {
            try {
              await recordInstantPublishedPost(postText, userId, result.messageId);
            } catch (dbError) {
              console.error("[POSTER] DB record failed (non-blocking):", dbError);
            }
          }
          try {
            await notifyAdminAboutPost(postText);
          } catch (error) {
            console.error("[POSTER] notify admin failed:", error);
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await sendMessage(chatId, `❌ Error: ${errorMessage}`, true, true);
      }

      return NextResponse.json({ ok: true });
    }

    if (text === "/post") {
      await sendMessage(chatId, "Usage: /post your text", true, true);
      return NextResponse.json({ ok: true });
    }

    if (text === "/schedule" || text === "📅 Запланировать") {
      if (!isPosterStorageConfigured()) {
        await sendMessage(
          chatId,
          "❌ Планирование недоступно: Supabase DB не настроена (TALLER_POSTER_BOT_SUPABASE_URL).",
          true,
          true,
        );
        return NextResponse.json({ ok: true });
      }

      await sendMessage(
        chatId,
        `📅 Планирование постов (TALLER, ${channelName})

⚠️ НЕ БОЛЕЕ 10 ПОСТОВ ЗА ОДНО СООБЩЕНИЕ

Формат (один пост):
YYYY-MM-DD HH:mm
<текст поста>

Формат (несколько постов — разделите пустой строкой):
YYYY-MM-DD HH:mm
<текст 1>

YYYY-MM-DD HH:mm
<текст 2>

Пример:
2026-06-08 12:00
TALLER: пример запланированного поста.`,
        true,
        true,
      );
      return NextResponse.json({ ok: true });
    }

    if (text?.includes("\n")) {
      const firstLine = text.split("\n")[0].trim();
      const isScheduleFormat = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(firstLine);

      if (isScheduleFormat) {
        if (!isPosterStorageConfigured()) {
          await sendMessage(chatId, "❌ Supabase не настроена для планирования постов.", true, true);
          return NextResponse.json({ ok: true });
        }

        const blocks = text.split("\n\n").filter((block) => block.trim());
        const results: string[] = [];

        for (const block of blocks) {
          const lines = block.split("\n").filter((line) => line.trim());
          if (lines.length >= 2) {
            const dateTimeStr = lines[0].trim();
            const postText = lines.slice(1).join("\n").trim();

            if (postText && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(dateTimeStr)) {
              const publishAt = parseScheduleDateTime(dateTimeStr);
              if (!publishAt) {
                results.push(`❌ "${dateTimeStr}" — неверный формат даты/времени`);
                continue;
              }

              const post = await createPost(publishAt, postText, userId);
              results.push(`✅ ${post.id.substring(0, 8)}... — ${formatDateTime(publishAt)}`);
            }
          }
        }

        if (results.length > 0) {
          await sendMessage(chatId, `Добавлено постов: ${results.length}\n\n${results.join("\n")}`, true, true);
          return NextResponse.json({ ok: true });
        }
      }
    }

    if (text === "/queue" || text === "📊 Очередь") {
      if (!isPosterStorageConfigured()) {
        await sendMessage(chatId, "❌ Supabase не настроена.", true, true);
        return NextResponse.json({ ok: true });
      }

      const posts = await getUpcomingPosts(10);
      if (posts.length === 0) {
        await sendMessage(chatId, "Нет запланированных постов", true, true);
        return NextResponse.json({ ok: true });
      }

      const queueText = posts
        .map((post, index) => {
          const date = formatDateTime(post.publish_at);
          const preview = post.text.length > 40 ? `${post.text.substring(0, 40)}...` : post.text;
          return `${index + 1}. ${post.id}\n   ${date}\n   ${preview}`;
        })
        .join("\n\n");

      await sendMessage(chatId, `Запланированные посты (${channelName}):\n\n${queueText}`, true, true);
      return NextResponse.json({ ok: true });
    }

    if (text?.startsWith("/cancel ")) {
      if (!isPosterStorageConfigured()) {
        await sendMessage(chatId, "❌ Supabase не настроена.", true, true);
        return NextResponse.json({ ok: true });
      }

      const postId = text.substring(8).trim();
      const post = await getPostById(postId);
      if (!post) {
        await sendMessage(chatId, `❌ Post ${postId} not found`, true, true);
        return NextResponse.json({ ok: true });
      }
      if (post.status === "canceled") {
        await sendMessage(chatId, `Post ${postId} is already canceled`, true, true);
        return NextResponse.json({ ok: true });
      }

      await markPostAsCanceled(postId, userId);
      await sendMessage(chatId, `✅ Canceled ${postId}`, true, true);
      return NextResponse.json({ ok: true });
    }

    if (text?.startsWith("/status ")) {
      if (!isPosterStorageConfigured()) {
        await sendMessage(chatId, "❌ Supabase не настроена.", true, true);
        return NextResponse.json({ ok: true });
      }

      const postId = text.substring(8).trim();
      const post = await getPostById(postId);
      if (!post) {
        await sendMessage(chatId, `❌ Post ${postId} not found`, true, true);
        return NextResponse.json({ ok: true });
      }

      const statusText = `Post ${post.id}

Status: ${post.status}
Scheduled: ${formatDateTime(post.publish_at)}
Created: ${formatDateTime(post.created_at)}
${post.published_at ? `Published: ${formatDateTime(post.published_at)}` : ""}
${post.last_error ? `Last error: ${post.last_error}` : ""}

Text:
${post.text.length > 200 ? `${post.text.substring(0, 200)}...` : post.text}`;

      await sendMessage(chatId, statusText, true, true);
      return NextResponse.json({ ok: true });
    }

    if (text === "/history" || text === "📜 История") {
      if (!isPosterStorageConfigured()) {
        await sendMessage(chatId, "❌ Supabase не настроена.", true, true);
        return NextResponse.json({ ok: true });
      }

      const posts = await getPostsByStatus("published", 30);
      if (posts.length === 0) {
        await sendMessage(chatId, "📜 История успешных постов\n\nПока нет опубликованных постов.", true, true);
        return NextResponse.json({ ok: true });
      }

      const sortedPosts = posts
        .filter((p: Post) => p.published_at)
        .sort((a: Post, b: Post) => {
          return new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime();
        })
        .slice(0, 30);

      let historyText = `📜 История успешных постов (${channelName}) (${sortedPosts.length})\n\n`;
      sortedPosts.forEach((post: Post, index: number) => {
        const date = formatDateTime(post.published_at!);
        const preview = post.text.length > 40 ? `${post.text.substring(0, 40)}...` : post.text;
        historyText += `${index + 1}. ${date} — ${preview}\n`;
      });

      const maxLength = 4000;
      if (historyText.length > maxLength) {
        const parts: string[] = [];
        let currentPart = "";
        for (const line of historyText.split("\n")) {
          if (currentPart.length + line.length + 1 > maxLength) {
            parts.push(currentPart);
            currentPart = `${line}\n`;
          } else {
            currentPart += `${line}\n`;
          }
        }
        if (currentPart) {
          parts.push(currentPart);
        }

        for (let i = 0; i < parts.length; i++) {
          await sendMessage(chatId, `${parts[i]}\n[Часть ${i + 1} из ${parts.length}]`, true, true);
          if (i < parts.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      } else {
        await sendMessage(chatId, historyText, true, true);
      }

      return NextResponse.json({ ok: true });
    }

    if (userId && text && !text.startsWith("/")) {
      const waitTimestamp = waitingForPostText.get(userId);
      if (waitTimestamp) {
        if (Date.now() - waitTimestamp < WAIT_TIMEOUT) {
          const isScheduleFormat = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(text.trim());
          if (!isScheduleFormat) {
            waitingForPostText.delete(userId);

            try {
              const result = await publishToChannel(text);
              if (result.ok) {
                await sendMessage(chatId, `✅ Пост опубликован в ${channelName}`, true, true);
                if (isPosterStorageConfigured()) {
                  try {
                    await recordInstantPublishedPost(text, userId, result.messageId);
                  } catch (dbError) {
                    console.error("[POSTER] DB record failed:", dbError);
                  }
                }
                try {
                  await notifyAdminAboutPost(text);
                } catch (error) {
                  console.error("[POSTER] notify admin failed:", error);
                }
              } else {
                throw new Error(result.error);
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              await sendMessage(chatId, `❌ Ошибка публикации: ${errorMessage}`, true, true);
            }

            return NextResponse.json({ ok: true });
          }
        } else {
          waitingForPostText.delete(userId);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POSTER] Unexpected error:", error);
    return NextResponse.json({ ok: true });
  }
}
