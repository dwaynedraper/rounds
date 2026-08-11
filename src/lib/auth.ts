import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { user, session, account, verification } from "@/db/auth-schema";
import { sendMagicLinkEmail } from "@/lib/email";

/* Rounds — CMS authentication (Phase 2). Better Auth, magic link only.
 * The public survey is loginless; only ~5 people (admin + brand editors)
 * ever sign in here.
 *
 * S3 (allowlist): magicLink `disableSignUp: true` means a magic link for an
 * email that isn't already a user row is rejected outright — nobody can
 * self-register. Admins are seeded / invited explicitly.
 *
 * `role` lives on the user row (additionalFields). Brand scoping (S4) lives
 * in our separate user_brands table and is enforced in the data layer, not
 * here — Better Auth answers "who is this", not "what may they touch". */

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "editor", input: false },
    },
  },
  session: {
    // Avoid a DB read on every request: cache the session in a short-lived
    // signed cookie. Keeps the "no per-request session lookup" intent.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    ipAddress: {
      // S10 / §1 #6 — "No raw IPs stored, anywhere, ever."
      //
      // Better Auth writes the client IP into session.ip_address by DEFAULT.
      // Without this flag the CMS quietly persists an IP per sign-in, which
      // is exactly the invariant the plan says must never be broken. It went
      // unnoticed from Phase 2 until the 2026-07-24 audit.
      //
      // Verified against the INSTALLED package, not memory:
      //   @better-auth/core/dist/utils/ip.mjs:202
      //     `if (options.advanced?.ipAddress?.disableIpTracking) return null`
      //   better-auth/dist/db/internal-adapter.mjs:191
      //     `ipAddress: headers ? getIp(headers, options) || "" : ""`
      // So with this set, getIp() short-circuits to null and the column is
      // written as the empty string. No IP ever reaches Postgres.
      //
      // The column itself is kept (dropping it would mean a migration and a
      // hand-modeled divergence from Better Auth's expected schema) — it is
      // simply always empty. See docs/WORKLOG.md 2026-07-24.
      disableIpTracking: true,
    },
  },
  plugins: [
    magicLink({
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
    nextCookies(), // must be last — lets server actions set auth cookies
  ],
});
