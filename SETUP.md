# Setup

**Status: partial — this covers what exists after Phase 0. The polished "stranger self-hosts in five minutes" version is a Phase 6 deliverable (`docs/ROUNDS-PLAN.md` §9).**

## Prerequisites

- Node 22+
- A free [Neon](https://neon.tech) account (Postgres)
- A free [Cloudflare](https://cloudflare.com) account with Workers + R2 enabled (hosting — wired up in a later phase)
- A free [Resend](https://resend.com) account (magic-link email — wired up in Phase 2)

## Local development

1. `npm install`
2. Create a Neon project (region `us-east-1`, see plan §1 item 13) and copy its connection string.
3. `cp .env.example .env.local` and fill in `DATABASE_URL` with that connection string.
4. `npm run db:migrate` — applies the schema.
5. `npm run db:seed` — loads fictional demo data (never real store data — plan §7, S8).
6. `npm run dev` — starts the app at `http://localhost:3000`.

## Running tests

Schema/constraint tests run against a **local** Postgres, not your Neon project — this keeps them fast and doesn't spend Neon's free-tier quota (plan §8).

```bash
sudo service postgresql start   # if not already running
sudo -u postgres psql -c "CREATE DATABASE rounds_test;"
npm run test
```

## What's not set up yet

- Cloudflare Workers deployment (`wrangler.jsonc` bindings are scaffolded with placeholder IDs — real R2/D1/Durable Object resources get created and wired in later phases).
- Better Auth / magic-link login (Phase 2).
- CI secrets on GitHub (Dependabot is on; deploy secrets aren't needed yet since Workers Builds handles deploys once connected).

See `docs/ROUNDS-PLAN.md` for the full build order and `docs/WORKLOG.md` for current status.
