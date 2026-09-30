import type { Note, NoteStatus } from "./types";

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const NOTES_HASH = "rmhub:notes";

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

export async function createNote(note: Note): Promise<void> {
  await redis("HSET", NOTES_HASH, note.id, JSON.stringify(note));
}

export async function getNote(id: string): Promise<Note | null> {
  const raw = await redis("HGET", NOTES_HASH, id);
  if (typeof raw !== "string") return null;
  return JSON.parse(raw) as Note;
}

export async function listNotes(status: NoteStatus): Promise<Note[]> {
  const values = await redis("HVALS", NOTES_HASH);
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => JSON.parse(String(v)) as Note)
    .filter((n) => n.status === status)
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function updateNoteStatus(id: string, status: NoteStatus): Promise<Note | null> {
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
