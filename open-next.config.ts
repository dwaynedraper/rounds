import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Rounds — OpenNext (Cloudflare) adapter config.
//
// PHASE 0: minimal, defaults only. Nothing in the app caches yet (the
// tag-based cache reads land in Phase 3, plan §3), so the R2 incremental
// cache / D1 tag cache / Durable Object revalidation queue would be inert
// bindings today — and every binding declared here must be matched by a
// real resource in wrangler.jsonc or `wrangler deploy` fails. So we ship a
// working hello-world deploy first and add the caching stack when it's
// actually exercised.
//
// PHASE 3 (prep): switch to the full setup below — the exact shape is
// locked in docs/ROUNDS-PLAN.md Appendix D:
//
//   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
//   import d1NextTagCache      from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
//   import doQueue             from "@opennextjs/cloudflare/overrides/queue/do-queue";
//
//   export default defineCloudflareConfig({
//     incrementalCache: r2IncrementalCache,
//     tagCache: d1NextTagCache,
//     queue: doQueue,
//   });
//
// ...and add the matching r2_buckets / d1_databases / durable_objects /
// migrations / WORKER_SELF_REFERENCE service blocks back into
// wrangler.jsonc (they're kept there as commented reference).
export default defineCloudflareConfig();
