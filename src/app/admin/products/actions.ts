"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { productInput } from "@/lib/contracts";
import { requireBrandAccess } from "@/lib/auth-helpers";
import { audit } from "@/lib/audit";
import { CATALOG } from "@/lib/cache-tags";

export type ActionState = { error?: string };

function firstError(err: import("zod").ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}

export async function createProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const user = await requireBrandAccess(data.brandId); // S4

  let created;
  try {
    [created] = await db.insert(products).values(data).returning();
  } catch (e) {
    if (String(e).includes("products_sku_unique")) return { error: `SKU ${data.sku} already exists` };
    throw e;
  }

  await audit({ actor: user.email, entity: "product", entityId: String(created.id), action: "create", after: created });
  revalidateTag(CATALOG, "max"); // survey catalog reads see the new product
  redirect("/admin/products");
}

export async function updateProduct(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!before) return { error: "Product not found" };

  // S4: an editor must have access to BOTH the current brand and the target
  // brand (in case they're re-assigning it).
  const user = await requireBrandAccess(before.brandId);
  if (data.brandId !== before.brandId) await requireBrandAccess(data.brandId);

  let after;
  try {
    [after] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
  } catch (e) {
    if (String(e).includes("products_sku_unique")) return { error: `SKU ${data.sku} already exists` };
    throw e;
  }

  await audit({ actor: user.email, entity: "product", entityId: String(id), action: "update", before, after });
  revalidateTag(CATALOG, "max");
  redirect("/admin/products");
}

export async function deleteProduct(id: number): Promise<void> {
  const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!before) return;
  const user = await requireBrandAccess(before.brandId); // S4
  await db.delete(products).where(eq(products.id, id));
  await audit({ actor: user.email, entity: "product", entityId: String(id), action: "delete", before });
  revalidateTag(CATALOG, "max");
}
