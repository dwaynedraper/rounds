"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { flags } from "@/db/schema";
import { flagInput } from "@/lib/contracts";
import { requireAdmin } from "@/lib/auth-helpers";
import { audit } from "@/lib/audit";
import { CATALOG } from "@/lib/cache-tags";

export type FlagState = { error?: string };

export async function createFlag(_prev: FlagState, formData: FormData): Promise<FlagState> {
  const user = await requireAdmin();
  const parsed = flagInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await db.insert(flags).values(parsed.data);
    await audit({ actor: user.email, entity: "flag", entityId: parsed.data.key, action: "create", after: parsed.data });
  } catch (e) {
    if (String(e).includes("flags_pkey")) return { error: `Flag "${parsed.data.key}" already exists` };
    throw e;
  }
  revalidateTag(CATALOG, "max"); // survey's flag vocabulary
  revalidatePath("/admin/flags");
  return {};
}

export async function toggleFlag(key: string, active: boolean): Promise<void> {
  const user = await requireAdmin();
  await db.update(flags).set({ active }).where(eq(flags.key, key));
  await audit({ actor: user.email, entity: "flag", entityId: key, action: "update", after: { active } });
  revalidateTag(CATALOG, "max");
  revalidatePath("/admin/flags");
}

export async function deleteFlag(key: string): Promise<void> {
  const user = await requireAdmin();
  const [before] = await db.select().from(flags).where(eq(flags.key, key)).limit(1);
  if (!before) return;
  await db.delete(flags).where(eq(flags.key, key));
  await audit({ actor: user.email, entity: "flag", entityId: key, action: "delete", before });
  revalidateTag(CATALOG, "max");
  revalidatePath("/admin/flags");
}
