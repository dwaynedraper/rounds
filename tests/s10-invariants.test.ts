// Rounds — S10 invariant guards (plan §7 S10, §1 #6).
//
// S10 is phrased in the plan as a "grep-able invariant: nothing persists
// IPs, emails (outside users), names, or locations." These tests make that
// literal, because the 2026-07-24 audit found the invariant had been
// silently broken since Phase 2: Better Auth stores the client IP in
// session.ip_address by default, and nothing was watching.
//
// Deliberately source-level rather than behavioural. Booting Better Auth or
// exercising a real sign-in needs env vars, a mail provider and a live DB;
// these run in milliseconds with none of that, and they fail loudly the
// moment someone deletes the config that keeps the promise.
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const SRC = join(process.cwd(), "src");
const sourceFiles = walk(SRC);

describe("S10 — no raw IPs, no PII", () => {
  test("Better Auth IP tracking is explicitly disabled", () => {
    const auth = readFileSync(join(SRC, "lib/auth.ts"), "utf8");
    // Verified against the installed package: getIp() short-circuits to null
    // when this is set (@better-auth/core/dist/utils/ip.mjs), so
    // session.ip_address is written as "" instead of a real address.
    expect(auth).toMatch(/disableIpTracking:\s*true/);
  });

  test("request IP headers are read in exactly one module", () => {
    const readers = sourceFiles.filter((f) =>
      /x-forwarded-for|x-real-ip|cf-connecting-ip/i.test(readFileSync(f, "utf8")),
    );
    expect(readers.map((f) => f.slice(SRC.length + 1)).sort()).toEqual(["lib/client-ip.ts"]);
  });

  test("the IP a request carries is only ever used as a rate-limit key", () => {
    // clientIp() has exactly one legitimate consumer shape: `rateLimit(...)`.
    // Any other use is the thing S10 exists to prevent.
    // Strip block comments, line comments, and import statements. Comments
    // discuss `ip` freely, and the path "@/lib/client-ip" contains it as a
    // whole word (hyphens are word boundaries) — neither is a real use.
    const codeOnly = (s: string) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
        .replace(/^import .*$/gm, "");

    const consumers = sourceFiles.filter(
      (f) => /\bclientIp\s*\(/.test(readFileSync(f, "utf8")) && !f.endsWith("lib/client-ip.ts"),
    );
    expect(consumers.length, "no handler calls clientIp() — did the limiter change?").toBe(3);

    for (const f of consumers) {
      const code = codeOnly(readFileSync(f, "utf8"));
      const rateLimitUses = [...code.matchAll(/rateLimit\(`[a-z]*i:\$\{ip\}`/g)].length;
      expect(rateLimitUses, `${f}: ip is not reaching rateLimit()`).toBe(1);
      // `const ip = clientIp(req)` + that one limiter key = 2 mentions in code.
      // Anything more means the address leaked elsewhere in the handler —
      // into a log line, a response body, an audit row, a DB write.
      const uses = [...code.matchAll(/\bip\b/g)].length;
      expect(uses, `${f}: ip appears ${uses}x in code; expected declaration + limiter key only`).toBe(2);
    }
  });

  test("our own tables declare no ip column", () => {
    const schema = readFileSync(join(SRC, "db/schema.ts"), "utf8");
    expect(schema).not.toMatch(/ip_address|ipAddress/);
  });

  test("audit_log actor is device_hash or email, never an address", () => {
    const audit = readFileSync(join(SRC, "lib/audit.ts"), "utf8");
    expect(audit).not.toMatch(/x-forwarded-for|x-real-ip|clientIp/);
  });
});
