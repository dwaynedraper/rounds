# Rounds — Context Primer for the Implementing Agent

You are building **Rounds** from scratch: a vendor table-survey app for camera departments inside Best Buy (Sony / Canon / Nikon). Open-source, hosted entirely on free tiers, used loginless by up to ~1,000 field reps. Read this file first, then `ROUNDS-PLAN.md` in full, before writing any code.

## Who you're working with

Dean is a Sony camera rep at Best Buy and the product owner. He is also a Next.js developer — solid fundamentals, out of practice — so explain what you're doing, but don't explain what a component is.

**Communication rules (non-negotiable):**

- Be explicit and unambiguous. Never say "should work," "roughly," or "you might want to." Say what IS, what you DID, and what happens NEXT.
- When you need a decision, present numbered concrete options with a recommendation and the trade-off of each. Never an open-ended "what do you think?"
- One question at a time.
- If something in the plan turns out to be impossible as written, STOP and say exactly what conflicts and why. Do not silently substitute an alternative.

## Project state

- **The plan is final, with two amendments made live during Phase 0.** `docs/ROUNDS-PLAN.md` was locked on 2026-07-13, then amended the same day when Dean overrode the DB region to `us-east-1` and made the repo public from commit one (both folded into §1 items 11/13), and again when the implementing session found Auth.js v5 is stuck in beta with the project absorbed into Better Auth — Dean chose Better Auth (§1 item 14, Appendix C rewritten). Architectural decisions are not up for debate — §1 of the plan lists all of them with rationale, including these three. Content items still open are listed in plan §12. **This is the shape a legitimate amendment takes: stop, verify the conflict is real, present concrete options to Dean, update §1 and the affected appendix once he decides. Never silently substitute.**
- **This is a v2 rewrite, not a refactor.** V1 lives at `~/projects/sony` (a broader Sony rep toolkit: camera finder, spec lookup, cage fights, OOS, display issues). It is reference material only — never modify it. Rounds is a new, separate repo at `~/projects/rounds`.
- **Lessons already paid for in v1 — do not relearn them:** MongoDB was the wrong shape for deeply relational data (hence Postgres/Drizzle); three styling systems drifted apart (hence Tailwind v4 tokens only, zero SCSS); survey marks keyed by array index re-attached to the wrong camera when layouts reordered (hence stable `position_id`s everywhere); auth added late left half-guarded routes (hence allowlist + data-layer authorization from day one).

## Hard rules

1. **Work the phases in order (plan §9). A phase is done when its "Done when" list is fully green — verified, not assumed.** Do not start the next phase with the current one red.
2. **Next.js 16 post-dates your training data.** APIs, conventions, and file structure may differ from what you remember. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code, every time you touch an unfamiliar API. Same caution for Tailwind v4, Better Auth, Zod 4, and `@opennextjs/cloudflare` — verify against installed docs, not memory. (Confirmed 2026-07-13: Next 16's real caching API is `cacheComponents: true` in `next.config.ts` — already enabled — plus `'use cache'`/`cacheTag()`/`cacheLife()`; this replaced the old `experimental.dynamicIO`/`experimental.useCache` flags from your training data.)
3. **TypeScript `strict`, zero `any`, lint-clean.** CI must stay green on `main`.
4. **No new dependencies** beyond the plan's stack without asking Dean with a one-line justification.
5. **Security items S1–S10 (plan §7) are requirements, not suggestions.** S1/S2/S5/S6/S7 ship in the same commits as the public endpoints they protect.
6. **Never store an IP address or any personal data. No cookies outside Better Auth's CMS session. No AI features.**
7. **No real store data in the repo, ever** — seeds are fictional; real planograms live only in the database. `.env*` never committed.
8. **The cache-tag discipline (plan §3) is load-bearing** — the free-tier math only works if reads never hit Postgres. Every new data read gets a tag; every mutation revalidates exactly what it dirtied.
9. Commit style: small, phase-scoped commits; imperative subject lines; reference the plan section (e.g. `phase-3: conditions endpoint + S1/S2 armor (§7)`).
10. Keep a short running `docs/WORKLOG.md` — date, what changed, what's next — so any session can resume cold.
11. **Schema/constraint tests run against local Postgres, never Neon.** `drizzle-orm/neon-http` only speaks to Neon's HTTP endpoint — it cannot point at a local Postgres. `tests/db-test-client.ts` uses `drizzle-orm/node-postgres` (`pg`) against a local `rounds_test` database instead, so CI never spends Neon's free-tier compute/storage quota (plan §8) just running tests. `schema.ts` is dialect-agnostic Postgres, so what passes locally is what Neon will enforce. The app's actual runtime (`src/db/index.ts`) stays on `neon-http`, unchanged.

## Session-start checklist (every session)

1. Read `docs/ROUNDS-PLAN.md` §9 and `docs/WORKLOG.md` to locate the current phase and next task.
2. `npm run typecheck && npm run lint && npm run test` — confirm you're starting green.
3. State to Dean, in one or two sentences: current phase, what you're about to do, and what "done" looks like for this session.

## First session (Phase 0)

Confirm with Dean that the human setup checklist (plan §11 — GitHub repo, Neon, Cloudflare, Resend) is complete, then scaffold per plan §9 Phase 0. Copy `ROUNDS-PLAN.md` and this primer into `docs/`, and create the repo's `CLAUDE.md` containing: a pointer to both docs, the Next-16-postdates-training warning from Hard Rule 2, and the session-start checklist above.

*Primer written 2026-07-13 by the project-director session (Fable). Questions about why a decision was made: plan §1 has the rationale table; if it isn't there, ask Dean.*
