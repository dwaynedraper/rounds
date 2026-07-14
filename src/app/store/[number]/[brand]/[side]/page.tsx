"use client";

import Link from "next/link";
import { StoreShell } from "@/components/survey/StoreShell";
import { useSurveySegments } from "@/lib/client-data";
import { SideClient, type MasterProduct } from "@/components/survey/SideClient";

/* Side view route — static client shell; SideClient owns the record/edit
 * interactions once the data is loaded. */

export default function SidePage() {
  const seg = useSurveySegments();
  if (!seg) return <LoadingShell />;
  const { number } = seg;
  const brand = seg.brand ?? "";
  const sideKey = seg.side ?? "";

  return (
    <StoreShell number={number}>
      {(tables, _nickname, catalog) => {
        const table = tables.find((t) => t.brandSlug === brand);
        const side = table?.sides.find((s) => s.key === sideKey);
        if (!table || !side) {
          return (
            <main className="mx-auto w-full max-w-sm px-4 py-16 text-center">
              <p className="text-lg font-semibold">No such side</p>
              <Link href={`/store/${number}`} className="mt-4 inline-block text-sm text-info-text underline">
                Back to store {number}
              </Link>
            </main>
          );
        }

        // Master list for the picker: this table's brand, active only.
        const products: MasterProduct[] = Object.values(catalog.products)
          .filter((p) => p.brandSlug === brand && p.active)
          .map((p) => ({ id: p.id, quickName: p.quickName, kind: p.kind }))
          .sort((a, b) => a.quickName.localeCompare(b.quickName));

        return (
          <SideClient
            storeNumber={number}
            brandSlug={brand}
            tableName={table.name}
            side={side}
            flagVocab={catalog.flags}
            products={products}
          />
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
