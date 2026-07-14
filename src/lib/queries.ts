import "server-only";
import { asc, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  brands, products, fixtures, sections, positions, stores, flags,
} from "@/db/schema";

/* CMS reads. These are for the authed, low-traffic admin, so they hit the
 * DB directly — the tag-cached reads that MUST avoid the DB are the public
 * survey ones (Phase 3). */

export async function listBrands() {
  return db.select().from(brands).orderBy(asc(brands.sort), asc(brands.name));
}

export async function listProducts() {
  return db
    .select({
      id: products.id,
      quickName: products.quickName,
      longName: products.longName,
      model: products.model,
      sku: products.sku,
      kind: products.kind,
      active: products.active,
      brandId: products.brandId,
      brandSlug: brands.slug,
      brandName: brands.name,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .orderBy(asc(brands.sort), asc(products.quickName));
}

export async function getProduct(id: number) {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listStores() {
  return db.select().from(stores).orderBy(asc(stores.number));
}

export async function listFlags() {
  return db.select().from(flags).orderBy(asc(flags.sort), asc(flags.key));
}

export async function listFixtures() {
  return db.select().from(fixtures).orderBy(asc(fixtures.name));
}

export async function getFixtureLayout(fixtureId: number) {
  const secs = await db
    .select()
    .from(sections)
    .where(eq(sections.fixtureId, fixtureId))
    .orderBy(asc(sections.sort));
  // positions for this fixture's sections, with the assigned product (if any)
  const pos = await db
    .select({
      id: positions.id,
      sectionId: positions.sectionId,
      idx: positions.idx,
      productId: positions.productId,
      productQuickName: products.quickName,
      productBrandSlug: brands.slug,
    })
    .from(positions)
    .innerJoin(sections, eq(positions.sectionId, sections.id))
    .leftJoin(products, eq(positions.productId, products.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(eq(sections.fixtureId, fixtureId))
    .orderBy(asc(sections.sort), asc(positions.idx));
  return { sections: secs, positions: pos };
}

export async function recentAudit(limit = 50) {
  const { auditLog } = await import("@/db/schema");
  return db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(limit);
}
