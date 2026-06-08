import { getBotToken } from "./env";

export type InlineKeyboardButton = {
  text: string;
  url?: string;
  web_app?: { url: string };
  callback_data?: string;
};

export type ReplyMarkup = {
  inline_keyboard?: InlineKeyboardButton[][];
};

function getApiUrl(): string {
  const token = getBotToken();
  if (!token) {
    throw new Error("Bot token not set (TALLER_POSTER_BOT_API_TOKEN or TELEGRAM_BOT_TOKEN)");
  }
  return `https://api.telegram.org/bot${token}`;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: ReplyMarkup,
): Promise<boolean> {
  const apiUrl = getApiUrl();

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(`${apiUrl}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as { ok?: boolean; description?: string };

  if (!data.ok) {
    console.error("[telegram] sendMessage failed:", data.description);
    return false;
  }

  return true;
}
