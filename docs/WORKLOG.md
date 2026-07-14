# Worklog

Short, running log — date, what changed, what's next. Newest first. Read this + `ROUNDS-PLAN.md` §9 at the start of every session.

---

## 2026-07-14 — Phase 1 (design system) — 🚧 first pass delivered, in design review

**Status: first pass built and delivered; awaiting Dean's design feedback, then iterate.** Direction chosen by Dean: **LIGHT & TECHNICAL, legibility-first** (used on varying-quality phones on a bright Best Buy floor — dark washes out under fluorescents on cheap screens, so light + heavy contrast wins). Dark is kept as a swappable `[data-theme="dark"]` token set for later, not the target.

Built (branch `feature/phase-1-design-system`, commit 88c3f17):
- `src/app/globals.css` — Tailwind v4 `@theme` token system. Semantic CSS vars (bg/surface/border/text, 3 brand accents, status) mapped via `@theme inline` so `data-theme` re-themes at runtime with no rebuild. 16px-min type scale, sharp (0) radii, strong focus ring, reduced-motion + text-size-adjust guards.
- Fonts: self-hosted **Geist Sans/Mono via the `geist` npm package** — no build-time Google fetch (this is the clean resolution of the Phase-0 `next/font/google` problem; amendment 5). Files ship in the dependency.
- `src/components/icons/` — hand-rolled 21-glyph icon set (no icon library, plan §2); camera aperture/shutter/lens are the identity.
- `src/components/ui/` — primitives: Button (4 variants × 3 sizes × states), Field (label/hint/error/mono), Chip (BrandChip + StatusChip), FlagToggle (the core survey interaction), Sheet (bottom sheet: scrim, Escape, scroll-lock), TablePlan (signature survey surface — sections, slots, flag edges, empty-slot state).
- `src/app/kitchen-sink/page.tsx` — renders every component in every state with a light/dark toggle. Live at `/kitchen-sink` after deploy.
- `src/lib/cn.ts` — tiny local class joiner (no clsx/tailwind-merge dep).

