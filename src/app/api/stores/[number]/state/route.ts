import { NextResponse } from "next/server";
import { getStoreState } from "@/lib/reads";

/* GET /api/stores/[number]/state (plan §5) — this store's layout
 * assignments + all living conditions in one document. Backed by the
 * `use cache` read (tag: store:<n>); writes revalidate that tag. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  if (!/^\d{4}$/.test(number)) {
    return NextResponse.json({ error: "invalid store number" }, { status: 400 });
  }
  const state = await getStoreState(number);
  if (!state) {
    return NextResponse.json({ error: "unknown store" }, { status: 404 });
  }
  return NextResponse.json(state);
}
