// Rounds — DB client. Uses the Neon HTTP driver (plan §2): no connection
// pooling to exhaust under serverless. Every query is one HTTP round trip,
// which is exactly why §3's "reads never touch the database" rule exists —
// N queries on a page means N round trips, not N cheap pool checkouts.
//
// LAZY on purpose: the client is created on first use, NOT at import. This
// matters because `next build` (and Cloudflare Workers Builds) evaluate
// every route module at build time, where runtime secrets like DATABASE_URL
// are deliberately absent. Throwing at import would fail the build; instead
// we only require DATABASE_URL when a query actually runs (at request time,
// where the Worker secret is present).
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import * as authSchema from './auth-schema'

export const fullSchema = { ...schema, ...authSchema }
type DB = NeonHttpDatabase<typeof fullSchema>

let instance: DB | null = null

// Only ever hit at BUILD time (Workers Builds has no runtime secrets). The
// build accesses `db` to *construct* queries but never executes them (dynamic
// pages defer to request time), so a placeholder here is never connected to.
// At runtime the real DATABASE_URL secret is always present.
const BUILD_PLACEHOLDER = 'postgresql://build:build@localhost/placeholder'

function resolve(): DB {
  if (!instance) {
    const url = process.env.DATABASE_URL
    if (!url) {
      console.warn('[rounds] DATABASE_URL not set — using a build placeholder (no queries will run against it).')
    }
    instance = drizzle(url ?? BUILD_PLACEHOLDER, { schema: fullSchema })
  }
  return instance
}

// A proxy so `import { db }` works everywhere and every access forwards to the
// real client, created on first use. No DB connection is made at import time.
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const real = resolve()
    const value = Reflect.get(real as object, prop, receiver)
    return typeof value === 'function' ? value.bind(real) : value
  },
}) as DB
