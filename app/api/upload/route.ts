import { DIRECT_UPLOAD_LIMIT, isAllowedMime, MAX_FILE_BYTES } from "@/lib/types";
import { storeFileAsNote } from "@/lib/upload";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  const title = (form.get("title") as string | null) ?? "";

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (!isAllowedMime(file.type)) {
    return Response.json(
      { error: "Only image (JPEG, PNG, WebP, GIF) and PDF files are allowed" },
      { status: 415 }
    );
  }
  if (file.size > DIRECT_UPLOAD_LIMIT) {
    return Response.json(
      { error: "File too large for direct upload; use the chunked upload path" },
      { status: 413 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "File exceeds the 20 MB limit" }, { status: 413 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const note = await storeFileAsNote(
      buffer,
      file.name,
      file.type,
      file.size,
      title || file.name
    );
    return Response.json({ note });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
