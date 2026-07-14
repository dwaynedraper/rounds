import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getStoreState } from "@/lib/reads";
import { buildTableViews, visibleSlotCount, type TableView } from "@/lib/view";
import { TableSlab } from "@/components/survey/TableSlab";
import { CopyReport } from "@/components/survey/CopyReport";
import { CreateStore } from "@/components/survey/CreateStore";
import { StatusChip } from "@/components/ui/Chip";
import { Icon } from "@/components/icons";

/* Store overview (v3 mockup screen 2): the three fixed tables — Canon,
 * Nikon, Sony — drawn as slabs. Tap a table to open it. */

function buildReport(number: string, nickname: string | null, tables: TableView[]): string {
  const lines = [`Store ${number}${nickname ? ` (${nickname})` : ""}`, ""];
  let any = false;
  for (const table of tables) {
    for (const side of table.sides) {
      for (const section of side.sections) {
        const n = visibleSlotCount(section);
        for (let i = 0; i < n; i++) {
          const slot = section.slots[i];
          if (!slot.name || slot.flags.length === 0) continue;
          any = true;
          lines.push(
            `${table.name} / ${side.label} #${i + 1} — ${slot.name}: ${slot.flags.join(", ")}${slot.note ? ` — ${slot.note}` : ""}`,
          );
        }
      }
    }
  }
  if (!any) lines.push("No issues found.");
  return lines.join("\n");
}

export default async function StoreOverviewPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  if (!/^\d{4}$/.test(number)) notFound();

  const [catalog, state] = await Promise.all([getCatalog(), getStoreState(number)]);

  if (!state) {
    return (
      <main className="mx-auto w-full max-w-sm px-4 py-16 text-center">
        <p className="text-lg font-semibold">Store {number} isn&apos;t set up yet</p>
        <p className="mb-4 mt-1 text-sm text-text-muted">
          One tap creates it — no admin needed.
        </p>
        <CreateStore number={number} />
        <Link href="/" className="mt-4 inline-block text-sm text-info-text underline">
          Different store
        </Link>
      </main>
    );
  }

  const tables = buildTableViews(catalog, state);
  const report = buildReport(number, state.store.nickname, tables);
  const totalFlags = tables.reduce((sum, t) => sum + t.flagCount, 0);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <Icon name="aperture" size={22} />
          <span className="tabular font-semibold">Store {number}</span>
          {state.store.nickname && (
            <span className="text-sm text-text-muted">· {state.store.nickname}</span>
          )}
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

      <p className="mt-3 text-xs text-text-faint">
        Tap a table. Flagged cameras show red from here.
      </p>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <CopyReport report={report} />
        </div>
      </div>
    </main>
  );
}
