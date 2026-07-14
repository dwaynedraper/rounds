// Rounds — schema constraint tests (Phase 0 done-when, plan §9).
// These insert real rows against a real local Postgres and assert that
// the constraints in src/db/schema.ts actually hold, not just that the
// TypeScript types compile.
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { pool, testDb, migrateTestDb, resetTestDb } from './db-test-client'
import {
  brands, products, fixtures, sections, positions, stores, storePositions,
  conditions, productSnapshots, rounds, roundItems,
} from '../src/db/schema'
import { user, userBrands } from '../src/db/auth-schema'

beforeAll(async () => {
  await migrateTestDb()
})

beforeEach(async () => {
  await resetTestDb()
})

afterAll(async () => {
  await pool.end()
})

async function seedBrand() {
  const [brand] = await testDb.insert(brands)
    .values({ slug: 'sony', name: 'Sony', accent: '#ff6f00' })
    .returning()
  return brand
}

describe('brands', () => {
  test('slug uniqueness is enforced', async () => {
    await testDb.insert(brands).values({ slug: 'sony', name: 'Sony', accent: '#ff6f00' })
    await expect(
      testDb.insert(brands).values({ slug: 'sony', name: 'Sony Again', accent: '#ff6f01' })
    ).rejects.toThrow()
  })

  test('accent must be a 6-digit lowercase hex color', async () => {
    await expect(
      testDb.insert(brands).values({ slug: 'bad', name: 'Bad', accent: 'orange' })
    ).rejects.toThrow()
    await expect(
      testDb.insert(brands).values({ slug: 'bad2', name: 'Bad2', accent: '#FF6F00' }) // uppercase rejected
    ).rejects.toThrow()
    await expect(
      testDb.insert(brands).values({ slug: 'ok', name: 'Ok', accent: '#ff6f00' })
    ).resolves.toBeDefined()
  })
})

describe('products', () => {
  test('sku must be exactly 7 digits', async () => {
    const brand = await seedBrand()
    await expect(
      testDb.insert(products).values({
        brandId: brand.id, quickName: 'Q', longName: 'L', model: 'M', sku: '12345', kind: 'camera',
      })
    ).rejects.toThrow()
    await expect(
      testDb.insert(products).values({
        brandId: brand.id, quickName: 'Q', longName: 'L', model: 'M', sku: '1234567a', kind: 'camera',
      })
    ).rejects.toThrow()
    await expect(
      testDb.insert(products).values({
        brandId: brand.id, quickName: 'Q', longName: 'L', model: 'M', sku: '1234567', kind: 'camera',
      })
    ).resolves.toBeDefined()
  })

  test('sku uniqueness is enforced', async () => {
    const brand = await seedBrand()
    await testDb.insert(products).values({
      brandId: brand.id, quickName: 'Q', longName: 'L', model: 'M', sku: '1234567', kind: 'camera',
    })
    await expect(
      testDb.insert(products).values({
        brandId: brand.id, quickName: 'Q2', longName: 'L2', model: 'M2', sku: '1234567', kind: 'lens',
      })
    ).rejects.toThrow()
  })

  test('brand_id must reference an existing brand', async () => {
    await expect(
      testDb.insert(products).values({
        brandId: 999999, quickName: 'Q', longName: 'L', model: 'M', sku: '1234567', kind: 'camera',
      })
    ).rejects.toThrow()
  })
})

describe('stores', () => {
  test('number must be exactly 4 digits', async () => {
    await expect(testDb.insert(stores).values({ number: '58' })).rejects.toThrow()
    await expect(testDb.insert(stores).values({ number: '00058' })).rejects.toThrow()
    await expect(testDb.insert(stores).values({ number: '0058' })).resolves.toBeDefined()
  })

  test('number uniqueness is enforced', async () => {
    await testDb.insert(stores).values({ number: '0058' })
    await expect(testDb.insert(stores).values({ number: '0058' })).rejects.toThrow()
  })
})

