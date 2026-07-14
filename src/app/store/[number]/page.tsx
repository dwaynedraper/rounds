import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getStoreState } from "@/lib/reads";
import { SurveyClient, type SurveyFixture } from "@/components/survey/SurveyClient";
import type { BrandKey } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";

const BRANDS = new Set<string>(["sony", "canon", "nikon"]);
const asBrand = (slug: string): BrandKey => (BRANDS.has(slug) ? (slug as BrandKey) : "sony");

export default async function StoreSurveyPage({
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
        <p className="text-lg font-semibold">Store {number} not found</p>
        <p className="mt-1 text-sm text-text-muted">
          Check the number, or ask an admin to add this store.
        </p>
        <Link href="/" className="mt-4 inline-block">
          <Button variant="secondary">Back</Button>
        </Link>
      </main>
    );
  }

  // Resolve each position to its effective product (store override wins over
  // the master planogram) and shape the fixtures for the client.
  const fixtures: SurveyFixture[] = catalog.fixtures.map((f) => ({
    id: f.id,
    name: f.name,
    sections: f.sections.map((s) => ({
      id: s.id,
      label: s.label,
      slots: s.positions.map((pos) => {
        const effId =
          pos.id in state.overrides ? state.overrides[pos.id] : pos.masterProductId;
        const product = effId != null ? catalog.products[effId] : null;
        return {
          positionId: pos.id,
          idx: pos.idx,
          product: product
            ? { quickName: product.quickName, brand: asBrand(product.brandSlug) }
            : null,
        };
      }),
    })),
  }));

  const initialConditions: Record<number, { flags: string[]; note: string; capturedAt: string }> = {};
  for (const c of state.conditions) {
    initialConditions[c.positionId] = { flags: c.flags, note: c.note, capturedAt: c.capturedAt };
  }

  return (
    <SurveyClient
      storeNumber={number}
      storeNickname={state.store.nickname}
      fixtures={fixtures}
      flagVocab={catalog.flags}
      initialConditions={initialConditions}
    />
  );
}
