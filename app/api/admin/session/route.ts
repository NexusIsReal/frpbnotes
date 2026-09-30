import { isAdminAuthenticated, signInAdmin, signOutAdmin } from "@/lib/admin";

export async function GET() {
  return Response.json({ authenticated: await isAdminAuthenticated() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password) {
    return Response.json({ error: "Password is required" }, { status: 400 });
  }
  const ok = await signInAdmin(body.password);
  if (!ok) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }
  return Response.json({ authenticated: true });
}

export async function DELETE() {
  await signOutAdmin();
  return Response.json({ authenticated: false });
}
