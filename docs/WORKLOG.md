# Worklog

Short, running log — date, what changed, what's next. Read this + `ROUNDS-PLAN.md` §9 at the start of every session.

---

## 2026-07-13 — Phase 0 (foundations)

**Status: mostly done. One blocker: waiting on Dean's real Neon connection string to close out `db:migrate`/`db:seed` against production.**

### What changed

- Scaffolded Next.js **16.2.10** (App Router, TS strict, Tailwind v4, ESLint 9) via `create-next-app`.
- Confirmed against installed docs (not memory, per Hard Rule 2): Next 16's caching API is `cacheComponents: true` in `next.config.ts` (already enabled) + `'use cache'`/`cacheTag()`/`cacheLife()`. This replaces `experimental.dynamicIO`/`experimental.useCache` from older training data.
- Installed the full stack: `drizzle-orm` 0.45.2, `@neondatabase/serverless` 1.1.0, `zod` 4.4.3, `better-auth` 1.6.23, `idb-keyval` 6.3.0, `resend` 6.17.2, `drizzle-kit` 0.31.10, `@opennextjs/cloudflare` 1.20.1, `wrangler` 4.110.0, `vitest` 4.1.10, `@playwright/test` 1.61.1, `pg` (test-only), `tsx`, `prettier`.
- Wrote `src/db/schema.ts` — the full Appendix A schema, including CHECK constraints (Drizzle 0.45's `check()` builder, confirmed supported). This file is the source of truth; `docs/ROUNDS-PLAN.md` Appendix A was resynced to match it exactly.
- Wrote `scripts/seed.ts` — fictional-only demo data (S8): 3 brands, 5 flags, 4 fake products, 1 fixture, 5 positions (incl. one planned-empty), 2 demo stores.
- Wrote `tests/schema.test.ts` (18 tests) + `tests/db-test-client.ts` — verifies every unique constraint, CHECK constraint, and FK restrict-on-delete behavior in the schema by actually inserting rows. **Runs against local Postgres, not Neon** (see amendment below) — all 18 pass.
- Wrote `.github/workflows/ci.yml` (typecheck → lint → migrate → test → build, Postgres 16 service container) and `.github/dependabot.yml` (npm + github-actions, weekly).
- Wrote `wrangler.jsonc` — the Appendix D binding *shape* (R2 incremental cache, D1 tag cache, DO revalidation queue, rate limiters, monthly archival cron). IDs are placeholders — real resources get created in Cloudflare once Dean's account work happens; this isn't a working deploy config yet.
- Added plan **S7** (security headers: CSP, Referrer-Policy, X-Content-Type-Options) to `next.config.ts` now, since it's global and has zero dependencies — no reason to wait for Phase 3.
- Wrote `LICENSE` (MIT), `README.md`, `SETUP.md` (partial — full version is a Phase 6 deliverable), `docs/ROUNDS-PLAN.md`, `docs/ROUNDS-PRIMER.md` (copied in), and extended `AGENTS.md` (which `CLAUDE.md` already imports) with the session-start checklist and non-negotiables.
- Removed the default `create-next-app` placeholder content: `next/font/google` (see amendment below), the Vercel/Next.js template boilerplate on `/`, and the default SVG icons in `public/`.
- Full local verification, exactly as CI will run it (no `.env.local` present, env vars only): typecheck ✅, lint ✅, 18/18 schema tests ✅, production build ✅.

### Amendments to the locked plan (all logged in plan §1, with full rationale in the plan itself — this is the short version)

1. **DB region → `us-east-1`** (was `us-east-2`). Dean's call: several platforms in this stack (Resend included) only offer `us-east-1`; colocating removes a needless cross-region hop. Plan §1 item 13.
2. **Repo public from commit one** (was private-until-Phase-6). Dean's call: source visibility was never the actual risk — a live unprotected endpoint is — and that risk window doesn't exist because S1/S2/S5–S7 ship in the same commits as the endpoints they protect (Phase 3). Plan §1 item 11, S8.
3. **Auth library: Better Auth, not Auth.js v5.** Found mid-scaffold: Auth.js v5 has been in beta 2+ years with no GA date, and the project is now organizationally part of Better Auth, which the maintainers recommend for new projects. Presented to Dean as a real fork (not silently substituted); he chose Better Auth. It's on a real stable release line (1.6.23), has official Drizzle+Postgres support, and its `disableSignUp: true` flag enforces the S3 allowlist as a first-class option instead of a hand-rolled callback. Plan §1 item 14, Appendix C fully rewritten and verified against the installed package (`better-auth/adapters/drizzle` subpath — no separate adapter package needed).
4. **Schema/constraint tests run against local Postgres, not Neon.** Discovered while trying to seed: `drizzle-orm/neon-http` only speaks to Neon's actual HTTP endpoint — it can't point at a local or CI Postgres. Rather than skip this done-when criterion, added a second, test-only Drizzle client (`drizzle-orm/node-postgres`) pointed at local/CI Postgres. `schema.ts` is dialect-portable Postgres, so what passes locally is exactly what Neon enforces — and this keeps CI off Neon's free-tier compute/storage quota entirely. Documented in the primer as Hard Rule 11.
5. **Dropped `next/font/google` from the Phase 0 placeholder layout.** It fetches font files from `fonts.googleapis.com` at *build* time, which failed in this sandboxed dev container (network policy blocks the domain) and is a fragile dependency for any build environment generally. Using a system font stack as a placeholder; Phase 1 (design system) picks the real typeface, self-hosted via `next/font/local` if it's a Google Font, so no build ever makes an external network call for it again.

### Blocked on

**Dean's real Neon `us-east-1` connection string.** Everything that doesn't need it is done and verified (schema, migration, generated SQL, constraint tests, CI, build). `npm run db:migrate && npm run db:seed` against the actual production Neon project — Phase 0's literal done-when wording — still needs to run once. Low risk (migration SQL already applies cleanly to a real Postgres 16 locally; Neon is Postgres 16-compatible), but not yet verified against the real target.

### Not done yet (intentionally — later phases, not gaps)

- No real Cloudflare resources exist yet (`wrangler.jsonc` has placeholder IDs) — GitHub repo isn't connected to Workers Builds yet either. Both are manual dashboard steps for Dean; revisit before Phase 3 needs the rate limiters for real and Phase 5 needs the cache bindings for real.
- Better Auth isn't wired up yet (config exists only as a plan appendix) — that's literally what Phase 2 is.
- No git commits made yet in this repo — everything above exists as files on disk, built in a cloud sandbox, pending delivery to Dean's machine and his own `git init`/push (see handoff message for exact commands).

### Next session

Once the Neon connection string lands: run `db:migrate` + `db:seed` against it, confirm Phase 0's done-when is fully green, then start Phase 1 (design system — `@theme` tokens, primitives, `/kitchen-sink`) per plan §9.
