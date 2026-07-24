import { cacheTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  brands, products, fixtures, sections, positions, flags,
  stores, storePositions, conditions,
} from "@/db/schema";
import { CATALOG, storeTag } from "@/lib/cache-tags";

/* Phase 3 — the public survey reads. These are cached and tagged, so the
 * survey serves from the runtime cache and the DB is only touched on a cache
 * miss (i.e. right after a CMS edit or a condition write busts the tag).
 * This is the load-bearing rule from plan §3 that keeps Neon inside its free
 * limits.
 *
 * WHY `use cache: remote` AND NOT `use cache` (plan §1 #17):
 * Verified against the installed Next 16.2.10 docs
 * (node_modules/next/dist/docs/01-app/03-api-reference/01-directives/) and
 * Vercel's runtime-cache docs — plain `use cache` is an IN-MEMORY LRU,
 * private to one server instance and lost when that instance shuts down.
 * On Cloudflare that was invisible because the OpenNext kvIncrementalCache
 * override made the default handler durable (KV). On Vercel there is no such
 * override: every cold function instance would be a cache miss, i.e. a real
 * Neon query, and `revalidateTag` would only bust the single instance that
 * handled the write — so a flag saved on one rep's phone would not show up
 * on another's. `use cache: remote` stores entries in Vercel's Runtime
 * Cache, which is shared across instances and honours cacheTag /
 * revalidateTag. Both properties are required by plan §3; neither is
 * optional. Self-hosters wire their own remote handler via the
 * `cacheHandlers` config (see SETUP.md). */

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
  "use cache: remote";
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
  "use cache: remote";
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
