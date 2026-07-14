// Rounds — database schema (Drizzle ORM, Postgres/Neon)
//
// This file is the source of truth for docs/ROUNDS-PLAN.md Appendix A.
// If you change something here, update the plan doc to match (and vice
// versa) — they must never drift.
//
// Four concepts, deliberately kept apart (plan §4):
//   CATALOG    what products exist          (the CMS)
//   PLANOGRAM  where they're supposed to go (master layout)
//   CONDITION  what's currently wrong       (living state)
//   ROUND      what you found on a date     (frozen snapshot)

import {
  pgTable, pgEnum, integer, smallint, bigint, text, boolean,
  timestamp, jsonb, uuid, primaryKey, uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const productKind = pgEnum('product_kind', ['camera', 'lens', 'accessory', 'tablet', 'display'])
export const layoutKind  = pgEnum('layout_kind', ['endcap', 'plain'])
export const surfaceKind = pgEnum('surface_kind', ['gray', 'wood'])
export const sectionKey  = pgEnum('section_key', ['endcap', 'right', 'left', 'lens'])
export const userRole    = pgEnum('user_role', ['admin', 'editor'])

// ── CATALOG ──────────────────────────────────────────────────────────────
export const brands = pgTable('brands', {
  id:     integer('id').primaryKey().generatedAlwaysAsIdentity(),
  slug:   text('slug').notNull().unique(),
  name:   text('name').notNull(),
  accent: text('accent').notNull(), // '#RRGGBB'
  sort:   smallint('sort').notNull().default(0),
}, (t) => [check('brands_accent_hex', sql`${t.accent} ~ '^#[0-9a-f]{6}$'`)])

export const products = pgTable('products', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  brandId:   integer('brand_id').notNull().references(() => brands.id),
  quickName: text('quick_name').notNull(),
  longName:  text('long_name').notNull(),
  model:     text('model').notNull(),
  sku:       text('sku').notNull().unique(), // 7-digit BBY SKU
  kind:      productKind('kind').notNull(),
  active:    boolean('active').notNull().default(true),
  meta:      jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('products_brand_idx').on(t.brandId),
  check('products_sku_format', sql`${t.sku} ~ '^[0-9]{7}$'`),
])

// CMS-managed flag vocabulary (plan Phase 2)
export const flags = pgTable('flags', {
  key:    text('key').primaryKey(),
  label:  text('label').notNull(),
  sort:   smallint('sort').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

// ── PLANOGRAM ────────────────────────────────────────────────────────────
export const fixtures = pgTable('fixtures', {
  id:         integer('id').primaryKey().generatedAlwaysAsIdentity(),
  slug:       text('slug').notNull().unique(),
  name:       text('name').notNull(),
  layoutKind: layoutKind('layout_kind').notNull(),
  surface:    surfaceKind('surface').notNull(),
})

export const fixtureBrands = pgTable('fixture_brands', {
  fixtureId: integer('fixture_id').notNull().references(() => fixtures.id),
  brandId:   integer('brand_id').notNull().references(() => brands.id),
}, (t) => [primaryKey({ columns: [t.fixtureId, t.brandId] })])

export const sections = pgTable('sections', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  fixtureId: integer('fixture_id').notNull().references(() => fixtures.id),
  key:       sectionKey('key').notNull(),
  label:     text('label').notNull(),
  sort:      smallint('sort').notNull().default(0),
}, (t) => [uniqueIndex('sections_fixture_key_idx').on(t.fixtureId, t.key)])

export const positions = pgTable('positions', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sectionId: integer('section_id').notNull().references(() => sections.id),
  idx:       smallint('idx').notNull(), // display order — NEVER an identity
  productId: integer('product_id').references(() => products.id), // NULL = planned-empty
}, (t) => [uniqueIndex('positions_section_idx_idx').on(t.sectionId, t.idx)])
// The planogram editor writes a whole section in ONE transaction so this
// unique index never trips mid-reorder (delete-and-recreate idx values, or
// a two-phase offset write).

// ── STORES ───────────────────────────────────────────────────────────────
export const stores = pgTable('stores', {
  id:       integer('id').primaryKey().generatedAlwaysAsIdentity(),
  number:   text('number').notNull().unique(), // 4-digit BBY store number
  nickname: text('nickname'),
}, (t) => [check('stores_number_format', sql`${t.number} ~ '^[0-9]{4}$'`)])

