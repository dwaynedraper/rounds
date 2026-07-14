import { notFound } from "next/navigation";
import { getCatalog, getStoreState } from "@/lib/reads";
import { buildTableViews } from "@/lib/view";
import { SideClient, type MasterProduct } from "@/components/survey/SideClient";

/* Side view route. All data comes from the two cached reads (plan §3);
 * SideClient owns the record/edit interactions. */

export default async function SidePage({
  params,
}: {
  params: Promise<{ number: string; brand: string; side: string }>;
}) {
  const { number, brand, side: sideKey } = await params;
  if (!/^\d{4}$/.test(number)) notFound();
  if (!["canon", "nikon", "sony"].includes(brand)) notFound();
  if (!["left", "right", "end"].includes(sideKey)) notFound();

  const [catalog, state] = await Promise.all([getCatalog(), getStoreState(number)]);
  if (!state) notFound();

  const table = buildTableViews(catalog, state).find((t) => t.brandSlug === brand);
  const side = table?.sides.find((s) => s.key === sideKey);
  if (!table || !side) notFound();

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
}
