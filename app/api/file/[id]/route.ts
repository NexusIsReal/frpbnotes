import { getNote } from "@/lib/store";
import { getFileDownloadUrl } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Streams a note's file out of the Telegram storage channel.
 * The Telegram download URL is temporary, so it is fetched and passed through here.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/file/[id]">
) {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  try {
    const downloadUrl = await getFileDownloadUrl(note.telegramFileId);
    const upstream = await fetch(downloadUrl);
    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: "Failed to fetch file from Telegram" }, { status: 502 });
    }

    const download = new URL(request.url).searchParams.get("download") === "1";
    const disposition = download ? "attachment" : "inline";

    return new Response(upstream.body, {
      headers: {
        "Content-Type": note.mimeType,
        "Content-Length": String(note.size),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(note.fileName)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File retrieval failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
