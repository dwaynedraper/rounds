import { eq, inArray } from "drizzle-orm";
import { stores, positions, products, storePositions, auditLog } from "@/db/schema";
import type { LayoutWrite } from "@/lib/contracts";

/* The layout-write core (plan §1 #15c), extracted like conditions.ts so it
 * unit-tests against a real Postgres. A rep assigns master-list products to
 * the fixed floor slots for THEIR store. Rules enforced here:
 *   - store must exist (created at entry via /api/stores, never here)
 *   - every position must exist (the fixed geometry)
 *   - every product must exist AND be active — the master-list constraint;
 *     reps can only place what admins have put on the list
 *   - upsert into store_positions; productId null = deliberately empty slot
 *   - audited with device_hash as actor (S5, never an IP — S10)
 * HTTP concerns (body cap, Zod, rate limit, tag bust) stay in the route. */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = {
  select: (...a: any[]) => any;
  insert: (...a: any[]) => any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type LayoutResult =
  | { status: "ok"; applied: number }
  | { status: "unknown-store" }
  | { status: "unknown-position"; positionId: number }
  | { status: "unknown-product"; productId: number };

export async function applyLayoutWrite(db: Db, body: LayoutWrite): Promise<LayoutResult> {
  const [store] = await db.select().from(stores).where(eq(stores.number, body.storeNumber)).limit(1);
  if (!store) return { status: "unknown-store" };

  const positionIds = [...new Set(body.assignments.map((a) => a.positionId))];
  const posRows = await db
    .select({ id: positions.id })
    .from(positions)
    .where(inArray(positions.id, positionIds));
  const posSet = new Set(posRows.map((p: { id: number }) => p.id));
  const missingPos = positionIds.find((id) => !posSet.has(id));
  if (missingPos !== undefined) return { status: "unknown-position", positionId: missingPos };

  const productIds = [...new Set(body.assignments.flatMap((a) => (a.productId != null ? [a.productId] : [])))];
  if (productIds.length > 0) {
    const prodRows = await db
      .select({ id: products.id, active: products.active })
      .from(products)
      .where(inArray(products.id, productIds));
    const activeSet = new Set(prodRows.filter((p: { active: boolean }) => p.active).map((p: { id: number }) => p.id));
    const badProduct = productIds.find((id) => !activeSet.has(id));
    if (badProduct !== undefined) return { status: "unknown-product", productId: badProduct };
  }

  // Last assignment for a position wins within one request.
  const byPosition = new Map<number, number | null>();
  for (const a of body.assignments) byPosition.set(a.positionId, a.productId);

  for (const [positionId, productId] of byPosition) {
    await db
      .insert(storePositions)
      .values({ storeId: store.id, positionId, productId })
      .onConflictDoUpdate({
        target: [storePositions.storeId, storePositions.positionId],
        set: { productId },
      });
  }

  await db.insert(auditLog).values({
    actor: body.deviceHash,
    entity: "layout",
    entityId: `${store.id}`,
    action: "update",
    before: null,
    after: { assignments: [...byPosition].map(([positionId, productId]) => ({ positionId, productId })) },
  });

  return { status: "ok", applied: byPosition.size };
}
