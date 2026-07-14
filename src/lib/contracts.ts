import { z } from "zod";

/* Rounds — shared Zod contracts. Used by forms, server actions, route
 * handlers, and tests. The server ALWAYS re-validates; the client never
 * decides what's valid. (Plan Appendix B + CMS input schemas.) */

// ---- primitives ----
export const deviceHash = z.string().regex(/^[0-9a-f]{16,64}$/);
export const storeNumber = z.string().regex(/^\d{4}$/);
export const sku = z.string().regex(/^\d{7}$/, "SKU must be exactly 7 digits");
const flagKey = z.string().min(1).max(32);
const shiftStr = z.string().max(24);
export const productKinds = ["camera", "lens", "accessory", "tablet", "display"] as const;

// ---- CMS: products ----
export const productInput = z.object({
  brandId: z.coerce.number().int().positive(),
  quickName: z.string().min(1).max(80),
  longName: z.string().min(1).max(160),
  model: z.string().min(1).max(80),
  sku,
  kind: z.enum(productKinds),
  active: z.coerce.boolean().default(true),
});
export type ProductInput = z.infer<typeof productInput>;

// One pasted row of the bulk importer, pre-map. Columns are mapped then
// validated per-row against productInput.
export const bulkProductRow = z.object({
  brandSlug: z.string().min(1),
  quickName: z.string().min(1).max(80),
  longName: z.string().min(1).max(160),
  model: z.string().min(1).max(80),
  sku,
  kind: z.enum(productKinds),
});

// ---- CMS: stores & flags ----
export const storeInput = z.object({
  number: storeNumber,
  nickname: z.string().max(80).optional().or(z.literal("")),
});
export const flagInput = z.object({
  key: z.string().regex(/^[a-z0-9-]{1,32}$/, "lowercase, digits, hyphens"),
  label: z.string().min(1).max(60),
  sort: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
});

// ---- Public write contracts (Appendix B) ----
// B1 — POST /api/conditions
export const conditionWrite = z.object({
  storeNumber,
  positionId: z.number().int().positive(),
  flags: z.array(flagKey).max(8),
  note: z.string().max(280),
  capturedAt: z.string().datetime(), // LWW comparison key
  deviceHash,
  shift: shiftStr,
});
export type ConditionWrite = z.infer<typeof conditionWrite>;

// B3 — POST /api/layout (plan §1 #15c: reps assign master-list products to
// fixed slots). productId null = clear the slot. Server re-checks that every
// position exists and every product exists AND is active.
export const layoutWrite = z.object({
  storeNumber,
  deviceHash,
  assignments: z
    .array(
      z.object({
        positionId: z.number().int().positive(),
        productId: z.number().int().positive().nullable(),
      }),
    )
    .min(1)
    .max(32),
});
export type LayoutWrite = z.infer<typeof layoutWrite>;

// POST /api/stores — enter (auto-create, plan §1 #15b)
export const storeEnter = z.object({
  number: storeNumber,
  deviceHash,
});
export type StoreEnter = z.infer<typeof storeEnter>;

// B2 — POST /api/rounds
export const roundSubmit = z.object({
  storeNumber,
  fixtureSlug: z.string().max(40),
  clientKey: z.string().uuid(), // idempotency key
  capturedAt: z.string().datetime(),
  deviceHash,
  shift: shiftStr,
  items: z
    .array(
      z.object({
        positionId: z.number().int().positive(),
        flags: z.array(flagKey).max(8),
        note: z.string().max(280),
      }),
    )
    .min(1)
    .max(64),
});
export type RoundSubmit = z.infer<typeof roundSubmit>;
