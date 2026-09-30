import { getNote } from "@/lib/store";
import { getFileDownloadUrl } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Streams one page of a note out of the Telegram storage channel.
 * Query: ?page=N (0-based, default 0), ?download=1 for attachment disposition.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/file/[id]">
) {
  const { id } = await params;
  const url = new URL(request.url);
  const pageIndex = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
  const note = await getNote(id);
  if (!note) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }
  const page = note.pages[pageIndex];
  if (!page) {
    return Response.json({ error: "Page not found" }, { status: 404 });
  }

  try {
    const downloadUrl = await getFileDownloadUrl(page.fileId);
    const upstream = await fetch(downloadUrl);
    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: "Failed to fetch file from Telegram" }, { status: 502 });
    }

    const download = url.searchParams.get("download") === "1";
    const disposition = download ? "attachment" : "inline";

    return new Response(upstream.body, {
      headers: {
        "Content-Type": page.mimeType,
        "Content-Length": String(page.size),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(page.fileName)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File retrieval failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
