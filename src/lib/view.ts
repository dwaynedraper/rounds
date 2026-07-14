import type { getCatalog, getStoreState } from "@/lib/reads";
import { FLOOR, type SideKey } from "@/lib/floor";

/* Shapes the cached reads into what the survey renders (plan §1 #15e).
 * Pure function — server components call it after getCatalog/getStoreState,
 * so it costs nothing extra against Neon. */

export type SlotView = {
  positionId: number;
  idx: number;
  productId: number | null; // effective assignment (store layout ?? global default)
  name: string | null; // resolved product quickName; null = empty slot
  kind: "camera" | "tablet";
  flags: string[];
  note: string;
  capturedAt: string | null;
};

export type SectionView = {
  key: string;
  label: string;
  capacity: 4 | 5;
  /** ordered by idx, always `capacity` long — empties included */
  slots: SlotView[];
};

export type SideView = { key: SideKey; label: string; sections: SectionView[] };

export type TableView = {
  slug: string;
  brandSlug: "canon" | "nikon" | "sony";
  name: string;
  surface: "wood" | "gray";
  sides: SideView[];
  flagCount: number;
};

type Catalog = Awaited<ReturnType<typeof getCatalog>>;
type StoreState = NonNullable<Awaited<ReturnType<typeof getStoreState>>>;

export function buildTableViews(catalog: Catalog, state: StoreState): TableView[] {
  const conditionByPosition = new Map(state.conditions.map((c) => [c.positionId, c]));

  return FLOOR.map((floorTable) => {
    const fixture = catalog.fixtures.find((f) => f.slug === floorTable.slug);
    let flagCount = 0;

    const sides: SideView[] = floorTable.sides.map((side) => ({
      key: side.key,
      label: side.label,
      sections: side.sections.map((floorSection) => {
        const dbSection = fixture?.sections.find((s) => s.key === floorSection.key);
        const byIdx = new Map((dbSection?.positions ?? []).map((p) => [p.idx, p]));

        const slots: SlotView[] = Array.from({ length: floorSection.capacity }, (_, idx) => {
          const pos = byIdx.get(idx);
          if (!pos) {
            // geometry not seeded yet — render an inert empty slot
            return { positionId: -1, idx, productId: null, name: null, kind: "camera" as const, flags: [], note: "", capturedAt: null };
          }
          const effectiveProductId =
            pos.id in state.overrides ? state.overrides[pos.id] : pos.masterProductId;
          const product = effectiveProductId != null ? catalog.products[effectiveProductId] : null;
          const condition = conditionByPosition.get(pos.id);
          const flags = condition?.flags ?? [];
          if (product && flags.length > 0) flagCount += 1;
          return {
            positionId: pos.id,
            idx,
            productId: product ? effectiveProductId : null,
            name: product?.quickName ?? null,
            kind: product?.kind === "tablet" ? ("tablet" as const) : ("camera" as const),
            flags,
            note: condition?.note ?? "",
            capturedAt: condition?.capturedAt ?? null,
          };
        });

        return { key: floorSection.key, label: floorSection.label, capacity: floorSection.capacity, slots };
      }),
    }));

    return {
      slug: floorTable.slug,
      brandSlug: floorTable.brandSlug,
      name: floorTable.name,
      surface: floorTable.surface,
      sides,
      flagCount,
    };
  });
}

/** Grid rule (plan §1 #15d): a wall section renders 4 slots until the 5th
 *  is assigned, then spreads to 5. Empty slots among the first 4 keep
 *  their spacing. */
export function visibleSlotCount(section: SectionView): number {
  if (section.capacity === 4) return 4;
  return section.slots[4]?.name != null ? 5 : 4;
}

/** Plain-text issue report (plan Phase 3: generate output + copy). Pure —
 *  runs wherever the views were built. */
export function buildReport(number: string, nickname: string | null, tables: TableView[]): string {
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
