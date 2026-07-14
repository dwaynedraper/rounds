"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getDeviceHash } from "@/lib/device";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { StatusChip, type BrandKey } from "@/components/ui/Chip";
import { FlagToggle } from "@/components/ui/FlagToggle";
import { Sheet } from "@/components/ui/Sheet";
import { TablePlan, type PlanSection } from "@/components/ui/TablePlan";

type Slot = { positionId: number; idx: number; product: { quickName: string; brand: BrandKey } | null };
export type SurveyFixture = {
  id: number;
  name: string;
  sections: { id: number; label: string; slots: Slot[] }[];
};
type Condition = { flags: string[]; note: string; capturedAt: string };

export function SurveyClient({
  storeNumber,
  storeNickname,
  fixtures,
  flagVocab,
  initialConditions,
}: {
  storeNumber: string;
  storeNickname: string | null;
  fixtures: SurveyFixture[];
  flagVocab: { key: string; label: string }[];
  initialConditions: Record<number, Condition>;
}) {
  const [conds, setConds] = useState<Record<number, Condition>>(initialConditions);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ flags: string[]; note: string }>({ flags: [], note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const labelOf = useMemo(() => {
    const m = new Map(flagVocab.map((f) => [f.key, f.label]));
    return (k: string) => m.get(k) ?? k;
  }, [flagVocab]);

  // position -> slot lookup (product, section, fixture) for the sheet + report
  const slotIndex = useMemo(() => {
    const m = new Map<number, { slot: Slot; section: string; fixture: string }>();
    for (const f of fixtures)
      for (const s of f.sections)
        for (const slot of s.slots) m.set(slot.positionId, { slot, section: s.label, fixture: f.name });
    return m;
  }, [fixtures]);

  const issueCount = Object.values(conds).filter((c) => c.flags.length > 0).length;

  function openSlot(positionId: number) {
    const c = conds[positionId];
    setDraft({ flags: c ? [...c.flags] : [], note: c?.note ?? "" });
    setError(null);
    setSelected(positionId);
  }

  function toggleFlag(key: string, on: boolean) {
    setDraft((d) => ({
      ...d,
      flags: on ? [...new Set([...d.flags, key])] : d.flags.filter((f) => f !== key),
    }));
  }

  async function save() {
    if (selected == null) return;
    setSaving(true);
    setError(null);
    const payload = {
      storeNumber,
      positionId: selected,
      flags: draft.flags,
      note: draft.note,
      capturedAt: new Date().toISOString(),
      deviceHash: getDeviceHash(),
      shift: "",
    };
    try {
      const res = await fetch("/api/conditions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const { saved } = await res.json();
        setConds((c) => ({ ...c, [selected]: { flags: saved.flags, note: saved.note, capturedAt: saved.capturedAt } }));
        setSelected(null);
      } else if (res.status === 409) {
        // someone recorded something newer — take theirs and refresh the view
        const { current } = await res.json();
        setConds((c) => ({ ...c, [selected]: { flags: current.flags, note: current.note, capturedAt: current.capturedAt } }));
        setSelected(null);
      } else {
        const { error } = await res.json().catch(() => ({ error: "save failed" }));
        setError(error ?? "save failed");
      }
    } catch {
      setError("network error — try again");
    } finally {
      setSaving(false);
    }
  }

  function buildReport(): string {
    const lines = [
      `Store ${storeNumber}${storeNickname ? ` (${storeNickname})` : ""} — ${new Date().toLocaleDateString()}`,
      "",
    ];
    let any = false;
    for (const f of fixtures)
      for (const s of f.sections)
        for (const slot of s.slots) {
          const c = conds[slot.positionId];
          if (!c || c.flags.length === 0) continue;
          any = true;
          const name = slot.product?.quickName ?? "empty slot";
          lines.push(
            `${f.name} / ${s.label} #${String(slot.idx + 1).padStart(2, "0")} — ${name}: ${c.flags.map(labelOf).join(", ")}${c.note ? ` — ${c.note}` : ""}`,
          );
        }
    if (!any) lines.push("No issues found.");
    return lines.join("\n");
  }

  async function copyReport() {
    await navigator.clipboard.writeText(buildReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const sel = selected != null ? slotIndex.get(selected) : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <Icon name="aperture" size={22} />
          <span className="tabular font-semibold">Store {storeNumber}</span>
          {storeNickname && <span className="text-sm text-text-muted">· {storeNickname}</span>}
        </Link>
        <StatusChip tone={issueCount > 0 ? "danger" : "success"}>
          {issueCount > 0 ? `${issueCount} issues` : "all clear"}
        </StatusChip>
      </header>

      <div className="flex flex-col gap-8">
        {fixtures.map((f) => {
          const sections: PlanSection[] = f.sections.map((s) => ({
            key: String(s.id),
            label: s.label,
            slots: s.slots.map((slot) => {
              const c = conds[slot.positionId];
              return {
                id: slot.positionId,
                idx: slot.idx,
                product: slot.product,
                flags: (c?.flags ?? []).map((k) => ({ tone: "danger" as const, label: labelOf(k) })),
              };
            }),
          }));
          return (
            <section key={f.id}>
              <h2 className="mb-2 text-lg font-semibold">{f.name}</h2>
              <TablePlan sections={sections} onSelectSlot={(slot) => openSlot(slot.id)} />
            </section>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button block variant="secondary" icon={copied ? "check" : "edit"} onClick={copyReport}>
            {copied ? "Copied" : "Copy report"}
          </Button>
        </div>
      </div>

      <Sheet
        open={selected != null}
        onClose={() => setSelected(null)}
        title={sel?.slot.product?.quickName ?? "Empty slot"}
        footer={
          <div className="flex flex-col gap-2">
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" block onClick={() => setSelected(null)}>Cancel</Button>
              <Button block icon="check" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {sel && (
            <p className="text-xs text-text-faint">
              {sel.fixture} · {sel.section}
            </p>
          )}
          <div>
            <p className="mb-2 text-sm font-medium">What&apos;s wrong?</p>
            <div className="flex flex-wrap gap-2">
              {flagVocab.map((f) => (
                <FlagToggle
                  key={f.key}
                  label={f.label}
                  tone="danger"
                  pressed={draft.flags.includes(f.key)}
                  onToggle={(on) => toggleFlag(f.key, on)}
                />
              ))}
            </div>
          </div>
          <Field
            label="Note"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value.slice(0, 280) }))}
            placeholder="Optional detail…"
            hint={`${draft.note.length}/280`}
          />
        </div>
      </Sheet>
    </main>
  );
}
