"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { bulkProductRow } from "@/lib/contracts";
import { requireUser, getUserBrandIds } from "@/lib/auth-helpers";
import { audit } from "@/lib/audit";
import { CATALOG } from "@/lib/cache-tags";

export type ImportResult = {
  inserted: number;
  skipped: { line: number; reason: string }[];
};

/** Bulk product import. The client parses & previews, but the server
 *  re-validates EVERY row (never trust the client), resolves brands,
 *  enforces S4 brand scope, and reports per-row failures. */
export async function importProducts(rawRows: unknown[]): Promise<ImportResult> {
  const user = await requireUser();
  if (!Array.isArray(rawRows) || rawRows.length === 0) return { inserted: 0, skipped: [] };
  if (rawRows.length > 500) return { inserted: 0, skipped: [{ line: 0, reason: "Too many rows (max 500)" }] };

  const brandList = await db.select({ id: brands.id, slug: brands.slug }).from(brands);
  const brandBySlug = new Map(brandList.map((b) => [b.slug, b.id]));
  const allowed =
    user.role === "admin" ? null : new Set(await getUserBrandIds(user.id));

  const skipped: ImportResult["skipped"] = [];
  let inserted = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const line = i + 1;
    const parsed = bulkProductRow.safeParse(rawRows[i]);
    if (!parsed.success) {
      skipped.push({ line, reason: parsed.error.issues[0]?.message ?? "invalid row" });
      continue;
    }
    const { brandSlug, ...rest } = parsed.data;
    const brandId = brandBySlug.get(brandSlug);
    if (!brandId) {
      skipped.push({ line, reason: `unknown brand "${brandSlug}"` });
      continue;
    }
    if (allowed && !allowed.has(brandId)) {
      skipped.push({ line, reason: `brand "${brandSlug}" out of your scope` });
      continue;
    }
    try {
      await db.insert(products).values({ ...rest, brandId });
      inserted++;
    } catch (e) {
      skipped.push({
        line,
        reason: String(e).includes("products_sku_unique") ? `SKU ${rest.sku} already exists` : "insert failed",
      });
    }
  }

  if (inserted > 0) {
    await audit({ actor: user.email, entity: "product", entityId: "bulk", action: "import", after: { inserted } });
    revalidateTag(CATALOG, "max");
  }
  return { inserted, skipped };
}
