import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/db";
import { layoutWrite } from "@/lib/contracts";
import { rateLimit } from "@/lib/rate-limit";
import { storeTag } from "@/lib/cache-tags";
import { applyLayoutWrite } from "@/lib/layout";

const MAX_BODY = 32 * 1024; // S1 body cap

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

// POST /api/layout — a rep assigns master-list products to their store's
// fixed slots (plan §1 #15c, contract B3).
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = layoutWrite.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const body = parsed.data;

  // S2 — rate limit by device AND by ip (ip used, never stored — S10)
  const ip = clientIp(req);
  const okDevice = await rateLimit("RL_CONDITIONS", `ld:${body.deviceHash}`, { limit: 20, windowSec: 60 });
  const okIp = await rateLimit("RL_CONDITIONS", `li:${ip}`, { limit: 40, windowSec: 60 });
  if (!okDevice || !okIp) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const result = await applyLayoutWrite(db, body);

  switch (result.status) {
    case "unknown-store":
      return NextResponse.json({ error: "unknown store" }, { status: 404 });
    case "unknown-position":
      return NextResponse.json({ error: `unknown position ${result.positionId}` }, { status: 404 });
    case "unknown-product":
      return NextResponse.json({ error: `unknown or inactive product ${result.productId}` }, { status: 400 });
    case "ok":
      revalidateTag(storeTag(body.storeNumber), "max");
      return NextResponse.json({ ok: true, applied: result.applied });
  }
}
