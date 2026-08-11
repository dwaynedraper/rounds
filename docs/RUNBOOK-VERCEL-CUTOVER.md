# Runbook — Vercel cutover

**Written 2026-07-24 for Dean, returning from a break.** Every step is literal. Copy-paste the commands. Where a value is yours to choose, it says so explicitly. Where something can go wrong, the symptom is named.

Work top to bottom. Do not skip ahead — step 6 depends on step 4, and step 7 is meaningless before step 6.

Delete this file once the cutover is done; it is scaffolding, not durable documentation.

---

## Names you need, once

| Thing | Value |
|---|---|
| Working branch | `feature/vercel-native` |
| Merge target | `main` |
| Base you branched from | `5343be1` |
| GitHub repo | `dwaynedraper/rounds` |
| Vercel function region | `iad1` (Washington, D.C.) |
| Neon region | `us-east-1` |
| Upstash region | `us-east-1` |

There is **one** working branch. Everything below happens on `feature/vercel-native`, and it merges into `main` exactly once, at step 8.

`develop` is not used in this cutover. It is 2 commits behind `main` and gets fixed at step 10.

---

## Step 1 — Apply the bundle

**Done, if `git log --oneline -1` already shows `docs: stop hardcoding a Postgres major`.** Skip to step 2.

Otherwise: the bundle is written straight to `~/projects/rounds` over the desktop bridge, so there is no download to click. One file, `rounds-ALL-REMAINING.bundle`.

```bash
cd ~/projects/rounds
git checkout feature/vercel-native
ls -l rounds-ALL-REMAINING.bundle          # must exist
git bundle verify ./rounds-ALL-REMAINING.bundle
git fetch ./rounds-ALL-REMAINING.bundle feature/vercel-native
git reset --hard FETCH_HEAD
```

**Verify before continuing:**

```bash
cat .nvmrc                      # must print 24
git log --oneline main..HEAD    # must list 13 commits
```

If `.nvmrc` still says 22, the fetch did not take. Stop and say so.

Then clear the stale bundles so nothing misleads a later step:

```bash
rm -f rounds-vercel-native.bundle _sync*.bundle
```

> **Why `git fetch … && git reset --hard` rather than `git fetch bundle branch:branch`?** Git refuses to fetch directly into a branch you have checked out. Fetching to `FETCH_HEAD` and resetting sidesteps that. You have no local work on this branch to lose.

---

## Step 2 — Get a clean local build

```bash
cd ~/projects/rounds
nvm use                                  # reads .nvmrc → Node 24
rm -rf node_modules pnpm-lock.yaml
npm ci
```

Use **npm**. Not pnpm. `pnpm install` moves npm's packages into `node_modules/.ignored`, and an interrupted run leaves `tsc`, `vitest` and `next` as "command not found".

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

**Expected: 42 passing tests, clean build.** If the three DB suites fail with `role "postgres" does not exist`, run this once:

```bash
brew services start postgresql@17   # or whichever major you have
createuser -s postgres
psql -d postgres -c "ALTER ROLE postgres WITH PASSWORD 'postgres';"
createdb -O postgres rounds_test
```

`createuser` and `createdb` print nothing on success.

---

## Step 3 — Push the branch

```bash
git push origin feature/vercel-native
```

The branch already exists on the remote at an older commit, so if git refuses:

```bash
git push --force-with-lease origin feature/vercel-native
```

`--force-with-lease` (not `--force`) refuses if someone else pushed in the meantime. Nobody else works on this repo, but the habit is free.

---

## Step 4 — Create the Upstash database

Do this **before** the PR, so the env vars exist when you first deploy.

