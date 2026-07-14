// Rounds — DB client. Uses the Neon HTTP driver (plan §2): no connection
// pooling to exhaust under serverless. Every query is one HTTP round trip,
// which is exactly why §3's "reads never touch the database" rule exists —
// N queries on a page means N round trips, not N cheap pool checkouts.
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import * as authSchema from './auth-schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.')
}

export const fullSchema = { ...schema, ...authSchema }

export const db = drizzle(process.env.DATABASE_URL, { schema: fullSchema })