export const storePositions = pgTable('store_positions', { // OVERRIDES ONLY
  storeId:    integer('store_id').notNull().references(() => stores.id),
  positionId: integer('position_id').notNull().references(() => positions.id),
  productId:  integer('product_id').references(() => products.id), // NULL = kept empty here
}, (t) => [primaryKey({ columns: [t.storeId, t.positionId] })])

// ── CONDITION (living state) ────────────────────────────────────────────
export const conditions = pgTable('conditions', {
  id:         integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId:    integer('store_id').notNull().references(() => stores.id),
  positionId: integer('position_id').notNull().references(() => positions.id),
  flags:      text('flags').array().notNull().default(sql`'{}'::text[]`),
  note:       text('note').notNull().default(''),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(), // LWW key (client clock)
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  shift:      text('shift').notNull().default(''),
  deviceHash: text('device_hash').notNull(), // never an IP (S10)
}, (t) => [
  uniqueIndex('conditions_store_position_idx').on(t.storeId, t.positionId),
  check('conditions_note_length', sql`char_length(${t.note}) <= 280`),
  check('conditions_device_hash_format', sql`${t.deviceHash} ~ '^[0-9a-f]{16,64}$'`),
])

// ── ROUND (frozen snapshots) ────────────────────────────────────────────
export const productSnapshots = pgTable('product_snapshots', {
  id:          integer('id').primaryKey().generatedAlwaysAsIdentity(),
  productId:   integer('product_id').notNull().references(() => products.id),
  contentHash: text('content_hash').notNull().unique(), // sha256 hex of canonical payload
  data:        jsonb('data').notNull(), // { quickName, longName, model, sku, kind, brandSlug }
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}) // IMMUTABLE — rows are inserted, never updated. That is the history guarantee (plan §4.1).

export const rounds = pgTable('rounds', {
  id:          integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId:     integer('store_id').notNull().references(() => stores.id),
  fixtureId:   integer('fixture_id').notNull().references(() => fixtures.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  shift:       text('shift').notNull().default(''),
  deviceHash:  text('device_hash').notNull(),
  clientKey:   uuid('client_key').notNull().unique(), // idempotency (plan §4.4)
}, (t) => [
  index('rounds_store_time_idx').on(t.storeId, t.submittedAt),
  check('rounds_device_hash_format', sql`${t.deviceHash} ~ '^[0-9a-f]{16,64}$'`),
])

export const roundItems = pgTable('round_items', {
  roundId:    integer('round_id').notNull().references(() => rounds.id),
  positionId: integer('position_id').notNull().references(() => positions.id),
  snapshotId: integer('snapshot_id').references(() => productSnapshots.id), // NULL = slot empty
  flags:      text('flags').array().notNull().default(sql`'{}'::text[]`),
  note:       text('note').notNull().default(''),
}, (t) => [
  primaryKey({ columns: [t.roundId, t.positionId] }),
  check('round_items_note_length', sql`char_length(${t.note}) <= 280`),
])

// ── USERS (CMS auth) ────────────────────────────────────────────────────
// The user/session/account/verification tables live in ./auth-schema.ts
// (Better Auth owns them; `role` is added there as an additionalField).
// user_brands (brand scoping, S4) also lives there, next to `user`, to keep
// a single import direction (auth-schema imports from schema, never back).
// The `userRole` enum above is shared by both files.
// audit_log.actor is just text (email OR device_hash) — no FK to user.

// ── AUDIT ────────────────────────────────────────────────────────────────
export const auditLog = pgTable('audit_log', {
  id:       bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  actor:    text('actor').notNull(), // email (CMS) or device_hash (public). NEVER an IP (S10).
  entity:   text('entity').notNull(), // 'product' | 'position' | 'condition' | 'round' | ...
  entityId: text('entity_id').notNull(),
  action:   text('action').notNull(), // 'create' | 'update' | 'delete' | 'revert' | ...
  before:   jsonb('before'),
  after:    jsonb('after'),
  at:       timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('audit_entity_idx').on(t.entity, t.entityId), index('audit_at_idx').on(t.at)])
