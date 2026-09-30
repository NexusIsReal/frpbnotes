"use client";

import { useCallback, useEffect, useState } from "react";
import type { Note } from "@/lib/types";

interface Group {
  id: string;
  name: string;
}
interface Subject {
  id: string;
  name: string;
  groupId: string | null;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function Gallery() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filter, setFilter] = useState<string>("all"); // "all" | "group:<id>" | "subject:<id>"
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Note | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [notesRes, taxonomyRes] = await Promise.all([
        fetch("/api/notes", { cache: "no-store" }),
        fetch("/api/taxonomy", { cache: "no-store" }),
      ]);
      const notesJson = (await notesRes.json()) as { notes?: Note[] };
      const taxonomyJson = (await taxonomyRes.json()) as {
        groups?: Group[];
        subjects?: Subject[];
      };
      setNotes(notesJson.notes ?? []);
      setGroups(taxonomyJson.groups ?? []);
      setSubjects(taxonomyJson.subjects ?? []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch on mount; setState happens after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const onChange = () => refresh();
    window.addEventListener("rmhub:notes-changed", onChange);
    return () => window.removeEventListener("rmhub:notes-changed", onChange);
  }, [refresh]);

  const subjectIdsInGroup = (groupId: string) =>
    new Set(subjects.filter((s) => s.groupId === groupId).map((s) => s.id));

  const visible = notes.filter((note) => {
    if (filter === "all") return true;
    const [kind, id] = filter.split(":");
    if (kind === "subject") return note.subjectId === id;
    return subjectIdsInGroup(id).has(note.subjectId ?? "");
  });

  const subjectNameOf = (id: string | null) =>
    id ? subjects.find((s) => s.id === id)?.name : null;

  return (
    <section className="flex flex-col gap-6 md:flex-row">
      {/* Filter sidebar */}
      <aside className="md:w-52 md:shrink-0">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
          Browse
        </h2>
        <nav className="space-y-1">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
            All notes ({notes.length})
          </FilterButton>
          {groups.map((group) => {
            const groupSubjects = subjects.filter((s) => s.groupId === group.id);
            return (
              <div key={group.id}>
                <FilterButton
                  active={filter === `group:${group.id}`}
                  onClick={() => setFilter(`group:${group.id}`)}
                  bold
                >
                  {group.name}
                </FilterButton>
                <div className="ml-3">
                  {groupSubjects.map((subject) => (
                    <FilterButton
                      key={subject.id}
                      active={filter === `subject:${subject.id}`}
                      onClick={() => setFilter(`subject:${subject.id}`)}
                    >
                      {subject.name}
                    </FilterButton>
                  ))}
                </div>
              </div>
            );
          })}
          {subjects
            .filter((s) => !s.groupId)
            .map((subject) => (
              <FilterButton
                key={subject.id}
                active={filter === `subject:${subject.id}`}
                onClick={() => setFilter(`subject:${subject.id}`)}
              >
                {subject.name}
              </FilterButton>
            ))}
        </nav>
      </aside>

      {/* Notes grid */}
      <div className="min-w-0 flex-1">
        {loading ? (
          <p className="py-10 text-center text-sm text-foreground/40">Loading notes…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-foreground/40">
            No notes here yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {visible.map((note) => {
              const firstPage = note.pages.find(Boolean);
              return (
                <button
                  key={note.id}
                  onClick={() => setPreview(note)}
                  className="group overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-accent"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-background">
                    {firstPage?.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/file/${note.id}`}
                        alt={note.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-foreground/30">
                        <svg
                          className="h-10 w-10"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                          />
                        </svg>
                        <span className="text-xs font-medium">PDF</span>
                      </div>
                    )}
                    {note.pages.length > 1 && (
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs text-white">
                        {note.pages.length} pages
                      </span>
                    )}
                  </div>
                  <div className="border-t border-border px-3 py-2">
                    <p className="truncate text-sm font-medium">{note.title}</p>
                    <p className="truncate text-xs text-foreground/40">
                      {subjectNameOf(note.subjectId) ?? "Uncategorized"} ·{" "}
                      {formatSize(note.pages.reduce((sum, p) => sum + (p?.size ?? 0), 0))}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {preview && <PreviewModal note={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

function FilterButton({
  active,
  bold,
  children,
  onClick,
}: {
  active: boolean;
  bold?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
        active
          ? "bg-accent/15 text-accent"
          : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
      } ${bold ? "font-semibold" : ""}`}
    >
      {children}
    </button>
  );
}

function PreviewModal({ note, onClose }: { note: Note; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const pageCount = note.pages.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setPage((p) => Math.min(p + 1, pageCount - 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pageCount]);

  const currentPage = note.pages[Math.min(page, pageCount - 1)];

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
              {currentPage?.fileName} · {formatSize(currentPage?.size ?? 0)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/api/file/${note.id}?page=${page}&download=1`}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Download page
            </a>
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/60 transition hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto bg-background">
          {currentPage?.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/file/${note.id}?page=${page}`}
              alt={note.title}
              className="mx-auto max-h-[70vh] w-auto"
            />
          ) : (
            <iframe
              src={`/api/file/${note.id}?page=${page}`}
              title={note.title}
              className="h-[70vh] w-full"
            />
          )}
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={page === 0}
              className="rounded-lg border border-border px-3 py-1 text-xs text-foreground/70 transition hover:text-foreground disabled:opacity-30"
            >
              ← Prev
            </button>
            <span className="text-xs text-foreground/50">
              Page {page + 1} of {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, pageCount - 1))}
              disabled={page === pageCount - 1}
              className="rounded-lg border border-border px-3 py-1 text-xs text-foreground/70 transition hover:text-foreground disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
