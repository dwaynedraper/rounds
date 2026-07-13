<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rounds

Before doing anything else, read **`docs/ROUNDS-PRIMER.md`**, then **`docs/ROUNDS-PLAN.md`** in full. The plan is locked (with amendments logged in its §1) — architectural decisions are not up for debate. `docs/WORKLOG.md` has the current phase and what's next.

Same "your training data may be stale" caution above applies to Tailwind v4, Better Auth, Zod 4, and `@opennextjs/cloudflare` — verify against the installed package, not memory, every time.

## Session-start checklist

1. Read `docs/ROUNDS-PLAN.md` §9 and `docs/WORKLOG.md` to locate the current phase and next task.
2. `npm run typecheck && npm run lint && npm run test` — confirm you're starting green.
3. State to Dean, in one or two sentences: current phase, what you're about to do, and what "done" looks like for this session.

## Non-negotiables (see primer for the full list)

- Work plan phases in order; a phase isn't done until its "Done when" list is verified green.
- TypeScript `strict`, zero `any`, lint-clean, CI green on `main`.
- No real store data or secrets in the repo, ever — this repo is public.
- Security items S1–S10 (plan §7) ship in the same commits as the endpoints they protect.
- If the plan conflicts with reality, stop and present Dean concrete options. Never silently substitute.
