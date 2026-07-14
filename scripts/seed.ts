// Rounds — seed script (realigned, plan §1 #15). Idempotent: safe to re-run.
//
// S8 note (plan §7): no REAL Best Buy data may live in this repo. Camera
// model names are public product knowledge, so the master list below is
// fine to seed — but the SKUs are placeholders (99900xx), and per-store
// layouts (which camera sits where in which store) are created by reps in
// production only, never here.
//
// Run via `npm run db:seed`.
import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzleNodePg, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  brands, products, fixtures, fixtureBrands, sections, positions,
  stores, flags,
} from '../src/db/schema'
import { user } from '../src/db/auth-schema'
import * as schema from '../src/db/schema'
import * as authSchema from '../src/db/auth-schema'
import { FLOOR, FLAG_VOCAB } from '../src/lib/floor'

// The app runtime is Neon-HTTP only (plan §2), but that driver cannot reach
// a local Postgres — so this dev-only script picks by URL: localhost gets
// node-postgres (also lets CI verify the seed), anything else gets Neon.
const fullSchema = { ...schema, ...authSchema }
type SeedDb = NodePgDatabase<typeof fullSchema>
function makeDb(): SeedDb {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  if (/localhost|127\.0\.0\.1/.test(url)) {
    return drizzleNodePg(new Pool({ connectionString: url }), { schema: fullSchema })
  }
  // Structurally identical query API; cast keeps one code path below.
  return drizzleNeon(url, { schema: fullSchema }) as unknown as SeedDb
}
const db = makeDb()

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'dean@sharpsightedstudio.com').toLowerCase()

// Starter master list — Dean refines this in the CMS (products page).
// quickName is what reps see on the survey; keep them short.
const MASTER_LIST: Record<'canon' | 'nikon' | 'sony', string[]> = {
  canon: [
    'EOS R100', 'EOS R50', 'EOS R10', 'EOS R8', 'EOS R7',
    'EOS R6 II', 'EOS R5', 'Rebel T7', 'PowerShot V10', 'VIXIA HF G70',
  ],
  nikon: [
    'Z30', 'Z50', 'Zfc', 'Zf', 'Z5', 'Z6 III', 'Z7 II', 'Z8', 'Coolpix P1000',
  ],
  sony: [
    'A1', 'A9 III', 'A7R V', 'A7 V', 'A7 IV', 'A7C II', 'A7CR',
    'A6700', 'A6400', 'A6100', 'ZV-E10 II', 'ZV-1 II', 'ZV-E1',
    'FX30', 'RX100 VII',
  ],
}

async function main() {
  console.log('Seeding fixed floor + starter master list (idempotent)...')

  // ── brands ──
  await db.insert(brands).values([
    { slug: 'canon', name: 'Canon', accent: '#c8102e', sort: 1 },
    { slug: 'nikon', name: 'Nikon', accent: '#ffe100', sort: 2 },
    { slug: 'sony', name: 'Sony', accent: '#ff6f00', sort: 3 },
  ]).onConflictDoNothing()
  const brandRows = await db.select().from(brands)
  const brandBySlug = new Map(brandRows.map((b) => [b.slug, b]))

  // ── flags: exactly the four (plan §1 #15f) ──
  for (const f of FLAG_VOCAB) {
    await db.insert(flags).values({ ...f, active: true })
      .onConflictDoUpdate({ target: flags.key, set: { label: f.label, sort: f.sort, active: true } })
  }

  // ── master list (placeholder SKUs; CMS owns this from here) ──
  let skuCounter = 9900001
  for (const [slug, names] of Object.entries(MASTER_LIST)) {
    const brand = brandBySlug.get(slug)
    if (!brand) throw new Error(`brand ${slug} missing`)
    for (const quickName of names) {
      await db.insert(products).values({
        brandId: brand.id,
        quickName,
        longName: `${brand.name} ${quickName}`,
        model: quickName.replace(/\s+/g, '-').toUpperCase(),
        sku: String(skuCounter++),
        kind: 'camera',
      }).onConflictDoNothing() // sku unique — re-runs are no-ops
    }
  }

  // ── fixed floor geometry, 1:1 from src/lib/floor.ts ──
  for (const table of FLOOR) {
    let [fixture] = await db.select().from(fixtures).where(eq(fixtures.slug, table.slug))
    if (!fixture) {
      ;[fixture] = await db.insert(fixtures).values({
        slug: table.slug,
        name: table.name,
        layoutKind: table.layoutKind,
        surface: table.surface === 'wood' ? 'wood' : 'gray',
      }).returning()
      const brand = brandBySlug.get(table.brandSlug)
      if (brand) await db.insert(fixtureBrands).values({ fixtureId: fixture.id, brandId: brand.id }).onConflictDoNothing()
    }

    let sort = 0
    for (const side of table.sides) {
      for (const sec of side.sections) {
        sort += 1
        let [row] = await db.select().from(sections)
          .where(and(eq(sections.fixtureId, fixture.id), eq(sections.key, sec.key)))
        if (!row) {
          ;[row] = await db.insert(sections).values({
            fixtureId: fixture.id, key: sec.key, label: sec.label, sort,
          }).returning()
          // capacity slots, idx 0..capacity-1, all planned-empty: reps assign
          // cameras per store (store_positions), never here.
          await db.insert(positions).values(
            Array.from({ length: sec.capacity }, (_, idx) => ({ sectionId: row.id, idx, productId: null })),
          )
        }
      }
    }
  }

  // ── demo stores (fictional numbers) ──
  await db.insert(stores).values([
    { number: '0001', nickname: 'Demo Store A' },
    { number: '0002', nickname: 'Demo Store B' },
  ]).onConflictDoNothing()

  // ── first admin (S3 allowlist) ──
  await db.insert(user)
    .values({ id: randomUUID(), email: ADMIN_EMAIL, name: 'Admin', emailVerified: true, role: 'admin' })
    .onConflictDoNothing()

  const positionCount = await db.select().from(positions).then((r) => r.length)
  console.log(`Seed complete: 3 brands, ${FLAG_VOCAB.length} flags, master list seeded, 3 fixtures, ${positionCount} positions, admin ${ADMIN_EMAIL}.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
