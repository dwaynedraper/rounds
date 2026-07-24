import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

// Rounds — OpenNext (Cloudflare) adapter config: the caching stack.
//
// This stack is NOT an optimization — it is load-bearing for correctness.
// Deployed without it (the Phase 0–3 minimal config), the Worker DEADLOCKED
// on prerendered-shell revalidation: shells carry a 5-minute stale-time,
// and when one expired the revalidation path hung until the runtime killed
// the request ("Worker threw exception" / error 1101 — see WORKLOG
// 2026-07-14, hang incident). The **Durable Object queue** is the piece that
// fixes the hang: it actually executes background revalidations instead of
// leaving a waitUntil() task to time out. The KV incremental cache stores
// rendered shells/data; the D1 table backs revalidateTag.
//
// Backend choice (plan §1 #16, overriding Appendix D's R2 pick): KV, not R2,
// for the incremental cache. R2 requires a payment method on file even
// within its free tier; KV is part of the Workers Free plan (no card),
// which keeps "free to host" true for us AND for anyone self-deploying this
// open-source repo. The queue (the actual fix) is identical either way, so
// nothing about correctness rides on this choice — only headroom. Flipping
// back to R2 is a 3-line change here + the r2_buckets block in wrangler.
//
// Deploys MUST go through `opennextjs-cloudflare deploy` (npm run cf:deploy
// / the Workers Builds deploy command) — it runs populate-cache first, which
// creates the D1 `revalidations` table and seeds the cache with the build's
// prerenders. A bare `wrangler deploy` skips that and starts the stack cold.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: d1NextTagCache,
  queue: doQueue,
});