1. Sign up at [upstash.com](https://upstash.com). No credit card.
2. Create a **Redis** database. Name it `rounds`. Region **us-east-1**. Type: Regional (not Global — you only serve one region).
3. On the database page, copy these two values from the **REST API** section:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

Keep them somewhere for step 5. They are secrets — do not paste them into the repo, a PR description, or this chat.

> Alternative: the Vercel Marketplace Upstash integration sets both variables automatically. Either way works.

---

## Step 5 — Create the Vercel project

1. Vercel dashboard → **Add New… → Project** → import `dwaynedraper/rounds`.
2. Framework preset: Vercel will detect **Next.js**. Change nothing about build or output settings.
3. **Before clicking Deploy**, expand **Environment Variables** and add all seven, ticking **Production**, **Preview**, and **Development** for each:

| Name | Value |
|---|---|
| `DATABASE_URL` | your Neon `us-east-1` connection string |
| `BETTER_AUTH_SECRET` | generate: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | leave blank for now; set at step 9 |
| `RESEND_API_KEY` | from Resend |
| `AUTH_EMAIL_FROM` | e.g. `Rounds <onboarding@resend.dev>` |
| `UPSTASH_REDIS_REST_URL` | from step 4 |
| `UPSTASH_REDIS_REST_TOKEN` | from step 4 |

**`BETTER_AUTH_SECRET` is required for the build itself**, not just for login. Better Auth initialises at module load, so the build crashes without it even though the survey is loginless.

4. Deploy.
5. Settings → **Functions** → confirm region is **Washington, D.C. (`iad1`)**. `vercel.json` pins it; the dashboard should already agree.

> **Do not skip the two Upstash variables.** Without them S2 rate limiting is inert — the app logs a warning and allows every write. The loginless write endpoints would be live with no abuse damper.

---

## Step 6 — Confirm Neon is migrated and seeded

I cannot reach Neon from a sandbox, so I do not know whether migration `0002` was ever applied. Run this from your machine, with the real `DATABASE_URL` in `.env.local`:

```bash
cd ~/projects/rounds
npm run db:migrate
npm run db:seed
```

`db:seed` is idempotent — safe to run twice. It seeds the fixed floor plan, the four flags, and a ~35-item starter camera list.

**Symptom if you skip this:** the survey loads but says the store is not set up, or the layout editor has no products to pick from.

---

## Step 7 — Open the PR

```bash
gh pr create --base main --head feature/vercel-native \
  --title "Vercel-native migration + post-break audit fixes" \
  --body "Migrates Rounds off Cloudflare Workers/OpenNext to Vercel-native Next.js (plan §1 #17), plus the fixes from the 2026-07-24 audit.

Required functional changes, not just deletions:
- S2 rate limiting moved to Upstash Redis; the Workers binding has no Vercel equivalent and the in-memory fallback is worthless on per-instance serverless.
- src/lib/reads.ts moved to 'use cache: remote'; plain 'use cache' is a per-instance in-memory LRU on Vercel, which would break plan §3 twice over (every cold instance hits Neon, and revalidateTag reaches only the writing instance).

Audit fixes:
- Nine Next.js advisories patched (16.2.10 → 16.3.0). 4 high + 5 moderate → 0 high, 5 moderate.
- S10 violation fixed: Better Auth was persisting client IPs in session.ip_address. Guarded by tests/s10-invariants.test.ts.
- Plan Appendix A resynced to src/db/schema.ts after ten days of drift.
- Node pinned to 24; aperture and shutter icons redrawn.

Tests 29 → 42. See docs/WORKLOG.md for the full record."
```

No `gh` CLI? Open <https://github.com/dwaynedraper/rounds/compare/main...feature/vercel-native> and paste the same title and body.

**Wait for the `checks` status to go green.** CI has never run on this branch — `main`'s branch protection requires that status, and this PR is what produces it. If CI fails, paste the failure here.

---

## Step 8 — Verify the preview, then merge

The PR gets a preview URL. **Test on the preview before merging**, on your actual phone:

1. Open the preview URL. Enter a 4-digit store number on the keypad.
2. Walk to a table, then a side. Flag a camera.
3. **Then the cache check — this is the important one.** Open the same store on a second device, or a private window on another network. **The flag must appear.** If it does not, `revalidateTag` is not reaching other instances and `'use cache: remote'` is not working. Stop and tell me.
4. Vercel dashboard → **Observability → Runtime Cache**. Hit rate should be non-trivial. Near zero means reads are still going to Neon on every request — the silent failure mode this whole migration guards against.

When all four pass, merge the PR. Use **Squash and merge** or **Merge commit**, your preference; the history is already clean either way.

---

## Step 9 — Point auth at the real URL

After the merge, production deploys from `main` and gets its real URL.

1. Vercel → Settings → Environment Variables → set `BETTER_AUTH_URL` to the production URL (e.g. `https://rounds.vercel.app`), Production scope.
2. Redeploy so it takes effect.
3. Add yourself as an admin, from your machine, against the production DB: `npm run db:admin` (defaults to `dean@sharpsightedstudio.com`).
4. Visit `/login`, request a magic link, confirm the email arrives and signs you in.

---

## Step 10 — Cleanup

```bash
git checkout main && git pull
git checkout develop && git merge --ff-only main && git push origin develop
git checkout main
git branch -d feature/vercel-native
git push origin --delete feature/vercel-native
rm -f ~/projects/rounds/*.bundle
rm -f ~/projects/rounds/docs/VERCEL-MIGRATION-HANDOFF.md
rm -f ~/projects/rounds/docs/RUNBOOK-VERCEL-CUTOVER.md
git add -A && git commit -m "chore: remove migration scaffolding" && git push
```

Delete `docs/VERCEL-MIGRATION-HANDOFF.md` rather than committing it: two of its instructions were wrong (it says PR #13 is open when it was already merged, and that caching would "just work" when it would not have), and plan §1 #17 plus the WORKLOG entry are the durable record.

In the Cloudflare dashboard: disconnect Workers Builds from the repo so it stops building. The `rounds` Worker, the `rounds-inc-cache` KV namespace and the `rounds-tags` D1 database are now orphaned and can be deleted whenever.

---

## Then, and only then

Two follow-ups worth doing once the cutover is stable, each on its own branch off `main`:

1. **`chore/prettier-format`** — `npm run format`, one commit. 89 files of pure formatting. Kept out of the migration deliberately so it would not bury the real diff.
2. **`refactor/survey-native-ssr`** — revert the survey pages from client-fetch to normal server components reading Next `params`. That layer exists only to dodge a Cloudflare bug that no longer exists; reverting puts the pages back on Vercel's ISR/CDN layer, cutting function invocations on top of the Neon savings. Flagged in a comment at the top of `src/lib/client-data.ts`. This is an improvement, not a fix — the current code works correctly on Vercel.
