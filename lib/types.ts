export type NoteStatus = "pending" | "approved" | "collecting";

export interface NotePage {
  fileId: string;
  messageId: number;
  mimeType: string;
  size: number;
  fileName: string;
}

export interface Note {
  id: string;
  title: string;
  subjectId: string | null;
  pages: (NotePage | null)[]; // null = page still transferring
  expectedPages?: number; // present while status is "collecting"
  status: NoteStatus;
  uploadedAt: number;
}

export interface Group {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  groupId: string | null;
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // Telegram getFile limit
export const DIRECT_UPLOAD_LIMIT = 4 * 1024 * 1024; // stay under Vercel's 4.5 MB request body cap
export const MAX_PAGES = 50;

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
