import { isAdminAuthenticated } from "@/lib/admin";
import { listNotes } from "@/lib/store";
import type { NoteStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") ?? "approved";
  if (status !== "approved" && status !== "pending") {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }
  if (status === "pending" && !(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const notes = await listNotes(status as NoteStatus);
    return Response.json({ notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notes";
    return Response.json({ error: message }, { status: 500 });
  }
}
