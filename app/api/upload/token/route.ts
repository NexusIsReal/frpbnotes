import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { collectPageFromBlob, sendPage } from "@/lib/upload";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface PagePayload {
  noteId: string;
  title: string;
  subjectId: string | null;
  pageIndex: number;
  pageCount: number;
}

/**
 * Large-file client-upload flow: the browser uploads each page directly to
 * Vercel Blob (transient staging), then this route moves it into the Telegram
 * storage channel and deletes the blob. Pages accumulate into one note.
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
        let meta: PagePayload;
        try {
          meta = JSON.parse(tokenPayload ?? "{}") as PagePayload;
        } catch {
          meta = { noteId: crypto.randomUUID(), title: blob.pathname, subjectId: null, pageIndex: 0, pageCount: 1 };
        }
        try {
          const res = await fetch(blob.url);
          if (!res.ok) throw new Error(`Failed to download staged blob: ${res.status}`);
          const buffer = await res.arrayBuffer();
          const fileName = blob.pathname.split("/").pop() || "page";
          const page = await sendPage(buffer, fileName, blob.contentType, meta.title);
          await collectPageFromBlob(meta, page);
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
