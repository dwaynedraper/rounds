"use client";

import Link from "next/link";
import { StoreShell } from "@/components/survey/StoreShell";
import { useSurveySegments } from "@/lib/client-data";
import { TableSlab } from "@/components/survey/TableSlab";
import { CopyReport } from "@/components/survey/CopyReport";
import { buildReport } from "@/lib/view";
import { StatusChip } from "@/components/ui/Chip";
import { Icon } from "@/components/icons";

/* Store overview (v3 mockup screen 2) — a STATIC client shell; data arrives
 * via the §5 GET endpoints (see client-data.ts for why). */

export default function StoreOverviewPage() {
  const seg = useSurveySegments();
  if (!seg) return <LoadingShell />;
  const number = seg.number;

  return (
    <StoreShell number={number}>
      {(tables, nickname) => {
        const totalFlags = tables.reduce((sum, t) => sum + t.flagCount, 0);
        return (
          <main className="mx-auto w-full max-w-2xl px-4 pb-24">
            <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
              <Link href="/" className="flex items-center gap-2">
                <Icon name="aperture" size={22} />
                <span className="tabular font-semibold">Store {number}</span>
                {nickname && <span className="text-sm text-text-muted">· {nickname}</span>}
              </Link>
              <StatusChip tone={totalFlags > 0 ? "danger" : "success"}>
                {totalFlags > 0 ? `${totalFlags} flags` : "all clear"}
              </StatusChip>
            </header>

            <div className="flex flex-col gap-5">
              {tables.map((table) => (
                <Link
                  key={table.slug}
                  href={`/store/${number}/${table.brandSlug}`}
                  className="group relative block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <TableSlab table={table} height={104} camSize={15} />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 border border-border-strong bg-bg/85 px-2.5 py-0.5 text-base font-extrabold">
                    {table.name}
                  </span>
                  <span
                    className={`absolute right-[9%] top-1.5 px-2 py-0.5 text-[11px] font-bold ${
                      table.flagCount > 0 ? "bg-danger text-danger-ink" : "bg-success text-success-ink"
                    }`}
                  >
                    {table.flagCount > 0 ? `${table.flagCount} flags` : "clear"}
                  </span>
                </Link>
              ))}
            </div>

            <p className="mt-3 text-xs text-text-faint">Tap a table. Flagged cameras show red from here.</p>

            <div className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
              <div className="mx-auto max-w-2xl">
                <CopyReport report={buildReport(number, nickname, tables)} />
              </div>
            </div>
          </main>
        );
      }}
    </StoreShell>
  );
}


function LoadingShell() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16 text-center">
      <p className="text-sm font-semibold text-text-muted" role="status">Loading…</p>
    </main>
  );
}
