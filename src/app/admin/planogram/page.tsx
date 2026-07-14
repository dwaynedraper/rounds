import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { listFixtures } from "@/lib/queries";
import { Icon } from "@/components/icons";
import { StatusChip } from "@/components/ui/Chip";

export default async function PlanogramPage() {
  await requireUser();
  const fixtures = await listFixtures();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Planogram</h1>
        <p className="mt-1 text-sm text-text-muted">
          Pick a fixture to assign products to its positions. This is the master
          layout — it propagates to every store except where a store overrides a slot.
        </p>
      </div>

      {fixtures.length === 0 ? (
        <p className="border border-border bg-surface p-6 text-sm text-text-muted">
          No fixtures yet. Fixtures, sections, and positions come from the seed /
          migrations for now; real planograms get entered here once their layouts
          are known (plan §12).
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
          {fixtures.map((f) => (
            <Link key={f.id} href={`/admin/planogram/${f.id}`} className="flex items-center gap-3 bg-bg p-4 hover:bg-surface">
              <Icon name="slot" size={22} className="text-text-faint" />
              <span className="flex-1">
                <span className="block font-medium">{f.name}</span>
                <span className="tabular text-xs text-text-faint">{f.slug}</span>
              </span>
              <StatusChip tone="neutral">{f.layoutKind}</StatusChip>
              <Icon name="chevron-right" size={18} className="text-text-faint" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
