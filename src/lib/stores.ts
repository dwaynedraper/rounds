import { eq } from "drizzle-orm";
import { stores, auditLog } from "@/db/schema";

/* Store auto-create on entry (plan §1 #15b). No admin gatekeeping: a rep
 * types a 4-digit number and the store exists. Create-once — re-entering an
 * existing store is a no-op. Audited with device_hash as actor (S5/S10).
 * The number format itself is enforced twice: Zod at the route AND the
 * stores_number_format check in Postgres. */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = {
  select: (...a: any[]) => any;
  insert: (...a: any[]) => any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type EnsureStoreResult = { created: boolean; store: { id: number; number: string; nickname: string | null } };

export async function ensureStore(db: Db, number: string, deviceHash: string): Promise<EnsureStoreResult> {
  const [existing] = await db.select().from(stores).where(eq(stores.number, number)).limit(1);
  if (existing) {
    return { created: false, store: { id: existing.id, number: existing.number, nickname: existing.nickname } };
  }

  // Race-safe: two devices entering the same new store at once — the loser's
  // insert conflicts and re-reads.
  const inserted = await db.insert(stores).values({ number }).onConflictDoNothing().returning();
  if (inserted.length === 0) {
    const [row] = await db.select().from(stores).where(eq(stores.number, number)).limit(1);
    return { created: false, store: { id: row.id, number: row.number, nickname: row.nickname } };
  }

  const store = inserted[0];
  await db.insert(auditLog).values({
    actor: deviceHash,
    entity: "store",
    entityId: String(store.id),
    action: "create",
    before: null,
    after: { number: store.number },
  });

  return { created: true, store: { id: store.id, number: store.number, nickname: store.nickname } };
}
