/* The client IP, read from the platform's forwarding headers.
 *
 * S10 — this value is used for one thing only: as a rate-limit bucket key
 * (plan §5). It is never written to Postgres, never logged, never put in
 * audit_log.actor, and never returned in a response body. If you find
 * yourself passing the return value of this function anywhere other than
 * rateLimit(), stop — that is the invariant S10 exists to protect.
 *
 * Header order: Vercel sets `x-forwarded-for` (client first) and
 * `x-real-ip` on every request. `x-real-ip` is preferred because it is a
 * single address the platform sets itself, whereas `x-forwarded-for` is a
 * client-supplied chain that only the leftmost proxy can be trusted to
 * have appended to. The fallback exists so local dev still gets a key.
 */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}
