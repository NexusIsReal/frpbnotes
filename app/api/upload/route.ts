import { DIRECT_UPLOAD_LIMIT, isAllowedMime, MAX_FILE_BYTES, MAX_PAGES } from "@/lib/types";
import { storePagesAsNote } from "@/lib/upload";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Direct upload path (each file ≤ 4 MB): all pages of one note in a single request. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const title = (form.get("title") as string | null) ?? "";
  const subjectId = (form.get("subjectId") as string | null) || null;

  if (files.length === 0) {
    return Response.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > MAX_PAGES) {
    return Response.json({ error: `A note can have at most ${MAX_PAGES} pages` }, { status: 400 });
  }
  for (const file of files) {
    if (!isAllowedMime(file.type)) {
      return Response.json(
        { error: `"${file.name}": only images (JPEG, PNG, WebP, GIF) and PDF files are allowed` },
        { status: 415 }
      );
    }
    if (file.size > DIRECT_UPLOAD_LIMIT) {
      return Response.json(
        { error: `"${file.name}" is too large for direct upload; use the large-file path` },
        { status: 413 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: `"${file.name}" exceeds the 20 MB limit` }, { status: 413 });
    }
  }

  try {
    const pages = [];
    for (const file of files) {
      pages.push({ buffer: await file.arrayBuffer(), fileName: file.name, mimeType: file.type });
    }
    const note = await storePagesAsNote(pages, title, subjectId);
    return Response.json({ note });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
