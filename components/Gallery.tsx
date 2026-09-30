"use client";

import { useCallback, useEffect, useState } from "react";
import type { Note } from "@/lib/types";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function Gallery() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Note | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notes", { cache: "no-store" });
      const json = (await res.json()) as { notes?: Note[] };
      setNotes(json.notes ?? []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("rmhub:notes-changed", onChange);
    return () => window.removeEventListener("rmhub:notes-changed", onChange);
  }, [refresh]);

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Verified notes</h2>
        <span className="text-xs text-foreground/40">{notes.length} note(s)</span>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-foreground/40">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-foreground/40">
          No verified notes yet — be the first to upload one.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => setPreview(note)}
              className="group overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-accent"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-background">
                {note.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/file/${note.id}`}
                    alt={note.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-foreground/30">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                      />
                    </svg>
                    <span className="text-xs font-medium">PDF</span>
                  </div>
                )}
              </div>
              <div className="border-t border-border px-3 py-2">
                <p className="truncate text-sm font-medium">{note.title}</p>
                <p className="text-xs text-foreground/40">
                  {new Date(note.uploadedAt).toLocaleDateString()} · {formatSize(note.size)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {preview && <PreviewModal note={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

function PreviewModal({ note, onClose }: { note: Note; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{note.title}</p>
            <p className="text-xs text-foreground/40">
              {note.fileName} · {formatSize(note.size)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/api/file/${note.id}?download=1`}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Download
            </a>
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/60 transition hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-background">
          {note.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/file/${note.id}`} alt={note.title} className="mx-auto max-h-[75vh] w-auto" />
          ) : (
            <iframe src={`/api/file/${note.id}`} title={note.title} className="h-[75vh] w-full" />
          )}
        </div>
      </div>
    </div>
  );
}
