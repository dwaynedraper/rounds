# Rounds — Implementation Plan (v2 · LOCKED)

Vendor table survey for Best Buy camera departments. Sony / Canon / Nikon.
Open-source, free to host, built for ~1,000 loginless users.

**Status: every architectural decision in this document is LOCKED.** It was reviewed and finalized on 2026-07-13. The implementing agent must not relitigate locked decisions. If a locked decision turns out to be impossible (an API no longer exists, a free tier changed), stop, explain the conflict, and present Dean with concrete options — do not silently substitute.

The only open items are **content**, not architecture: real planogram data, real table dimensions (see §12).

Companion document: `ROUNDS-PRIMER.md` — the context brief for the implementing agent. Both files get copied into the new repo's `docs/` in Phase 0.

---

## 1 · What changed from plan v1, and why

| # | Change | Why |
|---|---|---|
| 1 | **Hosting locked: Cloudflare Workers via OpenNext** (was an open question) | Free tier explicitly permits commercial use; 100k requests/day ≈ 30× expected traffic; rate limiting, Turnstile, and cookieless analytics are all built in and free. OpenNext fully supports Next.js 16 (verified 2026-07). |
| 2 | **Abuse controls moved from Phase 5 → Phase 3** | The loginless write endpoints must never exist un-protected, even for a week. Protection ships in the same commit as the endpoint. |
| 3 | **Magic-link allowlist enforced explicitly** | Auth libraries commonly sign in *any* address by default unless self-registration is explicitly disabled. Auth (§14 below) uses Better Auth's `disableSignUp: true`, so "only ~5 people log in" is enforced by the library, not a hand-rolled callback someone could forget. |
| 4 | **Roles enforced in the data layer, not just middleware** | CVE-2025-29927 (Next.js middleware bypass) is the precedent. Middleware is convenience; server actions re-check role + brand scope before every mutation. |
| 5 | **`round_items.product` jsonb replaced by a content-hashed `product_snapshots` table** | The inline blob would have cost ~800 MB/yr — Neon free is 0.5 GB *total* and fails writes when exceeded. Deduped snapshots keep the identical immutability guarantee at ~5× less storage. |
| 6 | **No raw IPs stored, anywhere, ever** | IP addresses are personal data; the plan promises "no personal data." Rate-limit counters are ephemeral (10–60 s windows in the Workers rate-limit binding); audit rows record `device_hash` only. |
| 7 | **Idempotency keys + last-write-wins rules specified** | The offline write queue retries; without a `client_key` unique constraint, a flaky-Wi-Fi retry creates duplicate rounds, and a stale queued write clobbers newer data. |
| 8 | **Everything reads from cache; the DB is touched only by writes** | Tag-based caching (`catalog`, `store:<n>`, `rounds:<n>`) keeps Neon comfortably inside all three free limits (storage, 100 CU-hours/mo compute, 5 GB/mo egress — exceeding egress *suspends the database until next month*). |
| 9 | **Vercel Analytics → Cloudflare Web Analytics** | Vercel Analytics only works on Vercel hosting. CF Web Analytics is free and cookieless, preserving the no-cookies promise. |
| 10 | **Sessions: JWT strategy** | 5 CMS users; a session-table lookup per request buys nothing. |
| 11 | **Name locked: "Rounds". License: MIT. Repo: `~/projects/rounds`, public from commit one.** | Placeholder-itis is a tax. The name is good. Dean's call (2026-07 override of the original "private until Phase 6" default): source visibility isn't the risk — a live unprotected write endpoint is, and S1/S2/S5–S7 ship in the same commits as the endpoints (Phase 3), so there's no window where a deployed, discoverable endpoint is both public and unarmored. S8/S10 (no real data, no secrets, ever) apply unconditionally regardless of visibility, so going public early costs nothing. |
| 12 | **Rounds freeze the note too** | A round is "what you found on a date" — the note is part of what you found. |
| 13 | **Region: `us-east-1` everywhere it's configurable (Neon, D1, DO location hints).** | Dean's call (2026-07 override of the original `us-east-2` default): Resend and several other platforms in this stack only offer `us-east-1`, and colocating the DB with them removes a needless cross-region hop on every CMS email + admin write. Cloudflare Workers themselves still execute at whichever edge PoP is nearest each rep, unaffected by this. |
| 14 | **Auth library: Better Auth, not Auth.js v5** | Discovered mid-Phase-0 (2026-07-13): Auth.js v5 is still beta after 2+ years with no GA date, and the Auth.js project is now organizationally part of Better Auth, which is the maintainers' recommended path for new projects. Dean's call, presented as a real fork per the primer's "don't silently substitute" rule — see Appendix C for the full rationale and verified package details. |
| 15 | **Survey realignment (2026-07-14, Dean's floor photos + v3 mockup approved).** (a) The floor plan is a **fixed constant**: three tables in fixed order Canon · Nikon · Sony, two looks (oak islands for Canon/Nikon: 2 walls × 2 sections; grey-marble Sony: end + 2 walls × 2 sections). Geometry lives in code (`src/lib/floor.ts`) and its DB rows are seeded identically for every deployment; only **camera assignments** vary per store. (b) **Stores auto-create on entry** — no admin gatekeeping (`POST /api/stores`, rate-limited, audited). (c) **Reps build their store's layout** by assigning master-list products to fixed slots (`POST /api/layout`, master-list-constrained upserts into `store_positions` — hereby promoted from "overrides" to "the store's layout"; `positions.product_id` remains as an optional global default). (d) Slot grids: 4 slots per section default; a 5th camera spreads the grid to 5; empty slots keep their spacing. (e) Survey UI is spatial: overview drawn as square textured slabs with rotated top-down camera SVGs → single table with tappable sides → side view in Dean's v1 format (positions left→right *viewed from the end cap*; camera name + Alarm / No Power / Broken / Missing + inline note) with a **Record ⇄ Edit-layout toggle**. (f) Flag vocabulary seeds as exactly those four. No per-camera brand labels; no accessory/stock tracking (Best Buy Power BI owns that). `sections.key` widens from enum to text (`left-1`, `right-2`, `end-1`, …). | The generic list-style survey deviated from the physical floor. Screens must mirror the tables reps stand at; stores must not need an admin to exist; layouts differ per store, so reps own them. |

Unchanged and reaffirmed: the four-concept data model (catalog / planogram / condition / round), overrides-not-copies store layouts (now doing double duty as the per-store layout, §1 #15), stable `position_id` keying, CMS before survey, Drizzle + Neon HTTP driver, Zod everywhere, IndexedDB write queue, hand-rolled SVG sprite, no AI, no personal data, no cookies.

---

## 2 · The stack (all locked)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16**, App Router, TS `strict` | ⚠️ Next 16 post-dates most training data. Read `node_modules/next/dist/docs/` before writing framework code. |
| Hosting | **Cloudflare Workers** via `@opennextjs/cloudflare` | Node runtime (not edge). Deploy via Cloudflare Workers Builds (free git-integrated CI/CD). |
| DB | **Postgres on Neon**, free plan, region `aws-us-east-1` | Access via `@neondatabase/serverless` HTTP driver — no pool exhaustion under serverless. |
| ORM | **Drizzle** (`drizzle-orm/neon-http`) | Schema in Appendix A. Never interpolate user input into `sql.raw`. |
| Auth (CMS only) | **Better Auth** (§1 item 14), Resend magic link via `sendMagicLink`, `disableSignUp: true` allowlist | Appendix C. Survey is loginless. |
| Styling | **Tailwind v4 `@theme`** | One token file. No SCSS in v2 — v1's three-palette drift came from mixing systems. |
| Validation | **Zod 4** | Shared contracts in Appendix B; server always re-validates. |
| Local cache/queue | **IndexedDB** via `idb-keyval` | Spec in §6 + Appendix E. |
| Caching | Next tag-based data cache on OpenNext (R2 incremental cache + D1 tag cache + DO revalidation queue) | Spec in §5, config in Appendix D. All bindings have free tiers (verified 2026-07). |
| Rate limiting | Workers rate-limit binding + in-app checks | Spec in §7. |
| Analytics | **Cloudflare Web Analytics** | Free, cookieless. |
| Email | **Resend** free tier (100/day) | Magic links only; ~10/week actual. |
| Tests | **Vitest** (logic) + **Playwright** (2 public E2E flows) | §10. |
| Icons | Hand-rolled SVG sprite | No icon library. |
| Tooling | npm · Node 22 LTS+ · ESLint + Prettier · GitHub Actions (checks) | Boring on purpose. |

---

## 3 · Architecture: reads never touch the database

The single most important architectural rule in this app:

```
                 ┌────────────────────────────────────────────┐
   READS         │  Cloudflare CDN / Next data cache (tagged) │   ~all traffic
   ──────────►   │  tags: catalog · store:<n> · rounds:<n>    │   0 DB queries
                 └────────────────────────────────────────────┘
                        ▲ revalidateTag(...) busts exactly one tag
                        │
                 ┌──────┴─────────────────────────────────────┐
   WRITES        │  POST /api/conditions · POST /api/rounds   │   the ONLY
   ──────────►   │  CMS server actions                        │   DB traffic
                 └──────────────────┬─────────────────────────┘
                                    ▼
                          Neon Postgres (asleep between writes)
```

Why this is load-bearing and not just an optimization — Neon's free plan (verified 2026-07):

- **0.5 GB storage** — writes *fail* when exceeded (no data loss, but the app stops accepting rounds).
- **100 CU-hours/month** — at the 0.25 CU minimum that's ≈ 400 awake-hours. Reps across four US time zones would keep an uncached DB awake ~400+ h/month: right at the line. Writes-only traffic keeps it far under.
- **5 GB/month egress** — exceeding it **suspends compute until the next billing month**. That failure mode would take the whole app down for weeks.
- **Mandatory scale-to-zero after 5 min idle** — the first query after sleep pays a cold start. Users never feel it because reads come from cache and writes go through the client queue.

### Cache tags (the complete list)

| Tag | Covers | Revalidated by |
|---|---|---|
| `catalog` | brands, products, fixtures, sections, positions, flags — global, store-independent | Every CMS mutation touching those tables |
| `store:<number>` | that store's overrides + living conditions | `POST /api/conditions` (that store) · CMS store-override edits · admin revert |
| `rounds:<number>` | that store's round history | `POST /api/rounds` (that store) |

Rules: every data-access function is cached under exactly one tag. Every mutation revalidates exactly the tags it dirtied. No time-based revalidation (`revalidate: N`) anywhere — on-demand tags only. There is no fourth tag; if new data appears, it joins an existing tag or gets a new named tag added to this table.

> Next 16's exact tagging API (`'use cache'` + `cacheTag()` / `unstable_cache`) must be confirmed against `node_modules/next/dist/docs/` at Phase 0 — the *architecture* is locked, the exact function names follow whatever Next 16 ships.

---

## 4 · Data model

Four concepts, deliberately kept apart:

```
CATALOG      what products exist          (the CMS)
PLANOGRAM    where they're supposed to go (master layout)
CONDITION    what's currently wrong       (living state)
ROUND        what you found on a date     (frozen snapshot)
```

Full Drizzle schema in **Appendix A**. Table summary:

```
brands             id, slug, name, accent, sort
products           id, brand_id, quick_name, long_name, model, sku(7-digit, CHECK),
                   kind, active, meta jsonb, timestamps
flags              key PK, label, sort, active          ← CMS-editable flag vocabulary
fixtures           id, slug, name, layout_kind(endcap|plain), surface(gray|wood)
fixture_brands     (fixture_id, brand_id) PK
sections           id, fixture_id, key(endcap|right|left|lens), label, sort
positions          id, section_id, idx, product_id NULL          ← NULL = planned-empty
stores             id, number CHAR-4 UNIQUE CHECK ^\d{4}$, nickname
store_positions    (store_id, position_id) PK, product_id NULL   ← per-store OVERRIDE only
conditions         id, store_id, position_id, flags text[], note,
                   captured_at, updated_at, shift, device_hash
                   UNIQUE (store_id, position_id)                 ← LIVING STATE
product_snapshots  id, product_id, content_hash UNIQUE, data jsonb, created_at
rounds             id, store_id, fixture_id, submitted_at, shift, device_hash,
                   client_key uuid UNIQUE                         ← idempotency
round_items        (round_id, position_id) PK, snapshot_id NULL, flags text[], note
users              id, email, role(admin|editor) — ours; Better Auth's own
                   user/session/account/verification tables are generated
                   separately in Phase 2 (see Appendix C)
user_brands        (user_id, brand_id) PK                         ← editors are brand-scoped
audit_log          id, actor, entity, entity_id, action, before, after, at
```

### The five non-obvious calls

**1. Snapshots freeze a copy — via a deduped snapshot table, not an inline blob.**
History must never rewrite itself: rename "A7 V" next year and last March's round still says what it said in March. But storing the frozen jsonb inline in every `round_items` row costs ~800 MB/yr against a 0.5 GB budget. Instead: on round submit, compute a SHA-256 over the canonical frozen payload (`quick_name, long_name, model, sku, kind, brand_slug`), upsert into `product_snapshots` on `content_hash`, and reference `snapshot_id`. ~60 products that rarely change ⇒ a few hundred snapshot rows *ever*. Snapshot rows are immutable — never UPDATE one; a product edit simply produces a new hash on the next round.

**2. Store layouts are overrides, not copies.**
`store_positions` holds only differences from the master planogram. Adding a camera to the Sony planogram propagates to ~1,000 stores instantly, except where a store deliberately overrode that slot. A `store_positions` row with `product_id NULL` means "this store deliberately keeps this slot empty" — distinct from having no row (= follow the master).

**3. Conditions key off `position_id`, never an array index.**
The v1 bug: positional keying meant reordering silently re-attached a flag to the wrong camera. Stable IDs from row one. `UNIQUE (store_id, position_id)` enforces one living row per slot per store and doubles as the upsert target.

**4. Round submission is idempotent.**
The client generates a UUID `client_key` per submission attempt; the column is UNIQUE. A queue replay after a network timeout hits the constraint and returns the existing round — no duplicates, ever. On conflict the endpoint returns 200 with the original round id (idempotent success, not an error).

**5. Condition writes are last-write-wins with an explicit rule.**
Every write carries `captured_at` (client clock, when the human made the observation). The server rejects a write whose `captured_at` is ≤ the stored row's `captured_at` with **409 + the current row** in the body. The client treats 409 as success-with-refresh (server already knows something newer) and dequeues. Client-to-client clock skew is accepted: two reps editing the same slot in the same store within seconds of each other is rare, and the audit log preserves both observations.

---

## 5 · API surface (complete)

Public writes are **route handlers** (a background sync queue can't call server actions cleanly, and route handlers give explicit JSON contracts + per-route rate limiting). CMS mutations are **server actions** (origin-checked, authed, colocated).

| Endpoint | Method | Auth | Cache | Abuse controls |
|---|---|---|---|---|
| `/api/catalog` | GET | public | tag `catalog` | — |
| `/api/stores/[number]/state` | GET | public | tag `store:<n>` | — |
| `/api/stores/[number]/rounds` | GET | public | tag `rounds:<n>` | — |
| `/api/conditions` | POST | public | revalidates `store:<n>` | Zod contract B1 · rate limit 30/60s per device, 60/60s per IP · flags validated against `flags` table · store+position must exist · audited |
| `/api/stores` | POST | public | revalidates `store:<n>` on create | Zod (4-digit number + device hash) · rate limit 10/60s per device, 20/60s per IP · create-once (conflict = no-op) · audited |
| `/api/layout` | POST | public | revalidates `store:<n>` | Zod contract B3 (≤32 assignments) · rate limit 20/60s per device, 40/60s per IP · store+positions must exist, products must exist **and be active** (master-list constraint) · audited |
| `/api/rounds` | POST | public | revalidates `rounds:<n>` | Zod contract B2 · rate limit 6/60s per device, 12/60s per IP · `client_key` idempotency · audited |
| CMS server actions | — | session + role + brand scope re-checked **inside each action** | revalidate the tags they dirty | Zod on every input · audited |
| `/api/auth/*` | — | Better Auth handlers | — | `disableSignUp: true` allowlist |

GET payload shapes: `/api/catalog` returns the full catalog + planogram + flag vocabulary in one document (it's small — tens of KB). `/api/stores/[number]/state` returns overrides + all living conditions for the store in one document. **One fetch per screen, never one per section** — the Neon HTTP driver pays a full network round trip per query, so server-side each of these is a single joined query (`json_agg`), not N queries.

---

## 6 · Client: local-cache-first with a write queue

Full pseudocode in **Appendix E**. The contract:

- **Storage** (`idb-keyval`): `catalog` and `store:<n>` payload caches (with `fetchedAt`), `queue:v1` (FIFO array of ops), `device` (the device hash).
- **Device hash**: generated once per browser — 32 hex chars from `crypto.getRandomValues`. It is a *spoofable label* used for rate limiting, audit attribution, and dedup. It is never an identity and never grants authority. Not personal data: random, not derived from anything.
- **Render rule**: cached data renders immediately; a background revalidation follows when online. A rep in a dead zone sees yesterday's state instantly, never a spinner.
- **Queue op**: `{ opId: uuid, kind: 'condition' | 'round', payload, enqueuedAt, attempts }`. Enqueue applies the change optimistically to local state, then the flush loop runs: on app load, on the `online` event, and after every enqueue.
- **Flush semantics** (sequential, FIFO): `2xx` → dequeue. `409` (stale LWW) → dequeue, merge server's current row into local state. Other `4xx` (validation reject) → dequeue, surface a visible "1 change rejected" state — never retry a permanently-bad payload. `5xx`/network error → keep, retry with backoff `min(2^attempts, 300)` seconds. Nothing is ever silently dropped.
- **UI**: a persistent chip — "2 changes pending" / "1 change rejected". Pending is calm; rejected is loud.

---

## 7 · Security spec

Numbered so phases can reference them. S1–S6 ship **in Phase 3 with the endpoints they protect** — the survey is not "launched then hardened."

| # | Control | Detail |
|---|---|---|
| S1 | Input contracts | Zod on every route handler and server action (Appendix B). Body size cap 32 KB. `note` ≤ 280 chars, `flags` ≤ 8 per position and validated against the `flags` table, `items` ≤ 64, store/fixture/position existence checked against the DB. |
| S2 | Rate limiting | Workers rate-limit binding (Appendix D), keyed twice per request: `d:<deviceHash>` and `i:<ip>`. Limits per §5. The binding's counters are ephemeral (per-colo, 60 s windows) — **no IP is ever written to storage**, keeping the no-personal-data promise. Binding unavailable ⇒ requests still pass S1 + S5; the app degrades safe, not open. |
| S3 | Magic-link allowlist | `signIn` callback rejects any email without a `users` row (Appendix C). Nobody self-registers. Emails compared lowercase. |
| S4 | Authorization in the data layer | Every CMS server action re-checks: valid session → role → brand scope (editors may only touch rows whose `brand_id` ∈ their `user_brands`). Middleware only handles redirect-to-login UX. Precedent: CVE-2025-29927. |
| S5 | Audit everything, including anonymous writes | Public writes log `actor = device_hash`; CMS writes log `actor = email`. `before`/`after` jsonb. The admin **revert** action (Phase 4) restores `before` into `conditions` and is itself audited. |
| S6 | Idempotency + LWW | §4 calls 4 and 5. Integrity is a security property: replay must not duplicate, stale must not clobber. |
| S7 | Security headers | CSP (self + CF analytics beacon), `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`. ~20 lines in `next.config.ts`. |
| S8 | Open-source hygiene | Seed script contains only fictional planograms/stores — real layouts live exclusively in the DB. `.env.example` complete, `.env*` gitignored, secrets via `wrangler secret`. Dependabot + `npm audit` in CI. **Repo is public from the first commit (Phase 0) — this makes S8 unconditional from day one, not a Phase 6 gate.** Every commit, from the first, must satisfy it: no real store data, no secrets, ever. |
| S9 | Escalation seams (built, off) | Env-flag Turnstile on the two POST endpoints (free, cookieless); env-flag per-store URL suffixes. Turning either on is config, not code. Default: off — day-one UX stays frictionless. |
| S10 | No raw IPs, no PII | Grep-able invariant: nothing persists IPs, emails (outside `users`), names, or locations. `device_hash` + store numbers only. |

---

## 8 · Free-tier budget (verified 2026-07)

| Resource | Free limit | Expected (realistic worst case) | Verdict |
|---|---|---|---|
| Workers requests | 100,000/day | ~3–5k/day at full adoption | 20–30× headroom |
| Workers CPU | 10 ms/request | cached responses ~1–3 ms; SSR pages kept lean | OK — watch heaviest page in Phase 6 Lighthouse pass |
| Neon storage | 0.5 GB, writes fail over | hot set < 300 MB/yr with snapshot dedup + archival | OK with S/archival discipline |
| Neon compute | 100 CU-h/mo (≈400 awake-h @ 0.25 CU) | writes-only wakes ≪ 100 h | OK — *only because reads are cached* |
| Neon egress | 5 GB/mo, **compute suspends if exceeded** | < 1 GB (cache misses + writes) | OK — same caveat |
| Durable Objects (free = SQLite-backed) | 100k req/day | revalidation queue traffic, tiny | OK |
| D1 (tag cache) | 5M reads/day, 100k writes/day | ≤ 1 read/request | OK |
| R2 | 10 GB | incremental cache + round archives | Years of headroom |
| Resend | 100 emails/day | ~10 magic links/week | OK |

**Growth valve** (Phase 5): a monthly Cron Trigger exports rounds + audit rows older than 12 months to R2 as JSONL and prunes them from Postgres. Steady-state hot set stays under half the Neon quota indefinitely. The valve is code from day one, so scale never becomes a migration.

---

## 9 · Build order

**The CMS comes before the survey.** The survey is a view of catalog data; you cannot build it against data that doesn't exist. This feels backwards and is correct.

Every phase ends with its **Done when** list fully green. Do not start phase N+1 with phase N red — partial phases are how v1 accumulated drift.

### Phase 0 — Foundations

- Dean completes the human setup checklist (§11) first — accounts can't be scripted.
- Scaffold Next 16 + TS `strict` in `~/projects/rounds`. npm. ESLint + Prettier.
- Copy `ROUNDS-PLAN.md` + `ROUNDS-PRIMER.md` into `docs/`. Write `CLAUDE.md` pointing at both, including the "Next 16 post-dates your training data — read `node_modules/next/dist/docs/`" warning.
- `@opennextjs/cloudflare` + `wrangler.jsonc` with all bindings (Appendix D). Connect the repo to Cloudflare Workers Builds so `main` auto-deploys.
- Neon project + Drizzle + full schema (Appendix A) as migration 0001 + seed script with **fictional** demo data (S8).
- GitHub Actions: typecheck, lint, Vitest, build on every push. Dependabot on.
- MIT `LICENSE`, `README` stub, complete `.env.example`.

**Done when:** pushing to `main` auto-deploys a hello page to a `workers.dev` URL · CI is green · `npm run db:migrate && npm run db:seed` works from scratch · schema constraints verified by a Vitest suite that actually inserts rows (uniqueness, CHECKs, FK cascades).

### Phase 1 — Design system (before any page)

- Tailwind v4 `@theme` tokens: neutrals, three brand accents, type scale, spacing, radii (sharp — the table has hard corners), motion. Fonts via `next/font`.
- Primitives: `Button`, `Field`, `Chip`, `FlagToggle`, `Sheet`, `TablePlan`. SVG sprite pipeline.
- **`/kitchen-sink`** renders every component in every state (default/hover/focus/active/disabled/error, per brand accent). This is where design arguments happen cheaply, once.

**Done when:** kitchen-sink is complete · keyboard focus visible on everything · AA contrast verified for all three brand accents on both surfaces · zero SCSS files exist.

### Phase 2 — The CMS

- Better Auth: magic link + `disableSignUp` allowlist (S3, Appendix C). Roles + brand scoping enforced per S4.
- **Products CRUD** with SKU validation (7 digits, unique).
- **Bulk paste import**: paste a table → map columns → preview with per-row validation → confirm. (~60 products; typing them individually is a punishment.)
- **Planogram editor**: fixture → section grid → assign product / mark planned-empty per position. Typeahead search (the v1 interaction worth keeping).
- **Flags vocabulary editor** (the `flags` table is CMS-managed).
- Stores admin (add/rename stores, edit per-store overrides).
- Audit log on every mutation (S5) · every mutation revalidates its tags (§3).

**Done when:** an editor scoped to Canon cannot see or touch Sony rows (Vitest, not honor system) · a signup attempt from an unknown email is rejected · bulk import round-trips 60 real-shaped rows · every mutation produces an audit row and busts the right tag (integration-tested).

### Phase 3 — The survey (public, loginless) + its armor *(realigned per §1 #15)*

- Store entry (4-digit keypad, no text keyboard) → **auto-creates the store** if new (`POST /api/stores`).
- Overview: the three fixed tables drawn as square textured slabs (oak ×2, grey marble ×1), camera SVGs on the section grids, flags visible at a glance → tap a table → zoomed single-table view with tappable sides → side view.
- Side view (Dean's v1 format): positions left→right *viewed from the end cap*; each column = camera name + Alarm / No Power / Broken / Missing + inline note. **Record ⇄ Edit-layout toggle** on the same screen; edit mode assigns master-list products to slots (`POST /api/layout`).
- Living state: a broken camera stays broken across visits — nobody re-enters yesterday's damage.
- Reads via the cached GETs (§5); writes via `POST /api/conditions`, `/api/layout`, `/api/stores`.
- **S1, S2, S5, S6, S7 ship in this phase, same commits as the endpoints.**
- Generate output + copy-to-clipboard.
- Cloudflare Web Analytics snippet.

**Done when:** the public POST endpoints reject: unknown store (conditions/layout), unknown position, unknown flag, unknown/inactive product (layout), oversized note/body, stale `captured_at` (409 + current row) · store entry creates-once (re-entry is a no-op) · rate limit demonstrably trips (integration test with the binding stubbed) · anonymous writes appear in `audit_log` with `device_hash` · a full table walk works end-to-end on a phone.

### Phase 4 — Rounds (snapshots) + history

- Submit round → freeze: resolve each position through overrides → upsert `product_snapshots` by content hash → write `round_items` (snapshot ref + flags + note) in one transaction.
- `client_key` idempotency: replaying the same submission returns the original round, 200.
- Per-store history: "0058 · Tuesday · 3 issues", round detail view, diff-against-today.
- Admin revert UI for conditions (S5), audited.

**Done when:** double-submitting a round (simulated retry) produces one round · renaming a product in the CMS does *not* change any existing round's display · snapshot table stays deduped (same product state twice ⇒ one row) · history renders from the `rounds:<n>` cache tag.

### Phase 5 — Resilience

- IndexedDB cache-first render + write queue exactly per §6 / Appendix E.
- Pending/rejected UI chip. Offline banner.
- Monthly archival Cron Trigger → JSONL to R2 → prune (§8 growth valve).

**Done when:** airplane-mode walk of a full table, then reconnect ⇒ all writes land, in order, no duplicates (Playwright, network-throttled) · a poisoned queue op (400) surfaces visibly and doesn't block the queue · archival job tested against seeded old data.

### Phase 6 — Ship

- a11y audit: full keyboard-only pass, screen-reader pass on the survey flow, contrast re-check.
- Lighthouse ≥ 95 on survey routes; check heaviest SSR page against the 10 ms Workers CPU budget.
- Playwright E2E: (1) walk a table and flag a condition; (2) submit a round and see it in history.
- `README.md`, `SETUP.md` (a stranger self-hosts in five minutes: Neon + Cloudflare + Resend from zero), `LICENSE`.
- Final git-history audit (S8 has applied since commit one, so this is a confirmation pass, not a scrub-and-hope): grep full history for secrets and real store/planogram data.

**Done when:** a fresh clone following SETUP.md alone reaches a working deploy · both E2E flows green in CI · git-history audit confirms no real store data or secrets were ever committed.

---

## 10 · Testing strategy

- **Vitest** on: LWW acceptance rules, snapshot canonicalization + hashing (property: same logical product ⇒ same hash; any field change ⇒ new hash), override resolution (master vs override vs planned-empty), Zod contracts (accept/reject tables), brand-scope authorization, audit emission.
- **Playwright** on exactly the two flows that matter (§9 Phase 6), plus the airplane-mode queue test (Phase 5). CMS E2E is *not* required — server actions are covered by integration tests with a stubbed session.
- CI runs all of it on every push. A red main is a stop-the-line event.

---

## 11 · Human setup checklist (Dean — before/during Phase 0)

Accounts can't be scripted; everything else can. In order:

1. Create the GitHub repo `rounds` (**public**, MIT-licensed from the start — S8 hygiene applies unconditionally, so there's no private-build phase) and the local folder `~/projects/rounds`; connect that folder to the agent session.
2. **Neon**: create a free project named `rounds`, region `aws-us-east-1`. Copy the connection string into `.env.local` (`DATABASE_URL`).
3. **Cloudflare**: free account. Enable Workers + R2 (R2 activation may ask for a card; the tiers used here bill $0). Connect the GitHub repo to Workers Builds when the agent has the config ready.
4. **Resend**: free account. For development the default onboarding sender works; before Phase 6, verify a real sending domain.
5. Hand the agent `ROUNDS-PRIMER.md` (paste it or have it read `docs/`) and say go.

Secrets inventory (complete): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`. Feature flags (default off): `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`, `STORE_SLUG_MODE`.

---

## 12 · Open items (content, not architecture)

- **Real planograms.** The CMS exists precisely so the truth gets entered there; fictional seed data unblocks all development.
- **Table dimensions** for the plan-view mockup — match Dean's Canva drawings during Phase 1.
- Nothing else. Every previously open decision is locked in §1.

---

## Appendix A · Drizzle schema (authoritative)

Verify exact Drizzle API names against the installed version; the *shapes, constraints, and indexes* below are locked. CHECK constraints noted in comments go in the migration SQL.

```ts
// Rounds — database schema (Drizzle ORM, Postgres/Neon)
//
// This file is the source of truth for docs/ROUNDS-PLAN.md Appendix A.
// If you change something here, update the plan doc to match (and vice
// versa) — they must never drift.
//
// Four concepts, deliberately kept apart (plan §4):
//   CATALOG    what products exist          (the CMS)
//   PLANOGRAM  where they're supposed to go (master layout)
//   CONDITION  what's currently wrong       (living state)
//   ROUND      what you found on a date     (frozen snapshot)

import {
  pgTable, pgEnum, integer, smallint, bigint, text, boolean,
  timestamp, jsonb, uuid, primaryKey, uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const productKind = pgEnum('product_kind', ['camera', 'lens', 'accessory', 'tablet', 'display'])
export const layoutKind  = pgEnum('layout_kind', ['endcap', 'plain'])
export const surfaceKind = pgEnum('surface_kind', ['gray', 'wood'])
export const sectionKey  = pgEnum('section_key', ['endcap', 'right', 'left', 'lens'])
export const userRole    = pgEnum('user_role', ['admin', 'editor'])

// ── CATALOG ──────────────────────────────────────────────────────────────
export const brands = pgTable('brands', {
  id:     integer('id').primaryKey().generatedAlwaysAsIdentity(),
  slug:   text('slug').notNull().unique(),
  name:   text('name').notNull(),
  accent: text('accent').notNull(), // '#RRGGBB'
  sort:   smallint('sort').notNull().default(0),
}, (t) => [check('brands_accent_hex', sql`${t.accent} ~ '^#[0-9a-f]{6}$'`)])

export const products = pgTable('products', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  brandId:   integer('brand_id').notNull().references(() => brands.id),
  quickName: text('quick_name').notNull(),
  longName:  text('long_name').notNull(),
  model:     text('model').notNull(),
  sku:       text('sku').notNull().unique(), // 7-digit BBY SKU
  kind:      productKind('kind').notNull(),
  active:    boolean('active').notNull().default(true),
  meta:      jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('products_brand_idx').on(t.brandId),
  check('products_sku_format', sql`${t.sku} ~ '^[0-9]{7}$'`),
])

// CMS-managed flag vocabulary (plan Phase 2)
export const flags = pgTable('flags', {
  key:    text('key').primaryKey(),
  label:  text('label').notNull(),
  sort:   smallint('sort').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

// ── PLANOGRAM ────────────────────────────────────────────────────────────
export const fixtures = pgTable('fixtures', {
  id:         integer('id').primaryKey().generatedAlwaysAsIdentity(),
  slug:       text('slug').notNull().unique(),
  name:       text('name').notNull(),
  layoutKind: layoutKind('layout_kind').notNull(),
  surface:    surfaceKind('surface').notNull(),
})

export const fixtureBrands = pgTable('fixture_brands', {
  fixtureId: integer('fixture_id').notNull().references(() => fixtures.id),
  brandId:   integer('brand_id').notNull().references(() => brands.id),
}, (t) => [primaryKey({ columns: [t.fixtureId, t.brandId] })])

export const sections = pgTable('sections', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  fixtureId: integer('fixture_id').notNull().references(() => fixtures.id),
  key:       sectionKey('key').notNull(),
  label:     text('label').notNull(),
  sort:      smallint('sort').notNull().default(0),
}, (t) => [uniqueIndex('sections_fixture_key_idx').on(t.fixtureId, t.key)])

export const positions = pgTable('positions', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sectionId: integer('section_id').notNull().references(() => sections.id),
  idx:       smallint('idx').notNull(), // display order — NEVER an identity
  productId: integer('product_id').references(() => products.id), // NULL = planned-empty
}, (t) => [uniqueIndex('positions_section_idx_idx').on(t.sectionId, t.idx)])
// The planogram editor writes a whole section in ONE transaction so this
// unique index never trips mid-reorder (delete-and-recreate idx values, or
// a two-phase offset write).

// ── STORES ───────────────────────────────────────────────────────────────
export const stores = pgTable('stores', {
  id:       integer('id').primaryKey().generatedAlwaysAsIdentity(),
  number:   text('number').notNull().unique(), // 4-digit BBY store number
  nickname: text('nickname'),
}, (t) => [check('stores_number_format', sql`${t.number} ~ '^[0-9]{4}$'`)])

export const storePositions = pgTable('store_positions', { // OVERRIDES ONLY
  storeId:    integer('store_id').notNull().references(() => stores.id),
  positionId: integer('position_id').notNull().references(() => positions.id),
  productId:  integer('product_id').references(() => products.id), // NULL = kept empty here
}, (t) => [primaryKey({ columns: [t.storeId, t.positionId] })])

// ── CONDITION (living state) ────────────────────────────────────────────
export const conditions = pgTable('conditions', {
  id:         integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId:    integer('store_id').notNull().references(() => stores.id),
  positionId: integer('position_id').notNull().references(() => positions.id),
  flags:      text('flags').array().notNull().default(sql`'{}'::text[]`),
  note:       text('note').notNull().default(''),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(), // LWW key (client clock)
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  shift:      text('shift').notNull().default(''),
  deviceHash: text('device_hash').notNull(), // never an IP (S10)
}, (t) => [
  uniqueIndex('conditions_store_position_idx').on(t.storeId, t.positionId),
  check('conditions_note_length', sql`char_length(${t.note}) <= 280`),
  check('conditions_device_hash_format', sql`${t.deviceHash} ~ '^[0-9a-f]{16,64}$'`),
])

// ── ROUND (frozen snapshots) ────────────────────────────────────────────
export const productSnapshots = pgTable('product_snapshots', {
  id:          integer('id').primaryKey().generatedAlwaysAsIdentity(),
  productId:   integer('product_id').notNull().references(() => products.id),
  contentHash: text('content_hash').notNull().unique(), // sha256 hex of canonical payload
  data:        jsonb('data').notNull(), // { quickName, longName, model, sku, kind, brandSlug }
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}) // IMMUTABLE — rows are inserted, never updated. That is the history guarantee (plan §4.1).

export const rounds = pgTable('rounds', {
  id:          integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId:     integer('store_id').notNull().references(() => stores.id),
  fixtureId:   integer('fixture_id').notNull().references(() => fixtures.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  shift:       text('shift').notNull().default(''),
  deviceHash:  text('device_hash').notNull(),
  clientKey:   uuid('client_key').notNull().unique(), // idempotency (plan §4.4)
}, (t) => [
  index('rounds_store_time_idx').on(t.storeId, t.submittedAt),
  check('rounds_device_hash_format', sql`${t.deviceHash} ~ '^[0-9a-f]{16,64}$'`),
])

export const roundItems = pgTable('round_items', {
  roundId:    integer('round_id').notNull().references(() => rounds.id),
  positionId: integer('position_id').notNull().references(() => positions.id),
  snapshotId: integer('snapshot_id').references(() => productSnapshots.id), // NULL = slot empty
  flags:      text('flags').array().notNull().default(sql`'{}'::text[]`),
  note:       text('note').notNull().default(''),
}, (t) => [
  primaryKey({ columns: [t.roundId, t.positionId] }),
  check('round_items_note_length', sql`char_length(${t.note}) <= 280`),
])

// ── USERS (CMS auth — Better Auth, decided 2026-07-13; see docs/WORKLOG.md) ─
// Better Auth's own tables (accounts/sessions/verification) are generated
// by `npx @better-auth/cli generate` in Phase 2, once the auth config
// exists — they intentionally are NOT hand-written here to avoid drifting
// from what the library actually expects. This table is OURS: it is the
// row Better Auth's user table extends with a role + brand scope, and it's
// what user_brands and audit_log.actor (email) reference.
export const users = pgTable('users', {
  id:            text('id').primaryKey(),
  name:          text('name'),
  email:         text('email').notNull().unique(), // stored lowercase
  emailVerified: boolean('email_verified').notNull().default(false),
  role:          userRole('role').notNull().default('editor'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userBrands = pgTable('user_brands', {
  userId:  text('user_id').notNull().references(() => users.id),
  brandId: integer('brand_id').notNull().references(() => brands.id),
}, (t) => [primaryKey({ columns: [t.userId, t.brandId] })])

// ── AUDIT ────────────────────────────────────────────────────────────────
export const auditLog = pgTable('audit_log', {
  id:       bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  actor:    text('actor').notNull(), // email (CMS) or device_hash (public). NEVER an IP (S10).
  entity:   text('entity').notNull(), // 'product' | 'position' | 'condition' | 'round' | ...
  entityId: text('entity_id').notNull(),
  action:   text('action').notNull(), // 'create' | 'update' | 'delete' | 'revert' | ...
  before:   jsonb('before'),
  after:    jsonb('after'),
  at:       timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('audit_entity_idx').on(t.entity, t.entityId), index('audit_at_idx').on(t.at)])
```

---

## Appendix B · Public write contracts (Zod 4)

```ts
// src/lib/contracts.ts — shared by the client queue, the route handlers, and tests
import { z } from 'zod'

export const deviceHash  = z.string().regex(/^[0-9a-f]{16,64}$/)
export const storeNumber = z.string().regex(/^\d{4}$/)
const flagKey  = z.string().max(32)          // ALSO validated against the flags table server-side
const shiftStr = z.string().max(24)

// B1 — POST /api/conditions
export const conditionWrite = z.object({
  storeNumber,
  positionId: z.number().int().positive(),
  flags:      z.array(flagKey).max(8),
  note:       z.string().max(280),
  capturedAt: z.iso.datetime(),              // LWW comparison key
  deviceHash,
  shift:      shiftStr,
})

// B2 — POST /api/rounds
export const roundSubmit = z.object({
  storeNumber,
  fixtureSlug: z.string().max(40),
  clientKey:   z.uuid(),                     // idempotency key
  capturedAt:  z.iso.datetime(),
  deviceHash,
  shift:       shiftStr,
  items: z.array(z.object({
    positionId: z.number().int().positive(),
    flags:      z.array(flagKey).max(8),
    note:       z.string().max(280),
  })).min(1).max(64),
})
```

Server-side, after the Zod parse, both handlers additionally verify: the store exists, every `positionId` belongs to the named fixture (rounds) or to any fixture (conditions), and every flag key is `active` in the `flags` table. Zod says "well-formed"; the DB checks say "true."

---

## Appendix C · Better Auth configuration (the parts that must not be improvised)

**Amended 2026-07-13, mid-Phase-0.** The plan originally locked Auth.js v5. While scaffolding, the implementing session checked npm directly and found Auth.js v5 has been in beta for 2+ years with no committed GA date, and the Auth.js project has been organizationally absorbed into Better Auth — the maintainers now explicitly recommend Better Auth for new projects and commit only to "security and critical fixes" for Auth.js going forward. Presented to Dean as a real fork (not silently substituted, per the primer's hard rule); he chose **Better Auth**. Rationale for the recommendation that was given: Better Auth is on a real stable release line (1.6.23, not a beta tag), has official first-party Drizzle + Postgres support, and — most importantly for S3 — has a built-in `disableSignUp` flag that enforces the allowlist requirement as a first-class option, which is safer than Auth.js's hand-rolled `signIn` callback (one less thing a future maintainer can forget to write correctly).

Package: `better-auth` only (verified 2026-07-13 against the installed 1.6.23 package — the Drizzle adapter ships inside the core package at the `better-auth/adapters/drizzle` subpath; no separate `@better-auth/drizzle-adapter` install is needed). Better Auth's own tables (user/session/account/verification) are generated by its CLI (`npx @better-auth/cli generate`) once this config exists, in Phase 2 — they are intentionally not hand-written in Appendix A, to avoid drifting from what the installed version actually expects. Verify the exact generated shape against the installed package at Phase 2 time, same as every other "postdates training data" caution in this plan.

```ts
// src/lib/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins/magic-link'
import { db } from '@/db'
import { resend } from '@/lib/resend'
import { getUserWithBrands } from '@/db/queries/users'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  plugins: [
    magicLink({
      // S3 — THE ALLOWLIST. disableSignUp is a first-class Better Auth
      // option: nobody can create an account via the magic-link flow,
      // full stop. This is the safer equivalent of Auth.js's hand-rolled
      // signIn callback — there's no separate step to remember.
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: process.env.AUTH_EMAIL_FROM!,
          to: email.toLowerCase(),
          subject: 'Sign in to Rounds',
          html: `<a href="${url}">Sign in to Rounds</a>`,
        })
      },
    }),
  ],
  session: {
    // Verify against the installed version at Phase 2: Better Auth's
    // default is a DB-backed session row with an optional cookieCache
    // layer to avoid re-querying on every request. Confirm cookieCache
    // (JWT-format) gets us the same "no session-table read per request"
    // property §1.10 originally wanted from Auth.js's pure JWT strategy —
    // with 5 users the DB-backed default may simply be fine as-is.
  },
})

// Every CMS data-access function still resolves role + brand scope from
// OUR users/user_brands tables (S4) — Better Auth owns authentication
// (who is this), not authorization (what brands can they touch).
export async function requireEditor(brandId: number) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.email) throw new Error('unauthenticated')
  const u = await getUserWithBrands(session.user.email.toLowerCase())
  if (!u) throw new Error('unauthenticated')
  if (u.role !== 'admin' && !u.brandIds.includes(brandId)) throw new Error('forbidden')
  return u
}
```

S4 still applies exactly as originally specified: middleware is not the security boundary, so `requireEditor` (or its equivalent, confirmed against the real Better Auth session API at Phase 2) runs inside every CMS server action, not just in middleware.

---

## Appendix D · Cloudflare / OpenNext configuration

Caching on the adapter needs three components (verified against OpenNext docs, 2026-07); all free-tier:

| Component | Binding | Free tier |
|---|---|---|
| Incremental cache (rendered pages/data) | **R2 bucket** | 10 GB |
| Tag cache (`revalidateTag`) | **D1 database** (`D1NextModeTagCache`) | 5M reads/day |
| Revalidation queue | **Durable Object** (SQLite-backed — required on free plan) | 100k req/day |

`wrangler.jsonc` sketch (agent fills in real ids; exact shape from current OpenNext docs):

```jsonc
{
  "name": "rounds",
  "compatibility_flags": ["nodejs_compat"],
  "r2_buckets":  [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "rounds-cache" }],
  "d1_databases": [{ "binding": "NEXT_TAG_CACHE_D1", "database_name": "rounds-tags" }],
  // + DO queue binding per OpenNext docs
  "ratelimits": [
    { "name": "RL_CONDITIONS", "namespace_id": "1001", "simple": { "limit": 60, "period": 60 } },
    { "name": "RL_ROUNDS",     "namespace_id": "1002", "simple": { "limit": 12, "period": 60 } }
  ],
  "triggers": { "crons": ["0 6 1 * *"] }   // monthly archival valve (§8)
}
```

Rate-limit binding facts to design around: periods are only 10 s or 60 s; counting is per-colo and eventually consistent (permissive). That's fine — S2 is a volume damper, not an accounting system; S1 + S5 + S9 carry the rest. Call it twice per request: once keyed `d:<deviceHash>`, once `i:<ip>` (IP read from the request, used for the check, never stored — S10).

Deploys: Cloudflare Workers Builds watches the GitHub repo — `main` → production; PRs → preview URLs. GitHub Actions runs checks only (no deploy secrets in GitHub).

---

## Appendix E · Client sync queue (normative pseudocode)

```
STATE (idb-keyval)
  catalog        { data, fetchedAt }
  store:<n>      { data, fetchedAt }
  queue:v1       Op[]            Op = { opId, kind, payload, enqueuedAt, attempts }
  device         32-hex string, generated once via crypto.getRandomValues

RENDER (any survey screen)
  1. paint from idb cache immediately (stale is fine, spinner is not)
  2. if online → fetch GET, update idb, re-render

WRITE (user toggles a flag / submits a round)
  1. apply optimistically to local state + idb
  2. push Op onto queue:v1        (round Ops carry clientKey = opId)
  3. flush()

FLUSH (on: app load · 'online' event · after enqueue; single-flight, FIFO)
  for op = head of queue:
    resp = POST op
    2xx            → dequeue
    409 stale      → dequeue; merge response's current row into local state
    other 4xx      → dequeue; mark visible "change rejected" (never retry bad payloads)
    5xx / network  → op.attempts++; stop; retry whole flush in min(2^attempts, 300)s
  never drop an op for any other reason

UI
  chip: "N pending" while queue non-empty · loud state on any rejected op
  offline banner when navigator.onLine === false
```

---

*End of plan. Decisions locked 2026-07-13, amended 2026-07-13 (repo visibility, DB region per Dean's overrides — §1 items 11 & 13) · Director of record: Fable (project-director session) · Next hands: see `ROUNDS-PRIMER.md`.*
