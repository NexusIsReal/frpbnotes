"use client";

import { useEffect, useRef, useState } from "react";
import {
  DIRECT_UPLOAD_LIMIT,
  MAX_FILE_BYTES,
  MAX_PAGES,
  isAllowedMime,
} from "@/lib/types";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

interface Subject {
  id: string;
  name: string;
  groupId: string | null;
}
interface Group {
  id: string;
  name: string;
}

export default function UploadCard() {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/taxonomy", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { groups?: Group[]; subjects?: Subject[] }) => {
        setGroups(j.groups ?? []);
        setSubjects(j.subjects ?? []);
      })
      .catch(() => {});
  }, []);

  function addFiles(incoming: FileList | null) {
    setError(null);
    setDone(false);
    if (!incoming) return;
    setFiles((prev) => [...prev, ...Array.from(incoming)].slice(0, MAX_PAGES));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function moveFile(index: number, dir: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function validate(): string | null {
    for (const file of files) {
      if (!isAllowedMime(file.type)) {
        return `"${file.name}" is not an allowed type (JPEG, PNG, WebP, GIF, PDF).`;
      }
      if (file.size > MAX_FILE_BYTES) {
        return `"${file.name}" exceeds the 20 MB per-page limit.`;
      }
    }
    return null;
  }

  async function handleUpload() {
    if (files.length === 0 || uploading) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    setDone(false);
    const effectiveTitle = title.trim();

    try {
      const large = files.filter((f) => f.size > DIRECT_UPLOAD_LIMIT);

      if (large.length === 0) {
        // Everything fits the direct path: one request with all pages.
        const form = new FormData();
        for (const file of files) form.append("files", file);
        form.set("title", effectiveTitle);
        if (subjectId) form.set("subjectId", subjectId);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
      } else {
        // Mixed/large pages: upload each page directly to Vercel Blob (transient
        // staging); server callbacks assemble the note and transfer to Telegram.
        const noteId = crypto.randomUUID();
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProgress(`Uploading page ${i + 1} of ${files.length}…`);
          const { upload } = await import("@vercel/blob/client");
          await upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/upload/token",
            contentType: file.type,
            clientPayload: JSON.stringify({
              noteId,
              title: effectiveTitle || files[0].name.replace(/\.[^.]+$/, ""),
              subjectId: subjectId || null,
              pageIndex: i,
              pageCount: files.length,
            }),
          });
        }
      }

      setDone(true);
      setFiles([]);
      setTitle("");
      setSubjectId("");
      if (inputRef.current) inputRef.current.value = "";
      window.dispatchEvent(new Event("rmhub:notes-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress("");
      setUploading(false);
    }
  }

  const groupNameOf = (groupId: string | null) =>
    groups.find((g) => g.id === groupId)?.name;

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <h2 className="mb-1 text-lg font-semibold">Upload a note</h2>
      <p className="mb-4 text-xs text-foreground/40">
        Select multiple files to make a multi-page note. Pages upload in the order shown.
      </p>

      <div
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragging ? "border-accent bg-accent/5" : "border-border hover:border-foreground/30"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <svg
          className="h-8 w-8 text-foreground/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm text-foreground/70">
          Drag & drop images or PDFs here, or click to browse
        </p>
        <p className="text-xs text-foreground/30">
          Max 20 MB per page · up to {MAX_PAGES} pages · verified before publishing
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              <span className="w-5 text-xs text-foreground/40">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="text-xs text-foreground/30">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </span>
              <button
                onClick={() => moveFile(i, -1)}
                disabled={i === 0}
                className="px-1 text-foreground/40 hover:text-foreground disabled:opacity-20"
                title="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => moveFile(i, 1)}
                disabled={i === files.length - 1}
                className="px-1 text-foreground/40 hover:text-foreground disabled:opacity-20"
                title="Move down"
              >
                ↓
              </button>
              <button
                onClick={() => removeFile(i)}
                className="px-1 text-foreground/40 hover:text-accent"
                title="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title (optional — defaults to first file name)"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-foreground/30 focus:border-accent"
          />
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">No subject</option>
            {groups.map((group) => (
              <optgroup key={group.id} label={group.name}>
                {subjects
                  .filter((s) => s.groupId === group.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
            {subjects
              .filter((s) => !s.groupId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {groupNameOf(null) ? s.name : `• ${s.name}`}
                </option>
              ))}
          </select>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? progress || "Uploading…" : "Submit note"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      {done && (
        <p className="mt-3 text-sm text-emerald-400">
          Note uploaded and stored — it will appear here after an admin verifies it.
        </p>
      )}
    </section>
  );
}
