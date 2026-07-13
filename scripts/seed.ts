// Rounds — seed script. S8 (plan §7): this data must always be FICTIONAL.
// Real planograms and store numbers live only in the production DB, never
// in this repo — the repo is public from commit one.
// Run via `npm run db:seed` (uses tsx --env-file=.env.local — no dotenv needed).
import { db } from '../src/db'
import {
  brands, products, fixtures, fixtureBrands, sections, positions,
  stores, flags,
} from '../src/db/schema'

async function main() {
  console.log('Seeding fictional demo data...')

  const [sony, canon, nikon] = await db.insert(brands).values([
    { slug: 'sony', name: 'Sony', accent: '#ff6f00', sort: 1 },
    { slug: 'canon', name: 'Canon', accent: '#c8102e', sort: 2 },
    { slug: 'nikon', name: 'Nikon', accent: '#ffe100', sort: 3 },
  ]).returning()

  await db.insert(flags).values([
    { key: 'broken', label: 'Broken / not powering on', sort: 1 },
    { key: 'missing', label: 'Missing from fixture', sort: 2 },
    { key: 'demo-mode-off', label: 'Demo mode not active', sort: 3 },
    { key: 'wrong-lens', label: 'Wrong lens attached', sort: 4 },
    { key: 'cosmetic', label: 'Cosmetic damage', sort: 5 },
  ])

  const demoProducts = await db.insert(products).values([
    { brandId: sony.id, quickName: 'Demo Alpha 7', longName: 'Sample Alpha 7 Demo Unit', model: 'DEMO-A7', sku: '9990001', kind: 'camera' },
    { brandId: sony.id, quickName: 'Demo 24-70 Lens', longName: 'Sample 24-70mm f/2.8 Lens', model: 'DEMO-2470', sku: '9990002', kind: 'lens' },
    { brandId: canon.id, quickName: 'Demo EOS R', longName: 'Sample EOS R Demo Unit', model: 'DEMO-EOSR', sku: '9990003', kind: 'camera' },
    { brandId: nikon.id, quickName: 'Demo Z6', longName: 'Sample Z6 Demo Unit', model: 'DEMO-Z6', sku: '9990004', kind: 'camera' },
  ]).returning()

  const [fixture] = await db.insert(fixtures).values([
    { slug: 'demo-endcap', name: 'Demo Endcap', layoutKind: 'endcap', surface: 'gray' },
  ]).returning()

  await db.insert(fixtureBrands).values([
    { fixtureId: fixture.id, brandId: sony.id },
    { fixtureId: fixture.id, brandId: canon.id },
    { fixtureId: fixture.id, brandId: nikon.id },
  ])

  const demoSections = await db.insert(sections).values([
    { fixtureId: fixture.id, key: 'endcap', label: 'Endcap', sort: 1 },
    { fixtureId: fixture.id, key: 'lens', label: 'Lens Wall', sort: 2 },
  ]).returning()

  await db.insert(positions).values([
    { sectionId: demoSections[0].id, idx: 0, productId: demoProducts[0].id },
    { sectionId: demoSections[0].id, idx: 1, productId: demoProducts[2].id },
    { sectionId: demoSections[0].id, idx: 2, productId: demoProducts[3].id },
    { sectionId: demoSections[0].id, idx: 3, productId: null }, // planned-empty slot
    { sectionId: demoSections[1].id, idx: 0, productId: demoProducts[1].id },
  ])

  await db.insert(stores).values([
    { number: '0001', nickname: 'Demo Store A' },
    { number: '0002', nickname: 'Demo Store B' },
  ])

  console.log('Seed complete: 3 brands, 5 flags, 4 fictional products, 1 fixture, 5 positions, 2 demo stores.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
