import type { Group, Note, NotePage, Subject } from "./types";

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const NOTES_HASH = "rmhub:notes";
const GROUPS_HASH = "rmhub:groups";
const SUBJECTS_HASH = "rmhub:subjects";

function requireRedis(): { url: string; token: string } {
  if (!REST_URL || !REST_TOKEN) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured");
  }
  return { url: REST_URL, token: REST_TOKEN };
}

async function redis(...args: (string | number)[]): Promise<unknown> {
  const { url, token } = requireRedis();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args.map(String)),
  });
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(`Redis error: ${json.error}`);
  return json.result;
}

/** Backward compatibility: notes created before multi-page support had one file at the top level. */
function normalizeNote(raw: Note & { telegramFileId?: string; messageId?: number; fileName?: string; mimeType?: string; size?: number }): Note {
  if (!Array.isArray(raw.pages)) {
    raw.pages = raw.telegramFileId
      ? [
          {
            fileId: raw.telegramFileId,
            messageId: raw.messageId ?? 0,
            mimeType: raw.mimeType ?? "application/octet-stream",
            size: raw.size ?? 0,
            fileName: raw.fileName ?? "file",
          },
        ]
      : [];
  }
  if (raw.subjectId === undefined) raw.subjectId = null;
  return raw as Note;
}

async function hashValues<T>(hash: string, normalize?: (value: Note) => T): Promise<T[]> {
  const values = await redis("HVALS", hash);
  if (!Array.isArray(values)) return [];
  return values.map((v) => {
    const parsed = JSON.parse(String(v)) as Note;
    return normalize ? normalize(parsed) : (parsed as T);
  });
}

/* ---------- Notes ---------- */

export async function createNote(note: Note): Promise<void> {
  await redis("HSET", NOTES_HASH, note.id, JSON.stringify(note));
}

export async function getNote(id: string): Promise<Note | null> {
  const raw = await redis("HGET", NOTES_HASH, id);
  if (typeof raw !== "string") return null;
  return normalizeNote(JSON.parse(raw));
}

export async function listNotes(status: Note["status"]): Promise<Note[]> {
  const notes = await hashValues<Note>(NOTES_HASH, normalizeNote);
  return notes
    .filter((n) => n.status === status)
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function updateNoteStatus(id: string, status: Note["status"]): Promise<Note | null> {
  const note = await getNote(id);
  if (!note) return null;
  note.status = status;
  await redis("HSET", NOTES_HASH, id, JSON.stringify(note));
  return note;
}

export async function deleteNote(id: string): Promise<Note | null> {
  const note = await getNote(id);
  if (!note) return null;
  await redis("HDEL", NOTES_HASH, id);
  return note;
}

/**
 * Appends one page to a note during a multi-file upload. When all expected
 * pages have arrived, the note becomes "pending" (ready for admin review).
 */
export async function addPageToNote(
  meta: { id: string; title: string; subjectId: string | null; uploadedAt: number },
  index: number,
  expectedPages: number,
  page: NotePage
): Promise<Note> {
  const existing = await getNote(meta.id);
  const note: Note =
    existing ??
    {
      ...meta,
      pages: [],
      expectedPages,
      status: "collecting",
    };
  note.pages[index] = page;
  if (!note.title) note.title = meta.title;
  if (note.subjectId === undefined) note.subjectId = meta.subjectId;

  const filled = note.pages.filter(Boolean).length;
  if (note.expectedPages !== undefined && filled >= note.expectedPages) {
    note.pages = note.pages.map((p) => p!);
    delete note.expectedPages;
    note.status = "pending";
  }
  await redis("HSET", NOTES_HASH, note.id, JSON.stringify(note));
  return note;
}

/* ---------- Groups & Subjects ---------- */

export async function createGroup(group: Group): Promise<void> {
  await redis("HSET", GROUPS_HASH, group.id, JSON.stringify(group));
}

export async function listGroups(): Promise<Group[]> {
  const groups = await hashValues<Group>(GROUPS_HASH);
  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteGroup(id: string): Promise<void> {
  await redis("HDEL", GROUPS_HASH, id);
  // Subjects in this group become groupless but are not deleted.
  const subjects = await hashValues<Subject>(SUBJECTS_HASH);
  for (const subject of subjects.filter((s) => s.groupId === id)) {
    subject.groupId = null;
    await redis("HSET", SUBJECTS_HASH, subject.id, JSON.stringify(subject));
  }
}

export async function createSubject(subject: Subject): Promise<void> {
  await redis("HSET", SUBJECTS_HASH, subject.id, JSON.stringify(subject));
}

export async function listSubjects(): Promise<Subject[]> {
  const subjects = await hashValues<Subject>(SUBJECTS_HASH);
  return subjects.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteSubject(id: string): Promise<void> {
  await redis("HDEL", SUBJECTS_HASH, id);
  // Notes in this subject become uncategorized but are not deleted.
  const notes = await hashValues<Note>(NOTES_HASH);
  for (const note of notes.filter((n) => n.subjectId === id)) {
    note.subjectId = null;
    await redis("HSET", NOTES_HASH, note.id, JSON.stringify(note));
  }
}
