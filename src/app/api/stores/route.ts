import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/db";
import { storeEnter } from "@/lib/contracts";
import { rateLimit } from "@/lib/rate-limit";
import { storeTag } from "@/lib/cache-tags";
import { ensureStore } from "@/lib/stores";

const MAX_BODY = 4 * 1024; // S1 — this payload is tiny

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

// POST /api/stores — enter a store, auto-creating it if new (plan §1 #15b).
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

  const parsed = storeEnter.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const body = parsed.data;

  // S2 — creation is cheap to spam; keep the window tight. IP used, never stored (S10).
  const ip = clientIp(req);
  const okDevice = await rateLimit("RL_CONDITIONS", `sd:${body.deviceHash}`, { limit: 10, windowSec: 60 });
  const okIp = await rateLimit("RL_CONDITIONS", `si:${ip}`, { limit: 20, windowSec: 60 });
  if (!okDevice || !okIp) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const result = await ensureStore(db, body.number, body.deviceHash);
  if (result.created) revalidateTag(storeTag(body.number), "max");

  return NextResponse.json({ ok: true, created: result.created, store: { number: result.store.number, nickname: result.store.nickname } });
}
