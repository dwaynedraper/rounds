import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getCatalog } from "@/lib/reads";

/* GET /api/catalog (plan §5) — the full catalog + fixed-floor geometry +
 * flag vocabulary in one document. Backed by the `use cache` read
 * (tag: catalog), so the DB is only touched on a cache miss. One fetch per
 * screen, never one per section.
 *
 * The survey pages consume this from the CLIENT (plan §6 local-cache-first):
 * a plain single-phase JSON response avoids the PPR resume-stream path
 * entirely — see WORKLOG 2026-07-14 (stream-corruption incident). */
export async function GET() {
  // Defer to request time — without this, the build statically prerenders
  // this handler and executes getCatalog against a DB that isn't there.
  await connection();
  const catalog = await getCatalog();
  return NextResponse.json(catalog);
}
