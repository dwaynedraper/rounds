"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { getCatalog, getStoreState } from "@/lib/reads";

/* Client data layer for the survey (plan §6: local-cache-first).
 *
 * WHY the survey fetches from the client instead of server-rendering the
 * data: the Cloudflare adapter corrupts Next's PPR resume stream on
 * dynamic-param pages (WORKLOG 2026-07-14 — inline flight scripts get
 * interleaved mid-chunk, leaking payload as visible text). Static pages and
 * single-phase JSON responses are unaffected, so the survey pages are
 * static client shells and ALL per-store data arrives through the §5 GET
 * endpoints, which sit on the same tagged `use cache` reads as before —
 * the Neon budget rule (§3) is unchanged.
 *
 * Phase 5 replaces the module-level catalog memo with the IndexedDB cache
 * + write queue; the fetch surface stays identical.
 *
 * Type-only imports from reads.ts: erased at compile time, so no server
 * code reaches the client bundle. */

export type CatalogPayload = Awaited<ReturnType<typeof getCatalog>>;
export type StoreStatePayload = NonNullable<Awaited<ReturnType<typeof getStoreState>>>;

let catalogMemo: Promise<CatalogPayload> | null = null;

function fetchCatalog(): Promise<CatalogPayload> {
  if (!catalogMemo) {
    catalogMemo = fetch("/api/catalog").then((res) => {
      if (!res.ok) {
        catalogMemo = null; // don't memoize failures
        throw new Error(`catalog fetch failed (${res.status})`);
      }
      return res.json() as Promise<CatalogPayload>;
    });
    catalogMemo.catch(() => {
      catalogMemo = null;
    });
  }
  return catalogMemo;
}

export type StoreData =
  | { status: "loading" }
  | { status: "missing" } // valid number, store not created yet
  | { status: "error"; message: string }
  | { status: "ready"; catalog: CatalogPayload; state: StoreStatePayload };

export function useStoreData(number: string | null): { data: StoreData; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  // Result is keyed by (number, attempt); a stale or absent key derives to
  // "loading" — no synchronous setState inside the effect.
  const [result, setResult] = useState<{ key: string; value: StoreData } | null>(null);
  const key = `${number}:${attempt}`;
  const valid = number != null && /^\d{4}$/.test(number);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    void (async () => {
      let value: StoreData;
      try {
        const [catalog, stateRes] = await Promise.all([
          fetchCatalog(),
          fetch(`/api/stores/${number}/state`, { cache: "no-store" }),
        ]);
        if (stateRes.status === 404) {
          value = { status: "missing" };
        } else if (!stateRes.ok) {
          value = { status: "error", message: `could not load store (${stateRes.status})` };
        } else {
          const state = (await stateRes.json()) as StoreStatePayload;
          value = { status: "ready", catalog, state };
        }
      } catch {
        value = { status: "error", message: "network error — check your connection" };
      }
      if (!cancelled) setResult({ key, value });
    })();
    return () => {
      cancelled = true;
    };
  }, [key, number, valid]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);

  const data: StoreData = !valid
    ? { status: "error", message: "invalid store number" }
    : result?.key === key
      ? result.value
      : { status: "loading" };

  return { data, reload };
}

/* Parse /store/<number>[/<brand>[/<side>]] from the real browser URL, after
 * mount only. The pages deliberately DON'T read Next's `params` — reading
 * params during SSR makes the route per-request dynamic, which re-opens the
 * PPR resume stream this whole layer exists to avoid. Until mount returns
 * null → pages render the static loading shell. */
const subscribeNoop = () => () => {};

export function useSurveySegments(): { number: string; brand: string | null; side: string | null } | null {
  const pathname = useSyncExternalStore(
    subscribeNoop,
    () => window.location.pathname,
    () => null, // server/first paint: no URL yet → static loading shell
  );
  if (pathname == null) return null;
  const parts = pathname.split("/").filter(Boolean); // ["store", number, brand?, side?]
  return { number: parts[1] ?? "", brand: parts[2] ?? null, side: parts[3] ?? null };
}
