import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { listFixtures, getFixtureLayout, listProducts } from "@/lib/queries";
import { PositionAssign } from "@/components/admin/PositionAssign";
import { Icon } from "@/components/icons";

export default async function FixtureEditorPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  await requireUser();
  const { fixtureId: idStr } = await params;
  const fixtureId = Number(idStr);
  if (!Number.isInteger(fixtureId)) notFound();

  const fixtures = await listFixtures();
  const fixture = fixtures.find((f) => f.id === fixtureId);
  if (!fixture) notFound();

  const [{ sections, positions }, products] = await Promise.all([
    getFixtureLayout(fixtureId),
    listProducts(),
  ]);

  const productOptions = products.map((p) => ({
    id: p.id,
    label: `${p.brandName} · ${p.quickName}`,
    brandSlug: p.brandSlug,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/planogram" className="mb-1 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text">
          <Icon name="chevron-right" size={16} className="rotate-180" /> All fixtures
        </Link>
        <h1 className="text-2xl font-semibold">{fixture.name}</h1>
        <p className="tabular text-xs text-text-faint">{fixture.slug}</p>
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-text-muted">This fixture has no sections yet.</p>
      ) : (
        sections.map((section) => {
          const secPositions = positions.filter((p) => p.sectionId === section.id);
          return (
            <section key={section.id} className="border border-border">
              <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
                <Icon name="grid" size={16} className="text-text-faint" />
                <h2 className="text-2xs font-semibold uppercase tracking-wide text-text-muted">
                  {section.label}
                </h2>
              </header>
              {secPositions.length === 0 ? (
                <p className="px-3 py-3 text-sm text-text-faint">No positions in this section.</p>
              ) : (
                secPositions.map((pos) => (
                  <PositionAssign
                    key={pos.id}
                    positionId={pos.id}
                    idx={pos.idx}
                    currentProductId={pos.productId}
                    products={productOptions}
                  />
                ))
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
