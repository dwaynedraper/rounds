"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { storeInput } from "@/lib/contracts";
import { requireAdmin } from "@/lib/auth-helpers";
import { audit } from "@/lib/audit";

export type StoreState = { error?: string };

export async function createStore(_prev: StoreState, formData: FormData): Promise<StoreState> {
  const user = await requireAdmin();
  const parsed = storeInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { number, nickname } = parsed.data;
  try {
    const [created] = await db
      .insert(stores)
      .values({ number, nickname: nickname || null })
      .returning();
    await audit({ actor: user.email, entity: "store", entityId: String(created.id), action: "create", after: created });
  } catch (e) {
    if (String(e).includes("stores_number_unique")) return { error: `Store ${number} already exists` };
    throw e;
  }
  revalidatePath("/admin/stores");
  return {};
}

export async function deleteStore(id: number): Promise<void> {
  const user = await requireAdmin();
  const [before] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
  if (!before) return;
  await db.delete(stores).where(eq(stores.id, id));
  await audit({ actor: user.email, entity: "store", entityId: String(id), action: "delete", before });
  revalidatePath("/admin/stores");
}
