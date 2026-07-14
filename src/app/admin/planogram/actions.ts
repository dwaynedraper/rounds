"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { positions, products } from "@/db/schema";
import { requireBrandAccess, requireUser } from "@/lib/auth-helpers";
import { audit } from "@/lib/audit";
import { CATALOG } from "@/lib/cache-tags";

/** Assign a product to a master-planogram position, or clear it to
 *  planned-empty (productId = null). S4: an editor must have access to the
 *  brand being placed (and to the brand being removed, if clearing). */
export async function assignPosition(
  positionId: number,
  productId: number | null,
): Promise<{ error?: string }> {
  const [pos] = await db.select().from(positions).where(eq(positions.id, positionId)).limit(1);
  if (!pos) return { error: "position not found" };

  let actorEmail: string;

  if (productId === null) {
    // clearing — check access to whatever brand currently occupies the slot
    if (pos.productId) {
      const [current] = await db.select().from(products).where(eq(products.id, pos.productId)).limit(1);
      const u = current ? await requireBrandAccess(current.brandId) : await requireUser();
      actorEmail = u.email;
    } else {
      actorEmail = (await requireUser()).email;
    }
  } else {
    const [prod] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!prod) return { error: "product not found" };
    const u = await requireBrandAccess(prod.brandId); // S4
    actorEmail = u.email;
  }

  await db.update(positions).set({ productId }).where(eq(positions.id, positionId));
  await audit({
    actor: actorEmail,
    entity: "position",
    entityId: String(positionId),
    action: "update",
    before: { productId: pos.productId },
    after: { productId },
  });
  revalidateTag(CATALOG, "max");
  revalidatePath(`/admin/planogram`);
  return {};
}
