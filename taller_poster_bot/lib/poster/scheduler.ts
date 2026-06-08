/**
 * Планировщик автоматической публикации постов TALLER poster bot.
 */

import {
  getPosterApiUrl,
  getPosterChannelId,
  getPosterAdminUserIds,
  resolveChannelChatId,
} from "./config";
import {
  getScheduledPosts,
  markPostAsPublished,
  updatePostError,
  getUpcomingPosts,
} from "./storage";

async function publishToChannel(
  text: string,
): Promise<{ success: boolean; error?: string; messageId?: number }> {
  const apiUrl = getPosterApiUrl();
  if (!apiUrl) {
    return { success: false, error: "TALLER_POSTER_BOT_API_TOKEN is not set" };
  }

  const channelId = getPosterChannelId();
  if (!channelId) {
    return { success: false, error: "TALLER_CHANNEL is not set" };
  }

  const channelChatId = resolveChannelChatId(channelId);

  try {
    if (text.length > 4096) {
      return {
        success: false,
        error: `Сообщение слишком длинное (${text.length} символов, максимум 4096)`,
      };
    }

    const response = await fetch(`${apiUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelChatId,
        text,
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
      return { success: true, messageId: data.result?.message_id };
    }

    console.error("[SCHEDULER] Telegram API error:", JSON.stringify(data));
    return {
      success: false,
      error: data.description || `Unknown error (code: ${data.error_code})`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

async function notifyAdmin(message: string): Promise<void> {
  const apiUrl = getPosterApiUrl();
  if (!apiUrl) {
    console.error("[SCHEDULER] Bot token not set, cannot notify admin");
    return;
  }

  const adminIds = getPosterAdminUserIds();
  if (adminIds.length === 0) {
    console.error("[SCHEDULER] TALLER_POSTER_ADMIN_USER_IDS not set");
    return;
  }

  for (const adminId of adminIds) {
    try {
      const response = await fetch(`${apiUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: adminId, text: message }),
      });

      const data = (await response.json()) as { ok?: boolean; description?: string };
      if (!data.ok) {
        console.error(`[SCHEDULER] Failed to notify admin ${adminId}: ${data.description}`);
      }
    } catch (error) {
      console.error(`[SCHEDULER] Error notifying admin ${adminId}:`, error);
    }
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

export async function processScheduledPosts(): Promise<void> {
  const posts = await getScheduledPosts(50);

  if (posts.length === 0) {
    return;
  }

  console.log(`[SCHEDULER] Found ${posts.length} scheduled posts to process`);

  for (const post of posts) {
    const now = new Date().toISOString();

    if (post.publish_at > now) {
      continue;
    }

    console.log(`[SCHEDULER] Publishing post ${post.id} (scheduled for ${post.publish_at})`);

    const result = await publishToChannel(post.text);

    if (result.success) {
      await markPostAsPublished(post.id, result.messageId);
      console.log(`[SCHEDULER] Post ${post.id} published successfully`);

      const remainingPosts = await getUpcomingPosts(100);
      const postTitle = getPostTitle(post.text);
      const remainingMessage = getRemainingPostsMessage(remainingPosts.length);
      const notificationMessage = `✅ Пост опубликован: ${postTitle}\n\n${remainingMessage}`;

      await notifyAdmin(notificationMessage);
    } else {
      await updatePostError(post.id, result.error || "Unknown error");
      console.error(`[SCHEDULER] Failed to publish post ${post.id}: ${result.error}`);
    }
  }
}
