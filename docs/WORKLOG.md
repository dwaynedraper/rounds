# Worklog

Short, running log — date, what changed, what's next. Read this + `ROUNDS-PLAN.md` §9 at the start of every session.

---

## 2026-07-13 — Phase 0 (foundations)

**Status: mostly done. New blocker found (see bottom of this entry): the cloud sandbox this session builds in cannot reach Neon's network — `db:migrate`/`db:seed` against production has to run from Dean's own machine, not from here.**

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

**The cloud sandbox this session runs in cannot reach Neon.** `node --env-file .env.local` against the real `us-east-1` connection string returned `403 Host not in allowlist: api.c-9.us-east-1.aws.neon.tech` — this sandbox's outbound network is allowlisted to package registries (npm, git hosts) and not much else. Same root cause as the `fonts.googleapis.com` build failure earlier in Phase 0 (see below), just hitting a different host. **This means `npm run db:migrate` / `npm run db:seed` against production Neon has to run from Dean's own machine, in his own Terminal — not from this sandbox, and not via `device_bash` either (that has no network access at all, by design).** Everything else needed to run it is already correct and verified: schema, generated migration SQL (applies cleanly to real Postgres 16 locally), seed script, `.env.example`.

### Repo/branch reconciliation (2026-07-13, mid-session)

Dean independently fixed the same `.gitignore` bug (`.env.example` was matched by `.env*` and never got tracked) at the same time this session did, directly on his local `main` via his own Terminal. Reconciled by resetting `develop`/`feature/phase-0-db-verify` onto his `main`. In the process found his fix only patched `.gitignore`'s pattern — `.env.example` itself had never actually been committed on either side — so it was recreated and committed properly. All three branches (`main`, `develop`, `feature/phase-0-db-verify`) now converge at the same commit.

**Standing pattern going forward:** the device bridge that syncs files to Dean's machine cannot delete or overwrite existing files (a deliberate restriction on it) — but git `checkout`/`reset` need to do exactly that whenever a tracked file changes across commits. Creating brand-new files through the bridge works fine; updating existing ones doesn't. So: this session keeps building in the cloud sandbox and hands Dean a git bundle after each sync point, but **Dean runs the `fetch` + `reset`/`merge` step himself, in his own Terminal** — not through `device_bash`. Same logic now applies to anything hitting Neon (see above): sandbox for building, Dean's own machine for git writes and DB writes.

### Not done yet (intentionally — later phases, not gaps)

- No real Cloudflare resources exist yet (`wrangler.jsonc` has placeholder IDs) — GitHub repo isn't connected to Workers Builds yet either. Both are manual dashboard steps for Dean; revisit before Phase 3 needs the rate limiters for real and Phase 5 needs the cache bindings for real.
- Better Auth isn't wired up yet (config exists only as a plan appendix) — that's literally what Phase 2 is.
- Repo isn't pushed to GitHub yet — commits exist locally on Dean's machine (`~/projects/rounds`), remote `origin` is configured (points at his GitHub repo, default branch appears to be `master` there — worth checking/aligning with `main` before the first push), but no `git push` has happened yet.

### Next session

Waiting on Dean to run `npm install && npm run db:migrate && npm run db:seed` in his own Terminal against real Neon (this sandbox can't reach it — see above). Once he confirms success, Phase 0's done-when is fully green and Phase 1 (design system — `@theme` tokens, primitives, `/kitchen-sink`) starts per plan §9.
