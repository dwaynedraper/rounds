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
