import { isAdminAuthenticated } from "@/lib/admin";
import { deleteNote, updateNoteStatus } from "@/lib/store";
import { deleteTelegramMessage } from "@/lib/telegram";

/** Approve a pending note (admin only). */
export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/notes/[id]">
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (body?.status !== "approved") {
    return Response.json({ error: "Body must be { status: \"approved\" }" }, { status: 400 });
  }
  const note = await updateNoteStatus(id, "approved");
  if (!note) return Response.json({ error: "Note not found" }, { status: 404 });
  return Response.json({ note });
}

/** Reject/delete a note: removes every page from the index and the Telegram channel (admin only). */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/notes/[id]">
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const note = await deleteNote(id);
  if (!note) return Response.json({ error: "Note not found" }, { status: 404 });
  for (const page of note.pages) {
    if (page) await deleteTelegramMessage(page.messageId);
  }
  return Response.json({ deleted: true });
}
