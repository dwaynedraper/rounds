/* S2 — abuse damper for the loginless write endpoints. On Cloudflare it uses
 * the Workers rate-limit binding (per-colo, 60s windows). Off-platform (local
 * dev / build) it falls back to a best-effort in-memory limiter. Either way
 * NO IP is ever persisted (S10) — the key is used for the check and discarded.
 *
 * "Degrade safe, not open": if a limiter is unavailable we still fall back to
 * the in-memory counter rather than hard-failing the request — S1 (validation)
 * and S5 (audit) carry the rest. */

type MemRec = { count: number; reset: number };
const mem = new Map<string, MemRec>();

export async function rateLimit(
  bindingName: string,
  key: string,
  opts: { limit: number; windowSec: number },
): Promise<boolean> {
  // Prefer the Cloudflare binding when running on Workers.
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const binding = (ctx?.env as Record<string, unknown> | undefined)?.[bindingName] as
      | { limit: (o: { key: string }) => Promise<{ success: boolean }> }
      | undefined;
    if (binding?.limit) {
      const { success } = await binding.limit({ key });
      return success;
    }
  } catch {
    // no CF context (local/build) — fall through to in-memory
  }

  const now = Date.now();
  const rec = mem.get(key);
  if (!rec || now > rec.reset) {
    mem.set(key, { count: 1, reset: now + opts.windowSec * 1000 });
    return true;
  }
  if (rec.count >= opts.limit) return false;
  rec.count++;
  return true;
}
