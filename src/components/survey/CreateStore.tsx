"use client";

import { useState } from "react";
import { getDeviceHash } from "@/lib/device";
import { Button } from "@/components/ui/Button";

/** Deep-link path into a store that doesn't exist yet (the keypad normally
 *  creates it before navigation). Deliberate tap, not auto-on-mount, so
 *  crawlers hitting GET /store/1234 never trigger writes. */
export function CreateStore({ number, onCreated }: { number: string; onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number, deviceHash: getDeviceHash() }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "could not set up store" }));
        setError(error ?? "could not set up store");
        return;
      }
      onCreated();
    } catch {
      setError("network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button block disabled={busy} onClick={create}>
        {busy ? "Setting up…" : `Set up store ${number}`}
      </Button>
      {error && <p className="text-sm text-danger-text">{error}</p>}
    </div>
  );
}
