// Rounds — condition write-path tests (Phase 3). Exercises the extracted
// core (S1 existence checks, S6 last-write-wins, upsert, S5 audit) against a
// real local Postgres, since the route handler itself is coupled to the
// neon-http driver + Request.
import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { pool, testDb, migrateTestDb, resetTestDb } from "./db-test-client";
import { brands, products, fixtures, sections, positions, stores, flags, conditions, auditLog } from "../src/db/schema";
import { applyConditionWrite } from "../src/lib/conditions";
import type { ConditionWrite } from "../src/lib/contracts";

const DEVICE = "a".repeat(32);

async function seed() {
  const [brand] = await testDb.insert(brands).values({ slug: "sony", name: "Sony", accent: "#ff6f00" }).returning();
  const [product] = await testDb.insert(products).values({
    brandId: brand.id, quickName: "A7", longName: "Alpha 7", model: "M", sku: "1234567", kind: "camera",
  }).returning();
  const [fixture] = await testDb.insert(fixtures).values({ slug: "e1", name: "Endcap", layoutKind: "endcap", surface: "gray" }).returning();
  const [section] = await testDb.insert(sections).values({ fixtureId: fixture.id, key: "endcap", label: "Endcap" }).returning();
  const [position] = await testDb.insert(positions).values({ sectionId: section.id, idx: 0, productId: product.id }).returning();
  const [store] = await testDb.insert(stores).values({ number: "0058" }).returning();
  await testDb.insert(flags).values([
    { key: "broken", label: "Broken" },
    { key: "off", label: "Off", active: false },
  ]);
  return { store, position };
}

function write(over: Partial<ConditionWrite>): ConditionWrite {
  return {
    storeNumber: "0058",
    positionId: 1,
    flags: ["broken"],
    note: "",
    capturedAt: new Date().toISOString(),
    deviceHash: DEVICE,
    shift: "",
    ...over,
  };
}

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetTestDb(); });
afterAll(async () => { await pool.end(); });

describe("condition write core", () => {
  test("first write creates a living condition + an audit row (S5)", async () => {
    const { position } = await seed();
    const r = await applyConditionWrite(testDb, write({ positionId: position.id, flags: ["broken"], note: "cracked" }));
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.created).toBe(true);
    const [c] = await testDb.select().from(conditions);
    expect(c.flags).toEqual(["broken"]);
    const audits = await testDb.select().from(auditLog).where(eq(auditLog.entity, "condition"));
    expect(audits.length).toBe(1);
    expect(audits[0].actor).toBe(DEVICE); // device hash, never an IP (S10)
  });

  test("a newer captured_at updates the same living row (upsert, one row)", async () => {
    const { position } = await seed();
    await applyConditionWrite(testDb, write({ positionId: position.id, flags: ["broken"], capturedAt: "2026-07-14T10:00:00.000Z" }));
    const r = await applyConditionWrite(testDb, write({ positionId: position.id, flags: [], note: "fixed", capturedAt: "2026-07-14T11:00:00.000Z" }));
    expect(r.status).toBe("ok");
    const rows = await testDb.select().from(conditions);
    expect(rows.length).toBe(1); // upserted, not duplicated
    expect(rows[0].flags).toEqual([]);
    expect(rows[0].note).toBe("fixed");
  });

  test("a stale (older/equal) captured_at is rejected with the current row (S6)", async () => {
    const { position } = await seed();
    await applyConditionWrite(testDb, write({ positionId: position.id, flags: ["broken"], capturedAt: "2026-07-14T11:00:00.000Z" }));
    const r = await applyConditionWrite(testDb, write({ positionId: position.id, flags: [], capturedAt: "2026-07-14T10:00:00.000Z" }));
    expect(r.status).toBe("stale");
    if (r.status === "stale") expect(r.current.flags).toEqual(["broken"]); // unchanged
    const rows = await testDb.select().from(conditions);
    expect(rows[0].flags).toEqual(["broken"]);
  });

  test("unknown store / position / flag are rejected (S1 DB truths)", async () => {
    const { position } = await seed();
    expect((await applyConditionWrite(testDb, write({ storeNumber: "9999", positionId: position.id }))).status).toBe("unknown-store");
    expect((await applyConditionWrite(testDb, write({ positionId: 999999 }))).status).toBe("unknown-position");
    const bad = await applyConditionWrite(testDb, write({ positionId: position.id, flags: ["broken", "nonexistent"] }));
    expect(bad.status).toBe("unknown-flag");
    // an inactive flag counts as unknown too
    expect((await applyConditionWrite(testDb, write({ positionId: position.id, flags: ["off"] }))).status).toBe("unknown-flag");
  });
});
