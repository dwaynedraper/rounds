import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/db";
import { conditionWrite } from "@/lib/contracts";
import { rateLimit } from "@/lib/rate-limit";
import { storeTag } from "@/lib/cache-tags";
import { applyConditionWrite } from "@/lib/conditions";

const MAX_BODY = 32 * 1024; // S1 body cap

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

export async function POST(req: Request) {
  // S1 — body size cap
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

  // S1 — shape/caps (Zod: flags<=8, note<=280, formats)
  const parsed = conditionWrite.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const body = parsed.data;

  // S2 — rate limit by device AND by ip (ip used, never stored — S10)
  const ip = clientIp(req);
  const okDevice = await rateLimit("RL_CONDITIONS", `d:${body.deviceHash}`, { limit: 30, windowSec: 60 });
  const okIp = await rateLimit("RL_CONDITIONS", `i:${ip}`, { limit: 60, windowSec: 60 });
  if (!okDevice || !okIp) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  // S1 (DB truths) + S6 (LWW) + S5 (audit) + upsert
  const result = await applyConditionWrite(db, body);

  switch (result.status) {
    case "unknown-store":
      return NextResponse.json({ error: "unknown store" }, { status: 404 });
    case "unknown-position":
      return NextResponse.json({ error: "unknown position" }, { status: 404 });
    case "unknown-flag":
      return NextResponse.json({ error: `unknown flag "${result.flag}"` }, { status: 400 });
    case "stale":
      // 409 + current row — the client treats this as success-with-refresh.
      return NextResponse.json({ stale: true, current: result.current }, { status: 409 });
    case "ok":
      revalidateTag(storeTag(body.storeNumber), "max");
      return NextResponse.json({ ok: true, saved: result.saved });
  }
}
