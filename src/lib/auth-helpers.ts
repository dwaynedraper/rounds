import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userBrands } from "@/db/auth-schema";

export type Role = "admin" | "editor";
export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Current signed-in CMS user, or null. Role comes from the user row. */
export async function getSessionUser(): Promise<AppUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as { id: string; email: string; name?: string | null; role?: string };
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? "",
    role: u.role === "admin" ? "admin" : "editor",
  };
}

export async function requireUser(): Promise<AppUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("unauthenticated");
  return u;
}

/** Brand ids an editor is scoped to. Admins are not limited by this. */
export async function getUserBrandIds(userId: string): Promise<number[]> {
  const rows = await db
    .select({ brandId: userBrands.brandId })
    .from(userBrands)
    .where(eq(userBrands.userId, userId));
  return rows.map((r) => r.brandId);
}

/** S4 — the authorization boundary. Runs INSIDE every CMS mutation that
 *  touches a brand-owned row, never just in middleware. Admins pass; an
 *  editor passes only for brands in their user_brands scope. */
export async function requireBrandAccess(brandId: number): Promise<AppUser> {
  const u = await requireUser();
  if (u.role === "admin") return u;
  const brandIds = await getUserBrandIds(u.id);
  if (!brandIds.includes(brandId)) {
    throw new Error("forbidden: brand out of scope");
  }
  return u;
}

/** Admin-only gate (e.g. managing stores, users, flags vocabulary). */
export async function requireAdmin(): Promise<AppUser> {
  const u = await requireUser();
  if (u.role !== "admin") throw new Error("forbidden: admin only");
  return u;
}
