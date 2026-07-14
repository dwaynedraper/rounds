import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getStoreState } from "@/lib/reads";
import { buildTableViews } from "@/lib/view";
import { TableSlab } from "@/components/survey/TableSlab";
import { Icon } from "@/components/icons";

/* Single table, zoomed (v3 mockup screens 3/3b). Tap a side to open the
 * side view. The drawing is the same config→grid renderer as the overview,
 * just bigger. */

export default async function TablePage({
  params,
}: {
  params: Promise<{ number: string; brand: string }>;
}) {
  const { number, brand } = await params;
  if (!/^\d{4}$/.test(number)) notFound();
  if (!["canon", "nikon", "sony"].includes(brand)) notFound();

  const [catalog, state] = await Promise.all([getCatalog(), getStoreState(number)]);
  if (!state) notFound();

  const table = buildTableViews(catalog, state).find((t) => t.brandSlug === brand);
  if (!table) notFound();

  const zones = table.sides.map((side) => ({
    side: side.key,
    href: `/store/${number}/${brand}/${side.key}`,
    label: side.label,
  }));

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

      <TableSlab table={table} height={230} camSize={26} zones={zones} />

      <p className="mt-3 text-xs text-text-faint">
        Tap a side to walk it. Sides are named as you face the table from the
        end cap; positions run left → right.
      </p>
    </main>
  );
}
