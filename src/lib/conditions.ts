import { and, eq } from "drizzle-orm";
import { stores, positions, flags as flagsTable, conditions, auditLog } from "@/db/schema";
import type { ConditionWrite } from "@/lib/contracts";

/* The condition-write core, extracted from the route handler so it can be
 * unit-tested against a real Postgres (the route handler is coupled to the
 * neon-http db + Request). Takes any Drizzle db instance. Implements S1 (DB
 * truths: store/position/flag existence), S6 (last-write-wins), S5 (audit),
 * and the upsert. HTTP concerns (body caps, Zod, rate limit, tag bust) stay
 * in the route handler. */

// A minimal structural type for the bits of the Drizzle db we use, so both
// the neon-http and node-postgres clients satisfy it.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = {
  select: (...a: any[]) => any;
  insert: (...a: any[]) => any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type ConditionResult =
  | { status: "ok"; saved: { positionId: number; flags: string[]; note: string; capturedAt: string }; created: boolean }
  | { status: "stale"; current: { positionId: number; flags: string[]; note: string; capturedAt: string } }
  | { status: "unknown-store" }
  | { status: "unknown-position" }
  | { status: "unknown-flag"; flag: string };

export async function applyConditionWrite(db: Db, body: ConditionWrite): Promise<ConditionResult> {
  const [store] = await db.select().from(stores).where(eq(stores.number, body.storeNumber)).limit(1);
  if (!store) return { status: "unknown-store" };

  const [pos] = await db.select({ id: positions.id }).from(positions).where(eq(positions.id, body.positionId)).limit(1);
  if (!pos) return { status: "unknown-position" };

  if (body.flags.length > 0) {
    const active = await db.select({ key: flagsTable.key }).from(flagsTable).where(eq(flagsTable.active, true));
    const activeSet = new Set(active.map((f: { key: string }) => f.key));
    const bad = body.flags.find((f) => !activeSet.has(f));
    if (bad) return { status: "unknown-flag", flag: bad };
  }

  const capturedAt = new Date(body.capturedAt);

  // S6 — last-write-wins: reject a write that isn't newer than what we hold.
  const [existing] = await db
    .select()
    .from(conditions)
    .where(and(eq(conditions.storeId, store.id), eq(conditions.positionId, body.positionId)))
    .limit(1);

  if (existing && (existing.capturedAt as Date).getTime() >= capturedAt.getTime()) {
    return {
      status: "stale",
      current: {
        positionId: existing.positionId,
        flags: existing.flags,
        note: existing.note,
        capturedAt: (existing.capturedAt as Date).toISOString(),
      },
    };
  }

  const [saved] = await db
    .insert(conditions)
    .values({
      storeId: store.id,
      positionId: body.positionId,
      flags: body.flags,
      note: body.note,
      capturedAt,
      updatedAt: new Date(),
      shift: body.shift,
      deviceHash: body.deviceHash,
    })
    .onConflictDoUpdate({
      target: [conditions.storeId, conditions.positionId],
      set: { flags: body.flags, note: body.note, capturedAt, updatedAt: new Date(), shift: body.shift, deviceHash: body.deviceHash },
    })
    .returning();

  // S5 — audit with the device hash as actor (never an IP, S10)
  await db.insert(auditLog).values({
    actor: body.deviceHash,
    entity: "condition",
    entityId: String(saved.id),
    action: existing ? "update" : "create",
    before: existing ? { flags: existing.flags, note: existing.note } : null,
    after: { flags: saved.flags, note: saved.note },
  });

  return {
    status: "ok",
    created: !existing,
    saved: {
      positionId: saved.positionId,
      flags: saved.flags,
      note: saved.note,
      capturedAt: (saved.capturedAt as Date).toISOString(),
    },
  };
}