describe('conditions (living state)', () => {
  async function seedPosition() {
    const brand = await seedBrand()
    const [product] = await testDb.insert(products).values({
      brandId: brand.id, quickName: 'Q', longName: 'L', model: 'M', sku: '1234567', kind: 'camera',
    }).returning()
    const [fixture] = await testDb.insert(fixtures).values({
      slug: 'endcap-1', name: 'Endcap 1', layoutKind: 'endcap', surface: 'gray',
    }).returning()
    const [section] = await testDb.insert(sections).values({
      fixtureId: fixture.id, key: 'endcap', label: 'Endcap',
    }).returning()
    const [position] = await testDb.insert(positions).values({
      sectionId: section.id, idx: 0, productId: product.id,
    }).returning()
    const [store] = await testDb.insert(stores).values({ number: '0058' }).returning()
    return { position, store }
  }

  test('one living row per (store, position) — the upsert target', async () => {
    const { position, store } = await seedPosition()
    await testDb.insert(conditions).values({
      storeId: store.id, positionId: position.id, capturedAt: new Date(), deviceHash: 'a'.repeat(32),
    })
    await expect(
      testDb.insert(conditions).values({
        storeId: store.id, positionId: position.id, capturedAt: new Date(), deviceHash: 'b'.repeat(32),
      })
    ).rejects.toThrow()
  })

  test('note is capped at 280 characters', async () => {
    const { position, store } = await seedPosition()
    await expect(
      testDb.insert(conditions).values({
        storeId: store.id, positionId: position.id, capturedAt: new Date(),
        deviceHash: 'a'.repeat(32), note: 'x'.repeat(281),
      })
    ).rejects.toThrow()
    await expect(
      testDb.insert(conditions).values({
        storeId: store.id, positionId: position.id, capturedAt: new Date(),
        deviceHash: 'a'.repeat(32), note: 'x'.repeat(280),
      })
    ).resolves.toBeDefined()
  })

  test('device_hash must look like a hash, never an IP (S10)', async () => {
    const { position, store } = await seedPosition()
    await expect(
      testDb.insert(conditions).values({
        storeId: store.id, positionId: position.id, capturedAt: new Date(), deviceHash: '203.0.113.7',
      })
    ).rejects.toThrow()
  })

  test('position_id must reference an existing position', async () => {
    const { store } = await seedPosition()
    await expect(
      testDb.insert(conditions).values({
        storeId: store.id, positionId: 999999, capturedAt: new Date(), deviceHash: 'a'.repeat(32),
      })
    ).rejects.toThrow()
  })
})

describe('product_snapshots (frozen rounds, plan §4.1)', () => {
  test('content_hash uniqueness enforces dedup', async () => {
    const brand = await seedBrand()
    const [product] = await testDb.insert(products).values({
      brandId: brand.id, quickName: 'Q', longName: 'L', model: 'M', sku: '1234567', kind: 'camera',
    }).returning()
    await testDb.insert(productSnapshots).values({
      productId: product.id, contentHash: 'hash-a', data: { quickName: 'Q' },
    })
    await expect(
      testDb.insert(productSnapshots).values({
        productId: product.id, contentHash: 'hash-a', data: { quickName: 'Q-changed' },
      })
    ).rejects.toThrow()
  })
})