Verified: typecheck / lint / next build / opennext build all green. **Rendered in-sandbox with Playwright** (Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` — the project's pinned PW wants a newer build, so pass `executablePath`) at 402px phone width — light, dark, and sheet-open screenshots all looked clean and legible; sent to Dean for review.

**Next:** incorporate Dean's design feedback (colors, spacing, type, the hand-rolled glyphs, component states), confirm the real brand-accent hex values with him, then finalize Phase 1 and move to Phase 2 (CMS). `/kitchen-sink` is a dev/review route — decide before public launch whether to keep or gate it (harmless now: no data).

---

## 2026-07-13 — Phase 0 (foundations) — ✅ COMPLETE

**Status: all 4 done-when criteria green.** (1) Schema constraints verified by 18 Vitest tests. (2) `db:migrate` + `db:seed` confirmed against real Neon (Dean's machine). (3) GitHub Actions CI green on `main` — 3 runs passed (CI #1/#2/#3). (4) Hello page auto-deploys to workers.dev — **live at https://rounds.dean-221.workers.dev** via Workers Builds (OpenNext → Cloudflare, first deploy 2026-07-13, Worker cold-start 31 ms). Audited 2026-07-14 (see audit entry below) — clean, cleared to start Phase 1.

### Deploy went live (2026-07-13)

Cloudflare Workers Builds is connected to the GitHub repo on the **Dean@sharpsightedmedia.online** account (Worker name `rounds`, production branch `main`, build cmd `npx opennextjs-cloudflare build`, deploy cmd `npx wrangler deploy`, non-prod branches build with `wrangler versions upload` for preview URLs). Every push to `main` now auto-deploys. Two benign defaults noted in the deploy log: `workers_dev` URL auto-enabled (that's the live link) and preview URLs enabled for non-prod branches — both are Cloudflare defaults because they're not pinned in `wrangler.jsonc`; pin `workers_dev`/`preview_urls` explicitly later if desired (e.g. when moving to a custom domain). No runtime env vars set yet — the hello page touches no DB. `DATABASE_URL` gets added as a Worker secret before Phase 3.

### Cloudflare / OpenNext deploy wiring (2026-07-13, done in sandbox)

Dean chose to wire the deploy now rather than defer it (honoring the plan's "wire deploy day one" principle). Done on branch `feature/phase-0-cloudflare-deploy` → merged to `develop` → `main`:

- `open-next.config.ts` — **minimal (defaults only) on purpose.** Nothing in the app caches yet (tag-based cache reads are Phase 3, plan §3), so R2/D1/DO bindings would be inert today, and every declared binding must map to a real resource or `wrangler deploy` fails. The full R2 + D1 + DO override setup (locked in plan Appendix D) is preserved as a commented block in both this file and `wrangler.jsonc`, to switch on in Phase-3 prep — the two files must change in lockstep (open-next overrides and wrangler bindings have to agree or the build breaks).
- `wrangler.jsonc` — simplified to the minimal deploy-ready set (name, main, compat flags, assets binding). No placeholder resource IDs left that would break deploy. Full caching stack commented at the bottom.
- `next.config.ts` — added `initOpenNextCloudflareForDev()` (canonical OpenNext dev hook; no-op for prod build).
- `package.json` — added `cf:build`, `cf:preview`, `cf:deploy`, `cf:typegen` scripts.
- `.gitignore` — ignores `/.open-next/`, `.wrangler`, `cloudflare-env.d.ts`. `.node-version` (22) added for Workers Builds.
- **Verified in sandbox: `npx opennextjs-cloudflare build` succeeds** — produces `.open-next/worker.js`. That's the whole Next 16 → OpenNext → Worker bundle pipeline proven working before Dean touches the dashboard. All checked against the installed `@opennextjs/cloudflare` 1.20.1 (not memory).

What this session CANNOT do (needs Dean): `wrangler deploy` itself (Cloudflare auth + network — sandbox has neither), creating the Cloudflare Workers project, and connecting the GitHub repo to Workers Builds. Exact steps handed to Dean in chat.

### Neon network note

**The cloud sandbox this session builds in cannot reach Neon's network** (`403 Host not in allowlist` on the Neon API host — outbound is allowlisted to package registries only, same class of restriction that blocked fonts.googleapis.com earlier). So `db:migrate`/`db:seed` against production was run by Dean on his own machine — **confirmed successful 2026-07-13**: migration applied, seed loaded (3 brands, 5 flags, 4 fictional products, 1 fixture, 5 positions, 2 demo stores). The seed ran through `src/db/index.ts` (the real neon-http runtime driver), so the production data path is proven working from Dean's machine. (Benign SSL deprecation warning from drizzle-kit's `pg` driver about a future pg v9 reinterpretation of `sslmode=require` — does not affect the neon-http runtime; future-proof later by pinning `sslmode=verify-full` if desired.)

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

GitHub default branch is now `main` (was `master` at repo creation — Dean switched the default and deleted the stray `master`, which only held an unrelated placeholder "Initial commit"). `main` and `develop` are pushed to `origin`.

### Not done yet (intentionally — later phases, not gaps)

- The full R2 + D1 + Durable Object caching stack is not wired — deliberately deferred to Phase-3 prep (see the deploy wiring entry; the full config is preserved commented in `open-next.config.ts` + `wrangler.jsonc` + plan Appendix D). Nothing caches until there are real reads.
- Rate limiters (plan S2) and the archival cron (plan §8) are commented in `wrangler.jsonc`, added when Phases 3/5 need them.
- Better Auth isn't wired up yet (config exists only as plan Appendix C) — that's Phase 2.
- Branch housekeeping (optional): `feature/phase-0-db-verify` and `feature/phase-0-cloudflare-deploy` are merged/stale and can be pruned whenever.

### Next session — Phase 1 (design system)

Phase 0 is done and audited clean. Start Phase 1 per plan §9: Tailwind v4 `@theme` tokens (neutrals, 3 brand accents, type/spacing/radii — sharp corners, motion), fonts via `next/font/local` (self-hosted with the `.woff2` committed to the repo — NOT `next/font/google`, which fetches from Google at build time and would make every build depend on an external host; see amendment 5 in the amendments section above), component primitives (Button, Field, Chip, FlagToggle, Sheet, TablePlan), and the `/kitchen-sink` route rendering every component in every state.

### Audit (2026-07-14)

Full Phase-0 audit run before starting Phase 1. Result: **clean, no blockers.** Verified: typecheck / lint / 18 tests / `next build` / `opennextjs-cloudflare build` all green from scratch; git history carries no secrets and no `.env.local` (only `.env.example`, placeholders only); `.env.local` gitignored; seed data fictional (S8); S7 security headers confirmed compiled into the build (exact CSP in routes-manifest, applied to all document routes via the server function, not bypassed by the assets binding); schema.ts byte-identical to plan Appendix A; no stale `next-auth`/`us-east-2`/`master`-branch references in code. Minor/known items (none blocking): 2 moderate npm advisories (esbuild dev-server + PostCSS build-time — both non-exploitable in our context, no untrusted-input path, Dependabot tracks upstream fixes); `.gitignore` had a redundant `.env.*` line alongside `.env*` (cleaned up in the same commit as this entry); CSP still uses `'unsafe-inline'` for scripts/styles (Next default; nonce-based CSP is a future hardening, beyond plan S7 scope).
