# Setup

**Status: partial — this covers what exists today. The polished "stranger self-hosts in five minutes" version is a Phase 6 deliverable (`docs/ROUNDS-PLAN.md` §9).**

## Prerequisites

- **Node 24** (Active LTS). `.nvmrc` and `.node-version` pin it, so `nvm use` in the repo root selects it for that shell only — you do not need to change your global default. CI and Vercel both build on 24, and `package.json` `engines.node` enforces it.
- **npm.** Not pnpm, not yarn, not bun. `package-lock.json` is the lockfile CI and Vercel use; running `pnpm install` here moves npm's packages into `node_modules/.ignored` and leaves you with a tree neither CI nor Vercel will reproduce. If that happens: `rm -rf node_modules pnpm-lock.yaml && npm ci`.
- A free [Neon](https://neon.tech) account (Postgres) — region `us-east-1`
- A free [Upstash](https://upstash.com) account (Redis, for rate limiting) — region `us-east-1`. No credit card required.
- A [Vercel](https://vercel.com) account (hosting)
- A free [Resend](https://resend.com) account (magic-link email for the CMS)

## Local development

1. `npm install`
2. Create a Neon project (region `us-east-1`, see plan §1 item 13) and copy its connection string.
3. `cp .env.example .env.local` and fill in `DATABASE_URL` with that connection string.
4. `npm run db:migrate` — applies the schema.
5. `npm run db:seed` — loads fictional demo data (never real store data — plan §7, S8).
6. `npm run dev` — starts the app at `http://localhost:3000`.

Rate limiting (S2) is inert locally unless you set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them the app logs a warning and allows every write — that is the deliberate "degrade safe, not open" posture (plan §7 S2); validation (S1) and audit (S5) still run. Set them if you specifically want to exercise the 429 path.

## Running tests

Schema/constraint tests run against a **local** Postgres, not your Neon project — this keeps them fast and doesn't spend Neon's free-tier quota (plan §8). The rate-limiter tests stub Upstash entirely, so they need no network.

The test client connects as role `postgres` to database `rounds_test` (that's what CI's Postgres container provides). Override with `TEST_DATABASE_URL` if you want something else.

**macOS (Homebrew).** Homebrew's Postgres creates a superuser named after your macOS account, *not* `postgres`, so you have to create that role once. If you skip this you get `role "postgres" does not exist` (SQLSTATE 28000) and all three DB-backed suites fail while the rate-limiter suite passes.

```bash
brew services start postgresql@16
createuser -s postgres
psql -d postgres -c "ALTER ROLE postgres WITH PASSWORD 'postgres';"
createdb -O postgres rounds_test
npm run test
```

**Linux (Debian/Ubuntu).**

```bash
sudo service postgresql start
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres createdb rounds_test
npm run test
```

`createuser` and `createdb` print nothing on success. If `createdb` says the database already exists, skip it.

## Deploying to Vercel

1. Import the GitHub repo as a Vercel project. Vercel detects Next.js — there is no build or output-directory tuning to do.
2. Set these environment variables for **Production** and **Preview**:

   | Variable | Needed for |
   |---|---|
   | `DATABASE_URL` | everything (Neon, `us-east-1`) |
   | `BETTER_AUTH_SECRET` | **the build itself** — Better Auth initialises at module load, so the build crashes without it even though the survey is loginless. 32+ random chars: `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | CMS login (the deployment's URL) |
   | `RESEND_API_KEY`, `AUTH_EMAIL_FROM` | CMS magic-link email |
   | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | S2 rate limiting. The Vercel Marketplace Upstash integration sets both for you. |

3. Confirm Settings → Functions → region is **Washington, D.C. (`iad1`)**. `vercel.json` pins it; the point is to sit next to Neon and to keep the regional runtime cache to one region.
4. Run `npm run db:migrate` and `npm run db:seed` against Neon **from your own machine** — the migration tooling needs a direct connection.

Pushes to `main` deploy to production; every other branch gets a preview URL. GitHub Actions runs checks only — no deploy secrets live in GitHub.

## Self-hosting somewhere other than Vercel

One thing does not carry over. `src/lib/reads.ts` uses **`'use cache: remote'`**, which asks the host for a durable, shared cache. Vercel supplies that handler automatically; elsewhere you must configure one yourself via Next's [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) option, pointing at Redis or any other shared store.

Do not "fix" this by changing it back to plain `use cache`. That directive is an **in-memory, per-instance** cache. It will look like it works, and it will quietly send every cold instance to Postgres and stop `revalidateTag` from reaching your other instances — which breaks both the free-tier budget (plan §3/§8) and cross-device freshness. See plan §1 #17c.

## What's not set up yet

- Better Auth / magic-link login is built but needs the Resend key + `BETTER_AUTH_URL` above (Phase 2).
- Vercel Web Analytics and the monthly archival Cron Job (Phase 5).

See `docs/ROUNDS-PLAN.md` for the full build order and `docs/WORKLOG.md` for current status.
