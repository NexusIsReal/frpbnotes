export type NoteStatus = "pending" | "approved";

export interface Note {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  telegramFileId: string;
  messageId: number;
  status: NoteStatus;
  uploadedAt: number;
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // Telegram getFile limit
export const DIRECT_UPLOAD_LIMIT = 4 * 1024 * 1024; // stay under Vercel's 4.5 MB request body cap

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export function isAllowedMime(mime: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}
