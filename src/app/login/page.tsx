"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/icons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    // disableSignUp means unknown emails are rejected at verify time. We
    // always show the same "check your email" state so we never reveal
    // which addresses are registered.
    await authClient.signIn.magicLink({ email, callbackURL: "/admin" });
    setBusy(false);
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-4 py-16">
      <div className="mb-6 flex items-center gap-2">
        <Icon name="aperture" size={28} />
        <h1 className="text-2xl font-semibold">Rounds CMS</h1>
      </div>

      {sent ? (
        <div className="border border-border-strong bg-surface p-4">
          <p className="text-base font-medium">Check your email</p>
          <p className="mt-1 text-sm text-text-muted">
            If {email} is an authorized account, a sign-in link is on its way.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            label="Work email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            hint="Sign-in is invite-only — only authorized editors can log in."
          />
          <Button type="submit" block disabled={busy} icon="check">
            {busy ? "Sending…" : "Send magic link"}
          </Button>
        </form>
      )}
    </main>
  );
}
