import { randomUUID } from "node:crypto";
import { createNote } from "./store";
import { sendDocumentToChannel } from "./telegram";
import type { Note } from "./types";

/**
 * Moves a file into the Telegram storage channel and records it as a pending note.
 * Used by both the direct upload route and the Blob callback (large-file path).
 */
export async function storeFileAsNote(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  size: number,
  title: string
): Promise<Note> {
  const { fileId, messageId } = await sendDocumentToChannel(
    buffer,
    fileName,
    mimeType,
    title
  );

  const note: Note = {
    id: randomUUID(),
    title: title.trim() || fileName,
    fileName,
    mimeType,
    size,
    telegramFileId: fileId,
    messageId,
    status: "pending",
    uploadedAt: Date.now(),
  };
  await createNote(note);
  return note;
}
