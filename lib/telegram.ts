function botApiBase(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return `https://api.telegram.org/bot${token}`;
}

export function requireChannelId(): string {
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!chatId) throw new Error("TELEGRAM_CHANNEL_ID is not configured");
  return chatId;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function callTelegram<T>(method: string, body: FormData | URLSearchParams): Promise<T> {
  const res = await fetch(`${botApiBase()}/${method}`, {
    method: "POST",
    body,
  });
  const json = (await res.json()) as TelegramResponse<T>;
  if (!json.ok || json.result === undefined) {
    throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  }
  return json.result;
}

export async function sendDocumentToChannel(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  title: string
): Promise<{ fileId: string; messageId: number }> {
  const form = new FormData();
  form.set("chat_id", requireChannelId());
  form.set("caption", title.slice(0, 1024));
  form.set("document", new Blob([buffer], { type: mimeType }), fileName);

  const message = await callTelegram<{
    message_id: number;
    document?: { file_id: string };
  }>("sendDocument", form);

  if (!message.document) {
    throw new Error("Telegram did not return a document in the response");
  }
  return { fileId: message.document.file_id, messageId: message.message_id };
}

export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const file = await callTelegram<{ file_path: string }>(
    "getFile",
    new URLSearchParams({ file_id: fileId })
  );
  return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
}

export async function deleteTelegramMessage(messageId: number): Promise<void> {
  const form = new FormData();
  form.set("chat_id", requireChannelId());
  form.set("message_id", String(messageId));
  await callTelegram("deleteMessage", form).catch(() => {
    // Messages older than 48h cannot be deleted by bots; storage stays valid anyway.
  });
}
