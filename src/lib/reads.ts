import { unstable_cacheTag as cacheTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  brands, products, fixtures, sections, positions, flags,
  stores, storePositions, conditions,
} from "@/db/schema";
import { CATALOG, storeTag } from "@/lib/cache-tags";

/* Phase 3 — the public survey reads. These are `use cache`d and tagged, so
 * the survey serves from the CDN/data cache and the DB is only touched on a
 * cache miss (i.e. right after a CMS edit or a condition write busts the
 * tag). This is the load-bearing rule from plan §3 that keeps Neon inside
 * its free limits. */

export type CatalogProduct = {
  id: number;
  quickName: string;
  brandSlug: string;
  kind: string;
  active: boolean;
};

export type CatalogPosition = { id: number; idx: number; masterProductId: number | null };
export type CatalogSection = { id: number; key: string; label: string; positions: CatalogPosition[] };
export type CatalogFixture = {
  id: number;
  slug: string;
  name: string;
  layoutKind: string;
  sections: CatalogSection[];
};

export async function getCatalog() {
  "use cache";
  cacheTag(CATALOG);

  const [productRows, fixtureRows, sectionRows, positionRows, flagRows] =
    await Promise.all([
      db.select({ id: products.id, quickName: products.quickName, brandSlug: brands.slug, kind: products.kind, active: products.active })
        .from(products).innerJoin(brands, eq(products.brandId, brands.id)),
      db.select().from(fixtures).orderBy(asc(fixtures.name)),
      db.select().from(sections).orderBy(asc(sections.sort)),
      db.select().from(positions).orderBy(asc(positions.idx)),
      db.select().from(flags).where(eq(flags.active, true)).orderBy(asc(flags.sort)),
    ]);

  const productById = new Map(productRows.map((p) => [p.id, p]));
  const positionsBySection = new Map<number, CatalogPosition[]>();
  for (const p of positionRows) {
    const list = positionsBySection.get(p.sectionId) ?? [];
    list.push({ id: p.id, idx: p.idx, masterProductId: p.productId });
    positionsBySection.set(p.sectionId, list);
  }
  const sectionsByFixture = new Map<number, CatalogSection[]>();
  for (const s of sectionRows) {
    const list = sectionsByFixture.get(s.fixtureId) ?? [];
    list.push({ id: s.id, key: s.key, label: s.label, positions: positionsBySection.get(s.id) ?? [] });
    sectionsByFixture.set(s.fixtureId, list);
  }
  const fixtureList: CatalogFixture[] = fixtureRows.map((f) => ({
    id: f.id, slug: f.slug, name: f.name, layoutKind: f.layoutKind,
    sections: sectionsByFixture.get(f.id) ?? [],
  }));

  return {
    fixtures: fixtureList,
    products: Object.fromEntries(productById) as Record<number, CatalogProduct>,
    flags: flagRows.map((f) => ({ key: f.key, label: f.label })),
  };
}

export type StoreCondition = {
  positionId: number;
  flags: string[];
  note: string;
  capturedAt: string;
};

export async function getStoreState(number: string) {
  "use cache";
  cacheTag(storeTag(number));

  const [store] = await db.select().from(stores).where(eq(stores.number, number)).limit(1);
  if (!store) return null;

  const [overrides, conds] = await Promise.all([
    db.select().from(storePositions).where(eq(storePositions.storeId, store.id)),
    db.select().from(conditions).where(eq(conditions.storeId, store.id)),
  ]);

  return {
    store: { id: store.id, number: store.number, nickname: store.nickname },
    // positionId -> { productId } ; an existing row (even productId null) is a
    // deliberate override; no row = follow the master planogram.
    overrides: Object.fromEntries(overrides.map((o) => [o.positionId, o.productId])) as Record<number, number | null>,
    conditions: conds.map<StoreCondition>((c) => ({
      positionId: c.positionId,
      flags: c.flags,
      note: c.note,
      capturedAt: (c.capturedAt as Date).toISOString(),
    })),
  };
}
