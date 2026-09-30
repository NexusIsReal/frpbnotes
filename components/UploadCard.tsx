"use client";

import { useRef, useState } from "react";
import { DIRECT_UPLOAD_LIMIT, MAX_FILE_BYTES, isAllowedMime } from "@/lib/types";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

export default function UploadCard() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(next: File | null) {
    setError(null);
    setDone(false);
    setFile(next);
  }

  function validate(f: File): string | null {
    if (!isAllowedMime(f.type)) {
      return "Only JPEG, PNG, WebP, GIF images and PDF files are allowed.";
    }
    if (f.size > MAX_FILE_BYTES) {
      return "File is larger than the 20 MB limit.";
    }
    return null;
  }

  async function handleUpload() {
    if (!file || uploading) return;
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    setDone(false);

    try {
      const effectiveTitle = title.trim() || file.name.replace(/\.[^.]+$/, "");

      if (file.size <= DIRECT_UPLOAD_LIMIT) {
        // Small files go straight through our server to Telegram.
        const form = new FormData();
        form.set("file", file);
        form.set("title", effectiveTitle);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
      } else {
        // Large files: browser uploads directly to Vercel Blob (transient staging),
        // then the server transfers the file to Telegram and deletes the blob.
        const { upload } = await import("@vercel/blob/client");
        await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload/token",
          contentType: file.type,
          clientPayload: JSON.stringify({ title: effectiveTitle }),
        });
      }

      setDone(true);
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      window.dispatchEvent(new Event("rmhub:notes-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

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
        pick(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <h2 className="mb-4 text-lg font-semibold">Upload a note</h2>

      <div
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
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
          {file ? file.name : "Drag & drop an image or PDF here, or click to browse"}
        </p>
        {file && (
          <p className="text-xs text-foreground/40">
            {(file.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        )}
        <p className="text-xs text-foreground/30">Max 20 MB · verified before publishing</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </div>

      {file && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title (optional — defaults to file name)"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-foreground/30 focus:border-accent"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Submit note"}
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
