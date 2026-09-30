import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { storeFileAsNote } from "@/lib/upload";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Handles the client-upload flow for files larger than Vercel's 4.5 MB
 * request-body limit: the browser uploads directly to Vercel Blob, then this
 * route moves the file into the Telegram storage channel and deletes the blob.
 * Blob is only a transient staging buffer — Telegram is the sole permanent store.
 */
export async function POST(request: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "Large-file uploads require Vercel Blob to be configured (BLOB_READ_WRITE_TOKEN)" },
      { status: 501 }
    );
  }

  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => ({
        allowedContentTypes: [...ALLOWED_MIME_TYPES],
        maximumSizeInBytes: MAX_FILE_BYTES,
        addRandomSuffix: true,
        tokenPayload: clientPayload ?? "",
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let title = blob.pathname.split("/").pop() ?? "Untitled note";
        try {
          const parsed = JSON.parse(tokenPayload ?? "{}") as { title?: string };
          if (parsed.title?.trim()) title = parsed.title.trim();
        } catch {
          // keep filename as title
        }
        try {
          const res = await fetch(blob.url);
          if (!res.ok) throw new Error(`Failed to download staged blob: ${res.status}`);
          const buffer = await res.arrayBuffer();
          await storeFileAsNote(
            buffer,
            title,
            blob.contentType,
            buffer.byteLength,
            title
          );
        } finally {
          await del(blob.url).catch(() => {});
        }
      },
    });
    return Response.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload setup failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
