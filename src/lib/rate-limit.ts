/* S2 — abuse damper for the loginless write endpoints (plan §5, §7).
 *
 * Backed by Upstash Redis via @upstash/ratelimit. This replaced the
 * Cloudflare Workers rate-limit binding in the Vercel migration (plan §1
 * #17). The reason it could not simply be dropped: Vercel functions are
 * per-instance and short-lived, so a process-local counter resets constantly
 * and provides effectively no protection. S2 needs shared state.
 *
 * Algorithm: FIXED WINDOW, deliberately.
 *   - Cheapest option: 2–3 Redis commands per allowed check (sliding window
 *     costs 4–5). The free tier is 500K commands/month, and every write does
 *     two checks (device + ip), so the algorithm choice is the difference
 *     between comfortable and tight.
 *   - Accuracy at the window boundary does not matter here. Plan Appendix D
 *     already says it out loud: S2 is "a volume damper, not an accounting
 *     system"; S1 (validation) + S5 (audit) + S9 (escalation seams) carry
 *     the rest.
 *
 * ephemeralCache: an in-process Map of already-blocked keys and their reset
 * times. A caller who is already over the limit is rejected locally at 0
 * Redis commands until their window rolls. Exactly the case where an abuser
 * would otherwise cost the most.
 *
 * S10 — NO IP IS EVER PERSISTED. Callers pass `i:<ip>` as a key; it lives in
 * a Redis counter that expires with the window and is never written to
 * Postgres, logs, or the audit trail.
 *
 * "Degrade safe, not open" (plan S2): if Upstash is unreachable or
 * unconfigured, requests still pass S1 + S5 rather than hard-failing. A
 * survey a rep cannot submit to is a worse outcome than an unthrottled
 * minute, and the endpoints are still fully validated and audited.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Shared across every limiter instance so a blocked key stays blocked
// regardless of which endpoint it hits next.
const ephemeralCache = new Map<string, number>();

let redis: Redis | null | undefined; // undefined = not yet resolved, null = unconfigured

function getRedis(): Redis | null {
  if (redis === undefined) {
    redis =
      UPSTASH_URL && UPSTASH_TOKEN
        ? new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
        : null;
    if (!redis) {
      console.warn(
        "[rounds] UPSTASH_REDIS_REST_URL/_TOKEN not set — S2 rate limiting is INACTIVE (degrading safe: S1 + S5 still apply).",
      );
    }
  }
  return redis;
}

// One Ratelimit per distinct (limit, window) pair. Plan §5 gives each
// endpoint its own numbers, and unlike the old Cloudflare binding — whose
// limit lived in wrangler.jsonc and silently applied 60/60s to all three
// endpoints — these are the values that actually run.
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowSec: number): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;

  const key = `${limit}:${windowSec}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.fixedWindow(limit, `${windowSec} s`),
      ephemeralCache,
      analytics: false, // +1 Redis command per call; not worth the quota
      prefix: "rounds:rl",
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Returns true if the request may proceed, false if it is rate limited.
 *
 * @param key    the bucket — `d:<deviceHash>` or `i:<ip>` (never stored, S10)
 * @param opts   the endpoint's limit from plan §5
 */
export async function rateLimit(
  key: string,
  opts: { limit: number; windowSec: number },
): Promise<boolean> {
  const limiter = getLimiter(opts.limit, opts.windowSec);
  if (!limiter) return true; // unconfigured — degrade safe, not open

  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (err) {
    // Upstash unreachable. Same posture as above: never hard-fail a write.
    console.warn("[rounds] rate limiter unavailable, allowing request:", err);
    return true;
  }
}
