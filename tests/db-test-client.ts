// Test-only Postgres client. Schema/constraint tests run against a LOCAL
// Postgres, never against Neon — this keeps CI fast, free of network
// flakiness, and doesn't spend any of Neon's free-tier compute/storage
// quota (plan §8) on test runs. schema.ts is dialect: 'postgresql' and
// portable, so what passes here is what Neon will enforce in production.
//
// The app's actual runtime client (src/db/index.ts) stays on the Neon HTTP
// driver, as locked in the plan — this file is test infrastructure only,
// never imported from src/.
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import * as schema from '../src/db/schema'
import * as authSchema from '../src/db/auth-schema'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/rounds_test'

export const pool = new Pool({ connectionString: TEST_DATABASE_URL })
export const testDb = drizzle(pool, { schema: { ...schema, ...authSchema } })

export async function migrateTestDb() {
  await migrate(testDb, { migrationsFolder: './drizzle' })
}

const TABLES = [
  'audit_log', 'round_items', 'rounds', 'product_snapshots', 'conditions',
  'store_positions', 'stores', 'positions', 'sections', 'fixture_brands',
  'fixtures', 'user_brands', 'session', 'account', 'verification', 'user',
  'flags', 'products', 'brands',
]

export async function resetTestDb() {
  await pool.query(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
}