describe('rounds', () => {
  async function seedFixtureAndStore() {
    const [fixture] = await testDb.insert(fixtures).values({
      slug: 'endcap-1', name: 'Endcap 1', layoutKind: 'endcap', surface: 'gray',
    }).returning()
    const [store] = await testDb.insert(stores).values({ number: '0058' }).returning()
    return { fixture, store }
  }

  test('client_key uniqueness enforces submission idempotency (plan §4.4)', async () => {
    const { fixture, store } = await seedFixtureAndStore()
    const clientKey = '11111111-1111-1111-1111-111111111111'
    await testDb.insert(rounds).values({
      storeId: store.id, fixtureId: fixture.id, deviceHash: 'a'.repeat(32), clientKey,
    })
    await expect(
      testDb.insert(rounds).values({
        storeId: store.id, fixtureId: fixture.id, deviceHash: 'a'.repeat(32), clientKey,
      })
    ).rejects.toThrow()
  })

  test('round_items note is capped at 280 characters', async () => {
    const { fixture, store } = await seedFixtureAndStore()
    const [round] = await testDb.insert(rounds).values({
      storeId: store.id, fixtureId: fixture.id, deviceHash: 'a'.repeat(32),
      clientKey: '22222222-2222-2222-2222-222222222222',
    }).returning()
    const brand = await seedBrand()
    const [product] = await testDb.insert(products).values({
      brandId: brand.id, quickName: 'Q', longName: 'L', model: 'M', sku: '1234567', kind: 'camera',
    }).returning()
    const [section] = await testDb.insert(sections).values({
      fixtureId: fixture.id, key: 'endcap', label: 'Endcap',
    }).returning()
    const [position] = await testDb.insert(positions).values({
      sectionId: section.id, idx: 0, productId: product.id,
    }).returning()

    await expect(
      testDb.insert(roundItems).values({
        roundId: round.id, positionId: position.id, note: 'x'.repeat(281),
      })
    ).rejects.toThrow()
  })
})

describe('store_positions (per-store overrides, plan §4.2)', () => {
  test('composite PK prevents duplicate override rows for the same slot', async () => {
    const brand = await seedBrand()
    const [product] = await testDb.insert(products).values({
      brandId: brand.id, quickName: 'Q', longName: 'L', model: 'M', sku: '1234567', kind: 'camera',
    }).returning()
    const [fixture] = await testDb.insert(fixtures).values({
      slug: 'endcap-1', name: 'Endcap 1', layoutKind: 'endcap', surface: 'gray',
    }).returning()
    const [section] = await testDb.insert(sections).values({
      fixtureId: fixture.id, key: 'endcap', label: 'Endcap',
    }).returning()
    const [position] = await testDb.insert(positions).values({
      sectionId: section.id, idx: 0, productId: product.id,
    }).returning()
    const [store] = await testDb.insert(stores).values({ number: '0058' }).returning()

    // product_id: null is a real, valid state — "this store deliberately
    // keeps this slot empty" — distinct from having no override row at all
    // (= follow the master planogram).
    await testDb.insert(storePositions).values({
      storeId: store.id, positionId: position.id, productId: null,
    })
    await expect(
      testDb.insert(storePositions).values({
        storeId: store.id, positionId: position.id, productId: product.id,
      })
    ).rejects.toThrow()
  })
})

describe('foreign key integrity (no silent cascade deletes)', () => {
  test('deleting a brand that products reference is blocked, not silently cascaded', async () => {
    const brand = await seedBrand()
    await testDb.insert(products).values({
      brandId: brand.id, quickName: 'Q', longName: 'L', model: 'M', sku: '1234567', kind: 'camera',
    })
    // No onDelete: 'cascade' is configured anywhere in schema.ts — deleting a
    // referenced row must fail loudly (NO ACTION/RESTRICT), never silently
    // orphan or wipe dependent rows. History must not be able to vanish by
    // accident.
    await expect(
      testDb.delete(brands).where(eq(brands.id, brand.id))
    ).rejects.toThrow()
  })
})

describe('user + user_brands (brand scoping, plan S4)', () => {
  test('user_brands composite PK prevents duplicate scoping rows', async () => {
    const brand = await seedBrand()
    const [u] = await testDb.insert(user).values({
      id: randomUUID(), email: 'editor@example.com', role: 'editor',
    }).returning()
    await testDb.insert(userBrands).values({ userId: u.id, brandId: brand.id })
    await expect(
      testDb.insert(userBrands).values({ userId: u.id, brandId: brand.id })
    ).rejects.toThrow()
  })

  test('email uniqueness is enforced', async () => {
    await testDb.insert(user).values({ id: randomUUID(), email: 'a@example.com' })
    await expect(
      testDb.insert(user).values({ id: randomUUID(), email: 'a@example.com' })
    ).rejects.toThrow()
  })
})
