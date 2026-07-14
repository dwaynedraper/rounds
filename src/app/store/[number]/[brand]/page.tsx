"use client";

import Link from "next/link";
import { StoreShell } from "@/components/survey/StoreShell";
import { useSurveySegments } from "@/lib/client-data";
import { TableSlab } from "@/components/survey/TableSlab";
import { Icon } from "@/components/icons";

/* Single table, zoomed (v3 mockup screens 3/3b) — static client shell. */

export default function TablePage() {
  const seg = useSurveySegments();
  if (!seg) return <LoadingShell />;
  const { number } = seg;
  const brand = seg.brand ?? "";

  return (
    <StoreShell number={number}>
      {(tables) => {
        const table = tables.find((t) => t.brandSlug === brand);
        if (!table) {
          return (
            <main className="mx-auto w-full max-w-sm px-4 py-16 text-center">
              <p className="text-lg font-semibold">No such table</p>
              <Link href={`/store/${number}`} className="mt-4 inline-block text-sm text-info-text underline">
                Back to store {number}
              </Link>
            </main>
          );
        }
        return (
          <main className="mx-auto w-full max-w-2xl px-4 pb-10">
            <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
              <Link href={`/store/${number}`} aria-label="back to store overview">
                <Icon name="chevron-right" size={22} className="rotate-180" />
              </Link>
              <span className="text-lg font-bold">{table.name}</span>
              <span className="text-sm text-text-muted">
                {table.surface === "wood" ? "oak island" : "grey marble"}
              </span>
              <span className="ml-auto text-sm text-text-muted">{table.sides.length} sides</span>
            </header>

            <TableSlab
              table={table}
              height={230}
              camSize={26}
              zones={table.sides.map((side) => ({
                side: side.key,
                href: `/store/${number}/${brand}/${side.key}`,
                label: side.label,
              }))}
            />

            <p className="mt-3 text-xs text-text-faint">
              Tap a side to walk it. Sides are named as you face the table from the end cap; positions
              run left → right.
            </p>
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
