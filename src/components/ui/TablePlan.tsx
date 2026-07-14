import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";
import { BrandChip, StatusChip, type BrandKey } from "@/components/ui/Chip";

export type SlotFlag = {
  tone: "danger" | "warn" | "info";
  label: string;
};

export type PlanSlot = {
  id: number;
  idx: number;
  /** null = a slot that is supposed to be empty (planned-empty) */
  product: { quickName: string; brand: BrandKey } | null;
  flags?: SlotFlag[];
};

export type PlanSection = {
  key: string;
  label: string;
  slots: PlanSlot[];
};

export interface TablePlanProps {
  sections: PlanSection[];
  onSelectSlot?: (slot: PlanSlot) => void;
  className?: string;
}

/** The signature survey surface: a fixture's sections and position slots.
 *  A flagged slot gets a colored left edge + status chips so a problem is
 *  visible while scanning a whole table at arm's length. */
export function TablePlan({ sections, onSelectSlot, className }: TablePlanProps) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {sections.map((section) => (
        <section key={section.key}>
          <div className="mb-2 flex items-center gap-2">
            <Icon name="grid" size={16} className="text-text-faint" />
            <h3 className="text-2xs font-semibold uppercase tracking-wide text-text-muted">
              {section.label}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
            {section.slots.map((slot) => {
              const flagged = (slot.flags?.length ?? 0) > 0;
              const empty = slot.product === null;
              const edge = flagged
                ? slot.flags![0].tone === "danger"
                  ? "before:bg-danger"
                  : slot.flags![0].tone === "warn"
                    ? "before:bg-warn"
                    : "before:bg-info"
                : "before:bg-transparent";
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSelectSlot?.(slot)}
                  className={cn(
                    "relative flex min-h-16 items-center gap-3 bg-bg px-3 py-2.5 text-left",
                    "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:content-['']",
                    edge,
                    "hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                  )}
                >
                  <span className="tabular w-6 shrink-0 text-sm text-text-faint">
                    {String(slot.idx + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    {empty ? (
                      <span className="text-sm italic text-text-faint">
                        empty slot
                      </span>
                    ) : (
                      <span className="flex flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <BrandChip brand={slot.product!.brand} />
                          <span className="truncate text-base font-medium text-text">
                            {slot.product!.quickName}
                          </span>
                        </span>
                        {flagged && (
                          <span className="flex flex-wrap gap-1">
                            {slot.flags!.map((f, i) => (
                              <StatusChip key={i} tone={f.tone}>
                                {f.label}
                              </StatusChip>
                            ))}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <Icon
                    name="chevron-right"
                    size={18}
                    className="shrink-0 text-text-faint"
                  />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
