"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDeviceHash } from "@/lib/device";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";

/* Store entry — Dean-approved keypad (v3 mockup screen 1). A number pad
 * instead of a text field so the OS keyboard never covers the screen.
 * Entering a new number auto-creates the store (plan §1 #15b) — no admin. */

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "go"] as const;

export default function Home() {
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const valid = /^\d{4}$/.test(number);

  function press(key: (typeof KEYS)[number]) {
    setError(null);
    if (key === "back") setNumber((n) => n.slice(0, -1));
    else if (key === "go") void enter();
    else setNumber((n) => (n + key).slice(0, 4));
  }

  async function enter() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number, deviceHash: getDeviceHash() }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "could not enter store" }));
        setError(error ?? "could not enter store");
        return;
      }
      router.push(`/store/${number}`);
    } catch {
      setError("network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-4 flex items-center gap-2">
        <Icon name="aperture" size={30} />
        <h1 className="text-2xl font-semibold">Rounds</h1>
      </div>

      <p className="mb-1 text-center text-sm font-medium text-text-muted">Store number</p>
      <div
        className="tabular mb-2 border-2 border-border-strong px-4 py-3 text-center text-4xl font-extrabold tracking-[.08em]"
        aria-live="polite"
      >
        {number.padEnd(4, "·")}
      </div>
      <p className="mb-4 min-h-5 text-center text-xs font-semibold text-success-text">
        {valid ? "New store? We'll set it up on enter." : " "}
      </p>

      <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="number pad">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            disabled={key === "go" ? !valid || busy : busy}
            className="border border-border bg-surface py-4 text-xl font-semibold hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40"
            aria-label={key === "back" ? "delete digit" : key === "go" ? "enter store" : key}
          >
            {key === "back" ? "⌫" : key === "go" ? "↵" : key}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-center text-sm text-danger-text">{error}</p>}

      <div className="mt-4">
        <Button block disabled={!valid || busy} onClick={enter} iconRight="chevron-right">
          {busy ? "Entering…" : valid ? `Enter store ${number}` : "Enter store"}
        </Button>
      </div>
    </main>
  );
}
