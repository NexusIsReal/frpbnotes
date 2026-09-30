"use client";

import { useCallback, useEffect, useState } from "react";
import type { Note } from "@/lib/types";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Note[]>([]);
  const [approved, setApproved] = useState<Note[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [pendingRes, approvedRes] = await Promise.all([
      fetch("/api/notes?status=pending", { cache: "no-store" }),
      fetch("/api/notes?status=approved", { cache: "no-store" }),
    ]);
    if (pendingRes.status === 401) {
      setAuthed(false);
      return;
    }
    const pendingJson = (await pendingRes.json()) as { notes?: Note[] };
    const approvedJson = (await approvedRes.json()) as { notes?: Note[] };
    setPending(pendingJson.notes ?? []);
    setApproved(approvedJson.notes ?? []);
    setAuthed(true);
  }, []);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { authenticated: boolean }) => {
        if (j.authenticated) refresh();
        else setAuthed(false);
      })
      .catch(() => setAuthed(false));
  }, [refresh]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "Login failed");
      return;
    }
    setPassword("");
    refresh();
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthed(false);
    setPending([]);
    setApproved([]);
  }

  async function approve(id: string) {
    setBusy(id);
    await fetch(`/api/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    setBusy(null);
    refresh();
  }

  async function reject(id: string) {
    setBusy(id);
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setBusy(null);
    refresh();
  }

  if (authed === null) {
    return <p className="py-16 text-center text-sm text-foreground/40">Loading…</p>;
  }

  if (!authed) {
    return (
      <form onSubmit={login} className="mx-auto mt-16 max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Admin sign in</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          autoFocus
        />
        {error && <p className="text-sm text-accent">{error}</p>}
        <button className="w-full rounded-lg bg-accent py-2 text-sm font-semibold text-white transition hover:opacity-90">
          Sign in
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin dashboard</h1>
        <button
          onClick={logout}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground/60 transition hover:text-foreground"
        >
          Log out
        </button>
      </div>

      <NoteList
        heading={`Pending verification (${pending.length})`}
        notes={pending}
        emptyText="No notes waiting for verification."
        busy={busy}
        actions={(note) => (
          <>
            <button
              onClick={() => approve(note.id)}
              disabled={busy === note.id}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => reject(note.id)}
              disabled={busy === note.id}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/60 transition hover:border-accent hover:text-accent disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
      />

      <NoteList
        heading={`Published notes (${approved.length})`}
        notes={approved}
        emptyText="No published notes yet."
        busy={busy}
        actions={(note) => (
          <button
            onClick={() => reject(note.id)}
            disabled={busy === note.id}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/60 transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Delete
          </button>
        )}
      />
    </div>
  );
}

function NoteList({
  heading,
  notes,
  emptyText,
  busy,
  actions,
}: {
  heading: string;
  notes: Note[];
  emptyText: string;
  busy: string | null;
  actions: (note: Note) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/50">
        {heading}
      </h2>
      {notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-foreground/40">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-xs font-medium text-foreground/50">
                {note.mimeType.startsWith("image/") ? "IMG" : "PDF"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{note.title}</p>
                <p className="truncate text-xs text-foreground/40">
                  {note.fileName} · {(note.size / (1024 * 1024)).toFixed(2)} MB ·{" "}
                  {new Date(note.uploadedAt).toLocaleString()}
                </p>
              </div>
              <a
                href={`/api/file/${note.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/60 transition hover:text-foreground"
              >
                View
              </a>
              {actions(note)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
