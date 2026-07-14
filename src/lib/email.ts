import { Resend } from "resend";

/* Magic-link email (Phase 2). In production, sends via Resend. Without a
 * RESEND_API_KEY (local dev), it logs the link to the server console so the
 * flow is testable without email set up. No other email is ever sent. */

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.AUTH_EMAIL_FROM ?? "Rounds <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  if (!resend) {
    // Dev fallback — no key configured. Surface the link so login is testable.
    console.log(`\n[rounds] magic link for ${email}:\n${url}\n`);
    return;
  }
  await resend.emails.send({
    from,
    to: email.toLowerCase(),
    subject: "Sign in to Rounds",
    text: `Sign in to Rounds:\n\n${url}\n\nIf you didn't request this, ignore it.`,
  });
}
