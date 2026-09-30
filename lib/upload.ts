import { randomUUID } from "node:crypto";
import { addPageToNote, createNote } from "./store";
import { sendDocumentToChannel } from "./telegram";
import type { Note, NotePage } from "./types";

export async function sendPage(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  title: string
): Promise<NotePage> {
  const { fileId, messageId } = await sendDocumentToChannel(
    buffer,
    fileName,
    mimeType,
    title
  );
  return { fileId, messageId, mimeType, size: buffer.byteLength, fileName };
}

/** Direct path (files ≤ 4 MB each): uploads every page, then records the note at once. */
export async function storePagesAsNote(
  files: { buffer: ArrayBuffer; fileName: string; mimeType: string }[],
  title: string,
  subjectId: string | null
): Promise<Note> {
  const note: Note = {
    id: randomUUID(),
    title: title.trim(),
    subjectId,
    pages: [],
    status: "pending",
    uploadedAt: Date.now(),
  };
  for (const file of files) {
    note.pages.push(await sendPage(file.buffer, file.fileName, file.mimeType, title));
  }
  if (!note.title) note.title = note.pages[0]?.fileName ?? "Untitled note";
  await createNote(note);
  return note;
}

/**
 * Blob path (any file > 4 MB): each file arrives via its own upload callback.
 * Pages are appended to a "collecting" note; once all pages arrive it becomes
 * "pending" and shows up in the admin verification queue.
 */
export async function collectPageFromBlob(
  meta: { noteId: string; title: string; subjectId: string | null; pageIndex: number; pageCount: number },
  page: NotePage
): Promise<Note> {
  return addPageToNote(
    { id: meta.noteId, title: meta.title, subjectId: meta.subjectId, uploadedAt: Date.now() },
    meta.pageIndex,
    meta.pageCount,
    page
  );
}
