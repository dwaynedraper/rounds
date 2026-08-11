# Worklog

Short, running log — date, what changed, what's next. Newest first. Read this + `ROUNDS-PLAN.md` §9 at the start of every session.

---

## 2026-07-24 — Product fields relaxed + report format rewritten (plan §1 #20) — ✅

Both from Dean, from the floor, after walking a real store on the preview.

### Only brand + quick name are required

`long_name`, `model` and `sku` are now nullable. Brand ties a camera to a table and quick name is what a rep reads while walking — those two are the job. Demanding a long name, a model code and a 7-digit SKU before a camera could exist meant hitting a wall mid-round over data nobody carries on the floor.

Migration `0003`: three `ALTER COLUMN ... DROP NOT NULL`. No table rewrite, no data loss, safe to run against Neon while the app is live.

Two details worth keeping straight:

- **Optional is not unvalidated.** A SKU that IS supplied must still be exactly 7 digits. A half-typed SKU looks authoritative and is worse than none.
- **`sku` stays UNIQUE.** Postgres permits any number of NULLs in a unique index, so "SKU unknown" never collides with another "SKU unknown". And the existing `products_sku_format` CHECK needed no change: a CHECK is violated only when it evaluates to FALSE, and `NULL ~ '...'` is NULL. Both facts are now covered by tests that insert rows rather than assert on intent.

Empty-string handling was the non-obvious part. An HTML form submits `""` for an untouched text input, so `""` has to normalise to `null` in the Zod layer or the fields would be optional in name only. Same transform serves the bulk importer, which already passes `""` for missing cells.

### Report format

Was: `Nikon / Right wall #1 — Z30: alarm, missing — This is a note about…`
Now:

```
Store 0148
Canon EOS R: missing, broken
Canon EOS R8: no-power
Nikon Z30: alarm, missing — Loose from the mount, told MOD
```

