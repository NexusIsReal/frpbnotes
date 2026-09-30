import { cookies } from "next/headers";

export const ADMIN_COOKIE = "rmhub_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function expectedToken(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is not configured");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`rmhub-admin-session:${password}`)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === (await expectedToken());
}

export async function signInAdmin(password: string): Promise<boolean> {
  const password_ = process.env.ADMIN_PASSWORD;
  if (!password_ || password !== password_) return false;
  const store = await cookies();
  store.set(ADMIN_COOKIE, await expectedToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return true;
}

export async function signOutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
