// Rounds — layout write-path + store auto-create tests (plan §1 #15b/c).
// Same approach as conditions.test.ts: exercise the extracted cores against
// a real local Postgres.
import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { pool, testDb, migrateTestDb, resetTestDb } from "./db-test-client";
import { brands, products, fixtures, sections, positions, stores, storePositions, auditLog } from "../src/db/schema";
import { applyLayoutWrite } from "../src/lib/layout";
import { ensureStore } from "../src/lib/stores";

const DEVICE = "b".repeat(32);

async function seed() {
  const [brand] = await testDb.insert(brands).values({ slug: "sony", name: "Sony", accent: "#ff6f00" }).returning();
  const [activeProduct, inactiveProduct] = await testDb.insert(products).values([
    { brandId: brand.id, quickName: "A7 V", longName: "Alpha 7 V", model: "A7V", sku: "1234567", kind: "camera" },
    { brandId: brand.id, quickName: "Old", longName: "Old Cam", model: "OLD", sku: "1234568", kind: "camera", active: false },
  ]).returning();
  const [fixture] = await testDb.insert(fixtures).values({ slug: "sony-table", name: "Sony", layoutKind: "endcap", surface: "gray" }).returning();
  const [section] = await testDb.insert(sections).values({ fixtureId: fixture.id, key: "left-1", label: "Left wall · section 1" }).returning();
  const slots = await testDb.insert(positions).values(
    Array.from({ length: 5 }, (_, idx) => ({ sectionId: section.id, idx, productId: null })),
  ).returning();
  const [store] = await testDb.insert(stores).values({ number: "0058" }).returning();
  return { store, slots, activeProduct, inactiveProduct };
}

beforeAll(async () => {
  await migrateTestDb();
});
beforeEach(async () => {
  await resetTestDb();
});
afterAll(async () => {
  await pool.end();
});

describe("ensureStore (auto-create on entry)", () => {
  test("creates a new store and audits it", async () => {
    const result = await ensureStore(testDb, "0148", DEVICE);
    expect(result.created).toBe(true);
    expect(result.store.number).toBe("0148");

    const audits = await testDb.select().from(auditLog).where(eq(auditLog.entity, "store"));
    expect(audits).toHaveLength(1);
    expect(audits[0].actor).toBe(DEVICE);
    expect(audits[0].action).toBe("create");
  });

  test("re-entering an existing store is a no-op", async () => {
    await seed();
    const result = await ensureStore(testDb, "0058", DEVICE);
    expect(result.created).toBe(false);

    const all = await testDb.select().from(stores).where(eq(stores.number, "0058"));
    expect(all).toHaveLength(1);
    const audits = await testDb.select().from(auditLog).where(eq(auditLog.entity, "store"));
    expect(audits).toHaveLength(0); // no audit noise for no-ops
  });
});

describe("applyLayoutWrite (rep-built store layout)", () => {
  test("assigns an active master-list product to a slot, and audits", async () => {
    const { store, slots, activeProduct } = await seed();
    const result = await applyLayoutWrite(testDb, {
      storeNumber: "0058",
      deviceHash: DEVICE,
      assignments: [{ positionId: slots[0].id, productId: activeProduct.id }],
    });
    expect(result.status).toBe("ok");

    const rows = await testDb.select().from(storePositions).where(eq(storePositions.storeId, store.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].productId).toBe(activeProduct.id);

    const audits = await testDb.select().from(auditLog).where(eq(auditLog.entity, "layout"));
    expect(audits).toHaveLength(1);
    expect(audits[0].actor).toBe(DEVICE);
  });

  test("re-assigning a slot upserts (no duplicate rows), null clears", async () => {
    const { store, slots, activeProduct } = await seed();
    const write = (productId: number | null) =>
      applyLayoutWrite(testDb, {
        storeNumber: "0058",
        deviceHash: DEVICE,
        assignments: [{ positionId: slots[1].id, productId }],
      });

    await write(activeProduct.id);
    await write(activeProduct.id);
    const cleared = await write(null);
    expect(cleared.status).toBe("ok");

    const rows = await testDb.select().from(storePositions).where(eq(storePositions.storeId, store.id));
    expect(rows).toHaveLength(1); // upserted, not duplicated
    expect(rows[0].productId).toBeNull(); // deliberately-empty slot
  });

  test("rejects unknown store, unknown position, unknown product", async () => {
    const { slots, activeProduct } = await seed();

    expect(
      (await applyLayoutWrite(testDb, {
        storeNumber: "9999",
        deviceHash: DEVICE,
        assignments: [{ positionId: slots[0].id, productId: activeProduct.id }],
      })).status,
    ).toBe("unknown-store");

    expect(
      (await applyLayoutWrite(testDb, {
        storeNumber: "0058",
        deviceHash: DEVICE,
        assignments: [{ positionId: 999_999, productId: activeProduct.id }],
      })).status,
    ).toBe("unknown-position");

    const badProduct = await applyLayoutWrite(testDb, {
      storeNumber: "0058",
      deviceHash: DEVICE,
      assignments: [{ positionId: slots[0].id, productId: 999_999 }],
    });
    expect(badProduct.status).toBe("unknown-product");
  });

  test("rejects INACTIVE products — the master-list constraint", async () => {
    const { store, slots, inactiveProduct } = await seed();
    const result = await applyLayoutWrite(testDb, {
      storeNumber: "0058",
      deviceHash: DEVICE,
      assignments: [{ positionId: slots[0].id, productId: inactiveProduct.id }],
    });
    expect(result.status).toBe("unknown-product");

    const rows = await testDb.select().from(storePositions).where(eq(storePositions.storeId, store.id));
    expect(rows).toHaveLength(0); // nothing applied
  });

  test("last assignment for the same position wins within one request", async () => {
    const { store, slots, activeProduct } = await seed();
    const result = await applyLayoutWrite(testDb, {
      storeNumber: "0058",
      deviceHash: DEVICE,
      assignments: [
        { positionId: slots[2].id, productId: activeProduct.id },
        { positionId: slots[2].id, productId: null },
      ],
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.applied).toBe(1);

    const rows = await testDb.select().from(storePositions).where(eq(storePositions.storeId, store.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].productId).toBeNull();
  });
});