Brand and quick name only. The wall label and position number are gone — whoever reads this is standing at the table and identifies the camera by name, so the location was noise that pushed the useful part off a phone screen. Notes stay on the same line after an em dash (Dean's choice when asked; one line per camera is the rule that keeps it scannable).

`tests/report.test.ts` pins the format character for character, including the absence of a blank line under the header. The format IS the feature here — it is what reps paste into a text at the end of a walk — so it gets tests rather than a comment.

Also hardened `buildReport` against a section shorter than its capacity. `buildTableViews` never emits one, but the test fixture did, and a crash there would eat a rep's whole walk.

**Tests 45 → 51.** Appendix A resynced to `schema.ts` again in the same commit, per the rule that they change together.

---

## 2026-07-24 — Preview verified on Vercel; Sheet focus bug found and fixed — ✅

**The migration's load-bearing claim is confirmed in production.** Dean flagged a camera on his phone against the Vercel preview and it appeared on a second device. That is `'use cache: remote'` + `revalidateTag` working across function instances — the thing plain `use cache` would have broken silently (§1 #17c). Neon is migrated and seeded (3 brands, 4 flags, 3 fixtures, 64 positions, admin row). CI green, Vercel preview deployed. The one failing PR check is Cloudflare Workers Builds, which is correct — it is still watching the repo and the files it needs are gone. Unrequired, so it does not block the merge; disconnect it in the Cloudflare dashboard.

### Bug: text fields blurred after one keystroke — ✅ fixed

**Symptom (Dean, on the preview):** in layout-edit mode, typing into a field blurred after a single character. Click back in, one more character, blur again.

**Root cause — NOT the controlled inputs**, which was the obvious first suspect and is worth recording as ruled out. `Sheet` listed `onClose` in its effect's dependency array. Every caller passes an inline arrow (`onClose={() => setPickFor(null)}`), a new function identity per render, so the effect tore down and re-ran on *every* parent render — including the one caused by typing a character into a controlled field inside the sheet. Re-running it hit `panelRef.current?.focus()`, moving focus off the input onto the dialog panel.

**How controlled-component causes were eliminated**, rather than assumed:
- A controlled-value bug drops or reverts the character while focus *stays*. Here the character was kept and focus *moved* — different signature.
- An inline-component remount would lose the value too. The value survived.
- Decisive: reverting **only** the dependency array, touching nothing about the inputs or their state, reproduced it exactly — 15 keystrokes yielded `"A"` with `document.activeElement` = `DIV`. Restoring it gave the full string with `activeElement` = `INPUT`. Identical input code in both builds.

**Fix** is in `Sheet`, not at the call sites: `onClose` moved to a ref (assigned in an effect — React 19's `react-hooks/refs` rule correctly rejects writing refs during render) and the effect now depends only on `[open]`. Fixing it at the call sites with `useCallback` would have left the trap armed for the next person who writes a `<Sheet>` with an inline handler, which is the natural way to write one.

**Why Phase 1 review missed it:** the kitchen-sink sheet's `Field` was *uncontrolled*, so typing into it never re-rendered the parent and never exercised the broken path. It is now controlled, which is the honest representation of how reps use it. Phase 1's stated purpose is that the kitchen sink renders every component in every state — a text field bound to parent state inside a Sheet is a state it was missing.

**Verified** against the production build with Playwright in both directions, plus Escape-to-close still working through the ref indirection.

### Deferred by Dean, deliberately

S2 rate limiting is still inert — the Upstash env vars are not set on Vercel. Dean's call: ~20 early adopters will not break it, and getting the tool in front of reps matters more right now. **This is a knowing deferral, not an oversight.** It is two environment variables away from armed, the code and its 8 tests are already in place, and the app degrades safe rather than open (S1 validation and S5 audit still run on every write). Revisit before the rep count grows or the URL circulates beyond people Dean knows.

---

## 2026-07-24 — Post-break system audit + the work it turned up — ✅ verified

Dean returned from a break and asked for a medium, non-adversarial audit: current state vs the plan, where git stands, tests and lints green. Audited `c1b5357` from a fresh GitHub clone. Full report delivered separately; this entry records what the audit **found** and what was **done about it**.

### Baseline: healthy

Gate green from a clean clone, exactly as CI runs it: typecheck ✓ · lint ✓ · db:migrate ✓ · 37/37 tests ✓ · `next build` ✓. `schema.ts` matches the committed migrations (`drizzle-kit generate`: nothing to migrate). No secrets or real store data anywhere in history (S8 holds). `main` clean at `5343be1` and had NOT absorbed the migration commits — the earlier "empty `main..HEAD`" scare was a false alarm.

`format:check` fails on 89 files, but it fails on `main` too (88) and is not part of CI. Pre-existing Prettier drift, not a regression. Deliberately **not** fixed here: an 89-file reformat during an open migration PR buries the real diff. Do it as a standalone commit after the merge.

### Finding 1 — nine Next.js advisories (fixed)

`next@16.2.10` carried nine published advisories, 4 high, all range `>=16.0.0 <16.2.11`. The 2026-07-14 audit had recorded two moderates; this changed because time passed.

Four never applied here — no `middleware.ts` (S4 puts authorization in the data layer, which is exactly why), no custom server, no rewrites, no `next/image`. Three did, and the one weighted heaviest is **cache confusion of response bodies**, in an app whose entire free-tier budget rests on cached responses (§3).

Went to **16.3.0**, not the minimum 16.2.11: still non-major, and it additionally clears the transitive `postcss` (4 advisories including sourceMappingURL path traversal) and `sharp`/libvips highs that 16.2.x carries. `npm audit fix` cleared the last `nanoid` high. **4 high + 5 moderate → 0 high, 5 moderate.** The remainder is the esbuild dev-server chain via `drizzle-kit`; npm's fix is a *major* downgrade to drizzle-kit 0.18.1, which is worse than the problem — left alone knowingly.

Also took Dependabot's minor/patch group (react 19.2.8, better-auth 1.6.27, resend 6.19.0, @playwright/test 1.62.1) so its open PR rebases to near-empty. Did **not** take `@opennextjs/cloudflare` 1.20.2 from it — that package no longer exists here. Re-pinned the framework quartet exactly after `npm install` rewrote them to caret ranges.

### Finding 2 — S10 was being violated in production code (fixed)

**Better Auth writes the client IP into `session.ip_address` by default.** It had been doing so since Phase 2. Plan S10 and §1 #6 say "No raw IPs stored, anywhere, ever" and call it a *grep-able invariant* — but nothing was grepping, so it went unnoticed for ten days.

Fixed with `advanced.ipAddress.disableIpTracking: true`, verified against the installed package rather than memory: `@better-auth/core/dist/utils/ip.mjs:202` short-circuits `getIp()` to null, and `internal-adapter.mjs:191` then writes `""`. No address reaches Postgres. The column is kept rather than dropped — removing it means a migration plus a hand-modeled divergence from the schema Better Auth expects, for no additional privacy, since it is already always empty.

**Knowingly not fixed:** `session.user_agent` is still recorded. Not in S10's enumeration (IPs, emails outside `users`, names, locations), covers ~5 authenticated CMS users rather than ~1,000 anonymous reps, and suppressing it means fighting the library. Recorded here so the next session decides deliberately rather than discovering it.

Added `tests/s10-invariants.test.ts` — 5 tests, no DB, no network — to make "grep-able invariant" literal: the config flag is present; IP headers are read in exactly one module; in all three write handlers `ip` appears exactly twice in code (declaration + limiter key) so it cannot leak into a log, response body, audit row or DB write; our tables declare no ip column; `audit.ts` never touches an address. **Confirmed the guards fail when a violation is injected**, not merely that they pass today. Tests 37 → 42.

### Finding 3 — plan Appendix A had drifted (fixed)

Out of sync with `src/db/schema.ts` since 2026-07-14, in two places: `sections.key` (plan still showed the `sectionKey` pgEnum; code has text + a CHECK, per §1 #15f) and `users`/`user_brands` (plan still hand-wrote them; Phase 2 moved them to `auth-schema.ts`). Both are correct decisions that never made it back into the plan.

`schema.ts` declares itself the source of truth for that appendix and says the two "must never drift." Appendix A is now a byte-identical copy with a preamble saying which file wins. No code change.

### Phase 1 unblock

Rendered `/kitchen-sink` (light + dark) and the survey keypad at 402px phone width against the real production build, and sent the images to Dean. Phase 1 has been stalled on his design feedback since 2026-07-14, and the design system propagates into every screen built after it — this removes "I'd have to run it locally" as a reason to keep deferring.

### Still blocked on Dean (cannot be done from a sandbox)

Open the PR (CI has never run on this branch; `main`'s protection needs that `checks` status) · Vercel + Upstash setup — **until `UPSTASH_REDIS_REST_URL`/`_TOKEN` exist, S2 is inert and the loginless write endpoints have no abuse damper** · confirm Neon is migrated + seeded · verify the remote cache works cross-device on a preview · fast-forward `develop` to `main` · Phase 1 design feedback.

---

## 2026-07-24 — Node 22 → 24, and the toolchain footguns that cost Dean an hour — ✅ verified

**Node 24 everywhere.** `.nvmrc`, `.node-version`, CI's `setup-node`, and a new `engines.node: "24.x"` in `package.json`. Reasons, verified against the Node release schedule and Vercel's docs on 2026-07-24: **Node 22 entered maintenance LTS on 2025-10-21** (EOL 2027-04-30) while **24 has been Active LTS since 2025-10-28** (maintenance 2026-10-20, EOL 2028-04-30), and **Vercel's default for new projects is already 24.x** (22.x and 20.x also available). Dean's other ~20 projects are on 24, so pinning this one to 22 was friction with no upside.

`engines.node` overrides the Vercel project setting, so the version is declared in the repo rather than in a dashboard nobody remembers to check. Verified green on Node 24.18.0 in the sandbox from a clean clone: typecheck ✓ · lint ✓ · 37/37 tests ✓ · `next build` ✓.

**Answering the question directly, since it comes up:** `.nvmrc` was *already* the per-repo mechanism — `nvm use` in this directory switches that shell only and never touches the global default. The pin was moved to 24 because 24 is the better pin, not because per-repo pinning didn't work.

**Two footguns documented in SETUP.md, both of which actually bit.**

1. **`SETUP.md` gave Linux-only Postgres instructions.** On macOS, Homebrew's Postgres creates a superuser named after your macOS account, not `postgres` — but `tests/db-test-client.ts` defaults to connecting as `postgres` (matching CI's container). Result: `role "postgres" does not exist`, SQLSTATE 28000, all three DB-backed suites red while the rate-limiter suite passes. Now has both macOS and Linux setup blocks, plus the symptom spelled out so the next person recognises it.
2. **npm only.** Running `pnpm install`/`pnpm dev` in this repo moves every npm-installed package into `node_modules/.ignored`; interrupt it and `tsc`, `vitest` and `next` all become "command not found". Worse, a pnpm tree is not what CI (`npm ci`) or Vercel build, so anything verified under it proves nothing. Recovery is `rm -rf node_modules pnpm-lock.yaml && npm ci`. Called out in SETUP.md prerequisites and in plan §2's tooling row.

Deliberately did NOT add a `packageManager` field to pin npm via corepack: Node 24 bundles npm 11, and pinning an exact npm version there would force a downgrade and drag corepack into the build. The lockfile plus the documented rule is enough.

---

## 2026-07-24 — Migrated off Cloudflare to Vercel-native (plan §1 #17) — 🚧 built + verified in sandbox, needs Dean's Vercel/Upstash setup

**Why:** every hard production bug this project hit was Cloudflare-adapter-specific (both 2026-07-14 incidents below). Dean owns Vercel Pro and works in it daily. On Vercel, PPR / `use cache` / `revalidateTag` / ISR are first-party, so neither incident can recur, and the entire OpenNext caching stack is **deleted, not reconfigured**. Full decision record: plan §1 amendment #17, which supersedes #1, #9 and #16 and rewrote Appendix D.

### Two corrections to the migration handoff doc, found before writing any code

1. **PR #13 was already merged.** `main` is at `5343be1 Merge pull request #13 from dwaynedraper/develop`; `develop` was 2 commits *behind* `main`, not ahead. The handoff's "close PR #13 without merging" was stale. This branch is cut from `main`.
2. **"Caching should mostly just work" was wrong, and it was the load-bearing item.** Verified against the installed Next 16.2.10 docs (`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`, `use-cache-remote.md`) and Vercel's runtime-cache docs: plain **`use cache` is a per-instance in-memory LRU**. On Cloudflare that was invisible because the OpenNext `kvIncrementalCache` override made the default handler durable (KV). On Vercel there is no such override, so `reads.ts` as written would have broken plan §3 in two ways at once — every cold function instance becomes a real Neon query (§8's egress limit **suspends the database** when exceeded), and `revalidateTag` would bust only the instance that handled the write, so a flag saved on one rep's phone would not appear on another's. Fixed by moving both reads to **`'use cache: remote'`**, which uses Vercel's Runtime Cache: shared across instances, honours `cacheTag`/`revalidateTag`. This is a *silent* failure mode — the app looks perfect while the bill climbs — so it is called out in AGENTS.md, the primer, SETUP.md and Appendix D.

### What changed

**Deleted:** `open-next.config.ts`, `wrangler.jsonc`, the four `cf:*` npm scripts, `@opennextjs/cloudflare` + `wrangler` devDependencies, the `initOpenNextCloudflareForDev()` hook in `next.config.ts`, and the Cloudflare `.gitignore` entries. Zero Cloudflare packages remain in `node_modules`.

**S2 rate limiting → Upstash Redis** (Dean's call from three costed options). `src/lib/rate-limit.ts` rewritten on `@upstash/ratelimit` + `@upstash/redis`. Fixed window (2–3 Redis commands per check, vs 4–5 sliding) + `ephemeralCache` (already-blocked keys cost **zero** commands) + `analytics: false`. Free tier is 256 MB / 500K commands per month with **no card**, which preserves §1 #16's zero-card promise for self-deployers; at ~5 commands per write that's ~100k writes/month inside free. Same "degrade safe, not open" posture: unconfigured or unreachable ⇒ the write proceeds under S1 + S5.

Why the alternatives lost: Vercel's WAF rate limiting is a *priced* feature on Pro, and its documented Pro counting keys are IP and JA4 only — it cannot key on `device_hash` — and self-hosters of this public repo could not use it at all.

**Side effect worth knowing: the per-endpoint limits in plan §5 are now real for the first time.** On Cloudflare all three write endpoints called the single `RL_CONDITIONS` binding, whose limit lived in `wrangler.jsonc` at 60/60s, so the 30 / 20 / 10 values in the handlers were never applied in production. `tests/rate-limit.test.ts` now guards this.

**`clientIp()` extracted** from three duplicate copies into `src/lib/client-ip.ts`, reading `x-real-ip` / `x-forwarded-for` (was `cf-connecting-ip`). One place to audit for S10; its return value must never reach anything but `rateLimit()`.

**`vercel.json`** pins functions to `iad1` — Vercel's Runtime Cache is regional, and Neon is `us-east-1` (§1 #13).

**CSP** dropped the `static.cloudflareinsights.com` / `cloudflareinsights.com` hosts; no analytics beacon is wired in today.

**Docs:** plan §1 #17 added (#1/#9/#16 struck through as superseded, #6/#13 amended), §2 stack table, §7 S2, §8 budget table rebased onto Vercel/Upstash pricing, §9 phases, §11 setup checklist, and Appendix D fully rewritten. AGENTS.md, primer, README, SETUP.md, `.env.example` updated.

**Tests: 29 → 37.** New `tests/rate-limit.test.ts` (8 tests, Upstash stubbed, no network): the limit trips; device and ip are independent buckets; all five distinct §5 `(limit, window)` pairs reach the limiter; limiters are reused not rebuilt; unconfigured degrades safe; unreachable degrades safe; keys stay under the `rounds:rl` prefix. This satisfies plan §9 Phase 3's "rate limit demonstrably trips (integration test with the binding stubbed)" — which the Cloudflare implementation never actually had.

**Verified in sandbox** (Node 22, fresh `npm ci`, local Postgres 16): typecheck ✓ · lint ✓ · 37/37 tests ✓ · `next build` ✓, with zero Cloudflare dependencies.

### ⚠️ Dean's handoff — in order

1. Apply the bundle to `~/projects/rounds`, review, push the branch, open a PR into `main`.
2. **Upstash:** create a free Redis database in `us-east-1`. No card. Copy `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. (The Vercel Marketplace integration sets both automatically if you prefer.)
3. **Vercel:** import the repo. Set env vars for Production **and** Preview: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, and the two Upstash vars. Confirm the function region is `iad1`.
4. Ship a preview and walk the survey on your phone against Neon: enter a store → tables → side → flag a camera.
5. **Verify the cache actually works cross-device** — this is the whole point of correction #2. Flag a camera on your phone, then load the same store on a second device (or a private window) and confirm the flag appears. Then check Vercel → Observability → **Runtime Cache** for a non-trivial hit rate. A hit rate near zero means reads are still going to Neon.
6. Disconnect Cloudflare Workers Builds from the repo so it stops building. The `rounds` Worker, the `rounds-inc-cache` KV namespace and the `rounds-tags` D1 database are now orphaned and can be deleted whenever.

### Open decision, deliberately NOT in this change set

The survey's client-fetch layer (`src/lib/client-data.ts`, `StoreShell`, `useSurveySegments`) exists only to dodge the Cloudflare PPR bug. That bug is gone. Reverting the survey pages to normal server components that read Next `params` and call the reads directly would be cleaner, better for SSR, and would put the pages back on Vercel's ISR/CDN layer — which would cut function invocations on top of the Neon savings. It works correctly as-is on Vercel, so this is an improvement, not a fix. Flagged in a comment at the top of `client-data.ts`. Dean's call, separate branch.

### Also worth knowing (not blocking)

Vercel Web Analytics on Pro includes **zero** events and bills $0.03/1K — roughly $3–4/month at expected volume. The migration handoff called it "included in Pro"; it isn't. Budgeted in §8. It's a Phase 5 item either way.

---

## 2026-07-14 — Live incident #2: Worker deadlock (error 1101) on shell revalidation — ✅ fixed (caching stack, KV backend)

**Symptom (Dean, live):** after the stream-corruption fix deployed, the survey pages threw **error 1101 "Worker threw exception"** intermittently. Cloudflare logs: `waitUntil() tasks did not complete within the allowed time` (warn) → `The Workers runtime canceled this request because it detected that your Worker's code had hung and would never generate a response` (error).

**Root cause:** the app deployed with the Phase 0–3 **minimal** OpenNext config (no caching stack). The static survey shells carry a 5-minute stale-time; when one expires, Next schedules a background ISR revalidation via `waitUntil`. With no revalidation **queue** binding, that task hangs forever → runtime kills the request. NOT the earlier stream bug — a separate, deeper problem the minimal config was always going to hit once shells started expiring under real traffic. (My earlier WORKLOG note calling the caching stack "optional / can wait until traffic grows" was **wrong** — it's load-bearing for correctness, not efficiency. Owning that.)

**Fix:** enabled the OpenNext caching stack (plan Appendix D), with one deliberate change from the locked plan — **KV instead of R2** for the incremental cache (plan §1 #16): R2 needs a card on file even free, which breaks "free to host"; KV is card-free on the Workers Free plan and the queue (the actual fix) is backend-agnostic. Final stack: `kvIncrementalCache` + `d1NextTagCache` + `doQueue` in `open-next.config.ts`; `kv_namespaces` + `d1_databases` + `durable_objects` + `WORKER_SELF_REFERENCE` service + DO `migrations` in `wrangler.jsonc`. `cf:deploy`/`cf:preview` npm scripts switched from bare `wrangler` to `opennextjs-cloudflare deploy`/`preview` so `populate-cache` runs (creates the D1 `revalidations` table + seeds the cache).

**Verified in-sandbox (local Workers runtime, real build):** primed all 3 survey routes → waited out the full 300s stale window → 9 post-stale requests served in ~10–15 ms with **zero** `did-not-complete`/hang signatures and active queue+cache log activity. Ran this twice — once on R2, once on the final KV config — both clean. typecheck ✓, 29 tests ✓, next build ✓, opennext build ✓, eslint(src) ✓. (`npm run lint` bare-invocation V8-aborts in the degraded container after many builds; eslint on `src/` is clean — env quirk, not a code issue.)

### ⚠️ Dean's handoff — provision two card-free resources, then deploy
1. Apply the bundle, merge to develop. **Do not push yet** — wrangler.jsonc has `REPLACE_WITH_*` id placeholders; pushing first would fail the auto-deploy.
2. Create the two resources (Workers Free plan, no payment method):
   - `npx wrangler kv namespace create rounds-inc-cache` → copy the `id`
   - `npx wrangler d1 create rounds-tags` → copy the `database_id`
3. Paste both ids into `wrangler.jsonc` (`NEXT_INC_CACHE_KV.id` and `NEXT_TAG_CACHE_D1.database_id`). These are NOT secrets — they're fine in the public repo.
4. Commit + push. Workers Builds must deploy via `opennextjs-cloudflare deploy` (already wired in `cf:deploy`); confirm the Workers Builds deploy command is `npm run cf:deploy` (or `npx opennextjs-cloudflare deploy`), NOT `wrangler deploy` — a bare wrangler deploy skips populate-cache and starts the stack cold.
5. After deploy: load `/store/0001`, wait 6 minutes, reload — must stay fast (no 1101). That's the exact failure this fixes.

Residual: the CMS still server-streams (auth-gated, 5 users) — same stream-corruption *and* hang classes could theoretically touch it; low priority, same fixes apply. Upstream: consider filing the PPR interleaving bug at opennextjs-cloudflare.

---

## 2026-07-14 — Live incident: PPR resume-stream corruption on Workers — ✅ fixed (survey moved to client-fetch)

**Symptom (Dean, live):** raw React flight payload rendered as visible garbled text over the survey pages. **Diagnosis (verified in Dean's Chrome + curl):** the deployed HTML is malformed — the `@opennextjs/cloudflare` adapter (1.20.1, latest; PPR is on its supported list, so this is an adapter bug) interleaves a chunk into the middle of an inline flight `<script>` during the PPR two-phase (shell + resume) response on dynamic-param routes. Script never terminates → browser SyntaxError → "Connection closed" → payload tail parses as body text. Deterministic; triggered by the realignment's larger streamed payload (old deploy's fit one chunk).

**Dead ends proven:** `use cache` on the page (and page+layout) does NOT remove the postponed segment for param routes — params are request data, so the resume stream remains (verified with a throwaway route on `next start`). No per-route PPR opt-out exists under cacheComponents (`experimental_ppr` removed; `force-dynamic` a no-op).

**Fix (architecture, aligned with plan §5/§6):** the survey is now delivered ONLY over proven-good paths — static HTML + single-phase JSON:
- New `GET /api/catalog` (+ `connection()` so the build doesn't prerender it against a placeholder DB) and `GET /api/stores/[number]/state` — thin wrappers over the same tagged `use cache` reads; Neon budget (§3) unchanged.
- Survey pages are static client shells: `src/lib/client-data.ts` (`useStoreData` — catalog memo + per-store state fetch; `useSurveySegments` — URL read via `useSyncExternalStore` at mount, deliberately NOT Next `params`, which would re-open the resume stream), `StoreShell` (shared loading/missing/error states, `CreateStore` retry wiring), pages rebuilt on top. `buildReport` moved to `view.ts` (pure). `unstable_cacheTag` → stable `cacheTag`.
- Verified: all three survey routes serve complete static HTML with ZERO postponed segments/headers; hydration proven in Playwright (shell → fetch → rendered state, no JS errors); typecheck/lint/29 tests/next build/opennext build green.

**Known residual risk:** the CMS (admin) pages still server-stream (auth-gated, small payloads, 5 users) — same adapter bug could theoretically bite there; if it does, same fix applies. Consider filing the interleaving bug upstream at opennextjs-cloudflare with the byte-level evidence in this entry's session.

---

## 2026-07-14 — Survey realignment (plan §1 #15) — 🚧 built + verified in sandbox, needs Dean's migrate + seed

**What changed and why:** Dean's floor photos showed the built survey didn't match the physical tables. Realigned (v3 mockup approved by Dean): the floor plan is a FIXED constant — Canon · Nikon · Sony, two looks — and only camera assignments vary per store. Stores auto-create on entry. Reps build their store's layout from the admin-owned master list. Full decision record: plan §1 amendment #15.

Built:
- `src/lib/floor.ts` — the fixed geometry constant (oak: 2 walls × 2 sections × 5-cap; Sony: end(4) + 2 walls × 2 sections × 5-cap). Seeded 1:1 by the rewritten idempotent `scripts/seed.ts` (driver-aware: node-postgres for localhost so it's verifiable in CI/sandbox, neon-http otherwise). Flags now exactly: alarm / no-power / broken / missing.
- Migration `0002` — `sections.key` enum→text (`left-1`…), wipes the old fictional demo planogram data so it applies cleanly on Neon (stores + users kept).
- `POST /api/stores` (enter → auto-create, create-once, audited) and `POST /api/layout` (contract B3; master-list-constrained — products must exist AND be active; upserts `store_positions`, which is now the per-store layout, not just overrides). Both S1/S2/S5/S10-armored like `/api/conditions`, which is UNCHANGED (conditions still key store+position, so LWW/audit/tests all carried over).
- Survey UI rebuilt: `/` keypad entry (no OS keyboard) → `/store/[n]` overview (3 slabs, flags visible) → `/store/[n]/[brand]` single table w/ tappable sides → `/store/[n]/[brand]/[side]` side view — Dean's v1 format (columns of camera name + 4 flag buttons + inline note) with the Record ⇄ Edit-layout toggle (edit = amber header + master-list picker sheet). `TableSlab` is the config→grid renderer from the approved mockup; slab demos added to `/kitchen-sink`. Old `TablePlan`/`SurveyClient` deleted.
- Tests: +6 (`tests/layout.test.ts`) — ensureStore create/no-op+audit, layout assign/upsert/clear, unknown store/position/product, INACTIVE product rejected, last-in-request wins. 29/29 green.

Verified in sandbox: typecheck / lint / 29 tests / `next build` / `opennextjs-cloudflare build` (zero env vars) / seed run twice against local Postgres (64 positions: 20+20+24, idempotent) / Playwright screenshots of the slab renderer + keypad match the approved v3 mockup.

### ⚠️ Dean's handoff — in order
1. Apply the bundle, push.
2. `npm run db:migrate` (applies `0002` — **wipes old demo planogram/conditions on Neon**, keeps stores + your admin user).
3. `npm run db:seed` (now safe AND required — re-runnable; seeds the fixed floor, 4 flags, starter master list of ~35 real camera names w/ placeholder SKUs).
4. Walk a store on your phone: enter a number → tables → side → flag something → edit layout → assign cameras from the master list.

Known follow-ups: admin planogram editor still edits the global defaults (works, but its labels predate the realignment); `docs/ROUNDS-PRIMER.md` not yet updated for #15; Phase 4 (rounds) untouched by design — round submission still references positions, unaffected.

---

## 2026-07-14 — Phases 2 (CMS) & 3 (survey) — 🚧 built + verified in sandbox, awaiting Dean's infra steps

**Status: both phases built, everything that can be verified in the sandbox is green** (typecheck / lint / 22 tests / next build / opennext build). The full app can't RUN in the sandbox (the `neon-http` driver is Neon-only), so the risky logic was verified directly against local Postgres instead: the Better Auth schema + S3 allowlist (Phase 2) and the condition write path — S1 existence checks, S6 last-write-wins, S5 audit (Phase 3, 4 dedicated tests). End-to-end flows (login email, live survey) are verified by Dean after the infra steps below.

**Phase 2 (CMS)** — Better Auth magic-link (hand-modeled schema, `disableSignUp` = S3 allowlist, verified); role + brand scope (S4) enforced inside every mutation; Products CRUD + bulk paste import; Stores & Flags admin (admin-only); Planogram editor (assign product / planned-empty per position); Audit log viewer; admin shell + login. Migration `0001` replaces the old `users` table with the auth tables.

**Phase 3 (survey)** — `/` store-entry landing (replaced the scaffold) → `/store/[number]` survey. `getCatalog`/`getStoreState` are `use cache` + tagged (plan §3). `POST /api/conditions` with S1 (Zod + 32KB cap + DB-truth checks), S2 (rate-limit binding + in-memory fallback, no IP stored), S5 (audit), S6 (LWW → 409). Device hash in localStorage (Phase-5 moves to IndexedDB). Copy-report output.

### ⚠️ Dean's handoff checklist — do these in order to run Phases 2 & 3 live

1. **Sync + push** the new commits (bundle) — same routine as before, then `git push`.
2. **Migrate Neon:** `npm install && npm run db:migrate` (applies `0001` — creates the auth tables, drops the empty `users` table). Then **`npm run db:admin`** to add yourself as admin (defaults to `dean@sharpsightedstudio.com`; override with `ADMIN_EMAIL=...`). Do NOT re-run `db:seed` — it would collide with the existing Phase-0 seed data.
3. **Resend:** create an API key (sending-access only). You'll set it as a Worker secret next.
4. **Worker secrets** (Cloudflare dashboard → the `rounds` Worker → Settings → Variables, or `wrangler secret put`): `DATABASE_URL` (the Neon us-east-1 string), `BETTER_AUTH_SECRET` (generate: `openssl rand -base64 32`), `BETTER_AUTH_URL` (`https://rounds.dean-221.workers.dev`), `RESEND_API_KEY`, `AUTH_EMAIL_FROM`. Push → auto-deploy → the CMS login + survey go live.
5. **(For the free-tier caching benefit — can wait until traffic grows):** provision R2 bucket `rounds-cache`, D1 db `rounds-tags`, and switch `open-next.config.ts` + `wrangler.jsonc` to the full caching stack (both have the exact config commented, plan Appendix D). Until then the survey works but caches per-instance instead of persistently. The rate-limit binding (S2) is already active in wrangler (no resource needed).

### Next after infra: Phase 4 (round snapshots) + Phase 5 (offline queue). Design feedback on Phase 1 still applies and propagates through the shared components.

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
