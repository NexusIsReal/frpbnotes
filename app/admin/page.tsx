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

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Note[]>([]);
  const [approved, setApproved] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [pendingRes, approvedRes, taxonomyRes] = await Promise.all([
      fetch("/api/notes?status=pending", { cache: "no-store" }),
      fetch("/api/notes?status=approved", { cache: "no-store" }),
      fetch("/api/taxonomy", { cache: "no-store" }),
    ]);
    if (pendingRes.status === 401) {
      setAuthed(false);
      return;
    }
    const pendingJson = (await pendingRes.json()) as { notes?: Note[] };
    const approvedJson = (await approvedRes.json()) as { notes?: Note[] };
    const taxonomyJson = (await taxonomyRes.json()) as {
      groups?: Group[];
      subjects?: Subject[];
    };
    setPending(pendingJson.notes ?? []);
    setApproved(approvedJson.notes ?? []);
    setGroups(taxonomyJson.groups ?? []);
    setSubjects(taxonomyJson.subjects ?? []);
    setAuthed(true);
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session", { cache: "no-store" });
      const json = (await res.json()) as { authenticated: boolean };
      if (json.authenticated) await refresh();
      else setAuthed(false);
    } catch {
      setAuthed(false);
    }
  }, [refresh]);

  useEffect(() => {
    // Initial session check on mount; setState happens after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkSession();
  }, [checkSession]);

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
      <form
        onSubmit={login}
        className="mx-auto mt-16 max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6"
      >
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

  const subjectNameOf = (id: string | null) =>
    id ? subjects.find((s) => s.id === id)?.name ?? "Unknown subject" : null;

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

      <TaxonomyManager
        groups={groups}
        subjects={subjects}
        onChanged={refresh}
      />

      <NoteList
        heading={`Pending verification (${pending.length})`}
        notes={pending}
        subjectNameOf={subjectNameOf}
        emptyText="No notes waiting for verification."
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
        subjectNameOf={subjectNameOf}
        emptyText="No published notes yet."
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

function TaxonomyManager({
  groups,
  subjects,
  onChanged,
}: {
  groups: Group[];
  subjects: Subject[];
  onChanged: () => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectGroup, setSubjectGroup] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function create(kind: "group" | "subject") {
    setError(null);
    const res = await fetch("/api/taxonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        name: kind === "group" ? groupName : subjectName,
        groupId: kind === "subject" ? subjectGroup || null : undefined,
      }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "Failed to create");
      return;
    }
    setGroupName("");
    setSubjectName("");
    onChanged();
  }

  async function remove(kind: "group" | "subject", id: string) {
    await fetch(`/api/taxonomy?kind=${kind}&id=${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-foreground/50">
        Groups & subjects
      </h2>
      <p className="mb-4 text-xs text-foreground/40">
        Groups are broad categories; subjects live inside a group and hold the notes.
        Deleting a group keeps its subjects (they become groupless); deleting a
        subject leaves its notes uncategorized.
      </p>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex flex-1 gap-2">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="New group name (e.g. Science)"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-foreground/30 focus:border-accent"
          />
          <button
            onClick={() => create("group")}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Add group
          </button>
        </div>
        <div className="flex flex-1 gap-2">
          <input
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="New subject name (e.g. Physics)"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-foreground/30 focus:border-accent"
          />
          <select
            value={subjectGroup}
            onChange={(e) => setSubjectGroup(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => create("subject")}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Add subject
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-foreground/40">Groups</p>
          {groups.length === 0 ? (
            <p className="text-sm text-foreground/30">None yet.</p>
          ) : (
            <ul className="space-y-1">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <span>{g.name}</span>
                  <button
                    onClick={() => remove("group", g.id)}
                    className="text-xs text-foreground/40 hover:text-accent"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-foreground/40">Subjects</p>
          {subjects.length === 0 ? (
            <p className="text-sm text-foreground/30">None yet.</p>
          ) : (
            <ul className="space-y-1">
              {subjects.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {s.name}
                    {s.groupId && (
                      <span className="text-foreground/40">
                        {" "}
                        · {groups.find((g) => g.id === s.groupId)?.name ?? "no group"}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => remove("subject", s.id)}
                    className="text-xs text-foreground/40 hover:text-accent"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function NoteList({
  heading,
  notes,
  subjectNameOf,
  emptyText,
  actions,
}: {
  heading: string;
  notes: Note[];
  subjectNameOf: (id: string | null) => string | null;
  emptyText: string;
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
                {note.pages[0]?.mimeType.startsWith("image/") || !note.pages[0] ? "IMG" : "PDF"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {note.title}
                  {note.pages.length > 1 && (
                    <span className="ml-2 rounded-md bg-foreground/10 px-1.5 py-0.5 text-xs text-foreground/60">
                      {note.pages.length} pages
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-foreground/40">
                  {subjectNameOf(note.subjectId) ?? "Uncategorized"} ·{" "}
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
