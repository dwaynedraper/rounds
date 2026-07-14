"use client";

/* A per-browser device hash: a spoofable label used for rate limiting, audit
 * attribution, and condition dedup — never an identity, never grants
 * authority (plan §6). Random, not derived from anything, so not personal
 * data (S10). Stored in localStorage for Phase 3; Phase 5 moves the whole
 * survey cache/queue to IndexedDB. */

const KEY = "rounds:device";

export function getDeviceHash(): string {
  let v = localStorage.getItem(KEY);
  if (!v || !/^[0-9a-f]{16,64}$/.test(v)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    v = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(KEY, v);
  }
  return v;
}
