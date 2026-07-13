# Rounds

A vendor table survey tool for Best Buy camera departments — Sony, Canon, Nikon. Open source, free to host, built for loginless use by field reps across ~1,000 stores.

**Status: Phase 0 (foundations) — see [`docs/WORKLOG.md`](docs/WORKLOG.md) for exactly where things stand.**

## What this is

Reps walk a store's camera tables and report what's broken, missing, or out of place. The CMS lets brand editors keep the catalog and planogram (what's supposed to be where) current. Every submitted "round" freezes a dated snapshot of what a rep actually found, independent of later catalog changes.

Full design, data model, security spec, and build order: [`docs/ROUNDS-PLAN.md`](docs/ROUNDS-PLAN.md).

## Stack

Next.js 16 (App Router, TS strict) · Postgres on Neon (`neon-http` driver) · Drizzle ORM · Better Auth (CMS login only — the survey itself is loginless) · Tailwind v4 · Zod · IndexedDB write queue · Cloudflare Workers via OpenNext.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL (Neon) and other secrets
npm run db:migrate
npm run db:seed              # fictional demo data only — see docs/ROUNDS-PLAN.md §7 (S8)
npm run dev
```

Schema/constraint tests run against a **local** Postgres, not Neon (keeps CI fast and off Neon's free-tier quota):

```bash
# one-time setup, if not already running:
#   sudo service postgresql start
#   sudo -u postgres psql -c "CREATE DATABASE rounds_test;"
npm run test
```

```bash
npm run typecheck
npm run lint
npm run build
```

## License

MIT — see [`LICENSE`](LICENSE).
