// Rounds — S2 rate limiter tests (plan §7 S2; §9 Phase 3 "done when: rate
// limit demonstrably trips ... with the binding stubbed").
//
// @upstash/ratelimit + @upstash/redis are stubbed so this suite needs no
// network and no Redis. What's under test is OUR wiring, which is where the
// bugs actually live:
//   - the limit demonstrably trips (success:false ⇒ 429 path)
//   - "degrade safe, not open": unconfigured or throwing ⇒ request passes
//   - each endpoint's own (limit, window) from plan §5 reaches the limiter
//     rather than collapsing to one shared number. This is a REGRESSION
//     GUARD: on Cloudflare all three endpoints shared the RL_CONDITIONS
//     binding, whose 60/60s lived in wrangler.jsonc, so the per-endpoint
//     values in the route handlers were silently never applied (plan §1 #17).
import { describe, test, expect, beforeEach, vi } from "vitest";

type LimitResult = { success: boolean };

/** Records every limiter constructed and every limit() call made. */
const spy = {
  constructed: [] as Array<{ limit: number; window: string; prefix?: string }>,
  calls: [] as string[],
  next: (() => ({ success: true })) as (key: string) => LimitResult,
  reset() {
    this.constructed = [];
    this.calls = [];
    this.next = () => ({ success: true });
  },
};

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(public opts: { url: string; token: string }) {}
  },
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    constructor(public cfg: { limiter: { limit: number; window: string }; prefix?: string }) {
      spy.constructed.push({
        limit: cfg.limiter.limit,
        window: cfg.limiter.window,
        prefix: cfg.prefix,
      });
    }
    async limit(key: string): Promise<LimitResult> {
      spy.calls.push(key);
      return spy.next(key);
    }
    static fixedWindow(limit: number, window: string) {
      return { limit, window };
    }
  }
  return { Ratelimit };
});

/** Fresh module instance — the real one memoizes its Redis client and its
 *  limiter map at module scope, so state must not leak between tests. */
async function freshRateLimit(configured = true) {
  vi.resetModules();
  if (configured) {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  } else {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  }
  const mod = await import("../src/lib/rate-limit");
  return mod.rateLimit;
}

beforeEach(() => {
  spy.reset();
  vi.unstubAllEnvs();
});

describe("S2 rate limiter", () => {
  test("allows a request the limiter accepts", async () => {
    const rateLimit = await freshRateLimit();
    spy.next = () => ({ success: true });

    await expect(rateLimit("d:abc", { limit: 30, windowSec: 60 })).resolves.toBe(true);
    expect(spy.calls).toEqual(["d:abc"]);
  });

  test("trips: a request the limiter rejects is denied", async () => {
    const rateLimit = await freshRateLimit();
    spy.next = () => ({ success: false });

    await expect(rateLimit("d:abc", { limit: 30, windowSec: 60 })).resolves.toBe(false);
  });

  test("device and ip are independent buckets", async () => {
    const rateLimit = await freshRateLimit();
    // Only the device bucket is over its limit; the ip bucket is fine.
    spy.next = (key) => ({ success: !key.startsWith("d:") });

    await expect(rateLimit("d:abc", { limit: 30, windowSec: 60 })).resolves.toBe(false);
    await expect(rateLimit("i:203.0.113.7", { limit: 60, windowSec: 60 })).resolves.toBe(true);
  });

  test("each endpoint's own plan §5 limit reaches the limiter", async () => {
    const rateLimit = await freshRateLimit();

    // The exact pairs used by the three write endpoints.
    await rateLimit("d:x", { limit: 30, windowSec: 60 }); // /api/conditions
    await rateLimit("i:x", { limit: 60, windowSec: 60 });
    await rateLimit("sd:x", { limit: 10, windowSec: 60 }); // /api/stores
    await rateLimit("si:x", { limit: 20, windowSec: 60 });
    await rateLimit("ld:x", { limit: 20, windowSec: 60 }); // /api/layout
    await rateLimit("li:x", { limit: 40, windowSec: 60 });

    const limits = spy.constructed.map((c) => c.limit).sort((a, b) => a - b);
    // 20 appears twice in the plan (layout device + stores ip) and must
    // share one limiter — five distinct (limit, window) pairs in total.
    expect(limits).toEqual([10, 20, 30, 40, 60]);
    expect(spy.constructed.every((c) => c.window === "60 s")).toBe(true);
  });

  test("limiters are reused per (limit, window), not rebuilt per call", async () => {
    const rateLimit = await freshRateLimit();

    await rateLimit("d:one", { limit: 30, windowSec: 60 });
    await rateLimit("d:two", { limit: 30, windowSec: 60 });
    await rateLimit("d:three", { limit: 30, windowSec: 60 });

    expect(spy.constructed).toHaveLength(1);
    expect(spy.calls).toHaveLength(3);
  });

  test("degrades SAFE, not open: unconfigured Upstash still allows writes", async () => {
    const rateLimit = await freshRateLimit(false);

    await expect(rateLimit("d:abc", { limit: 30, windowSec: 60 })).resolves.toBe(true);
    // No limiter was ever constructed — nothing to call.
    expect(spy.constructed).toHaveLength(0);
    expect(spy.calls).toHaveLength(0);
  });

  test("degrades SAFE, not open: an unreachable limiter still allows writes", async () => {
    const rateLimit = await freshRateLimit();
    spy.next = () => {
      throw new Error("upstash unreachable");
    };

    await expect(rateLimit("d:abc", { limit: 30, windowSec: 60 })).resolves.toBe(true);
  });

  test("S10: keys are namespaced and nothing is persisted by this module", async () => {
    const rateLimit = await freshRateLimit();
    await rateLimit("i:203.0.113.7", { limit: 60, windowSec: 60 });

    // The ip reaches Redis as an ephemeral counter key only, under our prefix.
    expect(spy.constructed[0]?.prefix).toBe("rounds:rl");
    expect(spy.calls).toEqual(["i:203.0.113.7"]);
  });
});
