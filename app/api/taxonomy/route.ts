import { isAdminAuthenticated } from "@/lib/admin";
import { createGroup, createSubject, deleteGroup, deleteSubject, listGroups, listSubjects } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Public: gallery needs groups + subjects to build its filter sidebar. */
export async function GET() {
  try {
    const [groups, subjects] = await Promise.all([listGroups(), listSubjects()]);
    return Response.json({ groups, subjects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load taxonomy";
    return Response.json({ error: message }, { status: 500 });
  }
}

function randomId(): string {
  return crypto.randomUUID();
}

/** Admin: create a group or subject. Body: { kind: "group"|"subject", name, groupId? } */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { kind?: string; name?: string; groupId?: string | null }
    | null;
  if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });

  if (body.kind === "group") {
    const group = { id: randomId(), name };
    await createGroup(group);
    return Response.json({ group });
  }
  if (body.kind === "subject") {
    const subject = { id: randomId(), name, groupId: body.groupId || null };
    await createSubject(subject);
    return Response.json({ subject });
  }
  return Response.json({ error: "kind must be group or subject" }, { status: 400 });
}

/** Admin: delete a group or subject by id. Query: ?kind=group|subject&id=... */
export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const id = params.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  if (kind === "group") await deleteGroup(id);
  else if (kind === "subject") await deleteSubject(id);
  else return Response.json({ error: "kind must be group or subject" }, { status: 400 });

  return Response.json({ deleted: true });
}
