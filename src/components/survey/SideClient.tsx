"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getDeviceHash } from "@/lib/device";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { SideView } from "@/lib/view";

/* Side view (v3 mockup screens 4/5) — Dean's v1 format: positions run
 * left → right viewed from the end cap; each column is a camera name with
 * the four flag buttons under it and an inline note. The Record ⇄ Edit
 * toggle swaps this same screen into layout editing (master-list picker);
 * edit mode recolors the header so the mode is unmissable. */

type Condition = { flags: string[]; note: string; capturedAt: string | null };
type Assignment = { productId: number; name: string; kind: "camera" | "tablet" } | null;

export type MasterProduct = { id: number; quickName: string; kind: string };

export function SideClient({
  storeNumber,
  brandSlug,
  tableName,
  side,
  flagVocab,
  products,
}: {
  storeNumber: string;
  brandSlug: string;
  tableName: string;
  side: SideView;
  flagVocab: { key: string; label: string }[];
  products: MasterProduct[];
}) {
  const [mode, setMode] = useState<"record" | "edit">("record");
  const [conds, setConds] = useState<Record<number, Condition>>(() => {
    const initial: Record<number, Condition> = {};
    for (const section of side.sections)
      for (const slot of section.slots)
        if (slot.positionId > 0)
          initial[slot.positionId] = { flags: slot.flags, note: slot.note, capturedAt: slot.capturedAt };
    return initial;
  });
  const [assigned, setAssigned] = useState<Record<number, Assignment>>(() => {
    const initial: Record<number, Assignment> = {};
    for (const section of side.sections)
      for (const slot of section.slots)
        if (slot.positionId > 0)
          initial[slot.positionId] =
            slot.productId != null && slot.name != null
              ? { productId: slot.productId, name: slot.name, kind: slot.kind }
              : null;
    return initial;
  });
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  async function saveCondition(positionId: number, flags: string[], note: string) {
    const previous = conds[positionId];
    setConds((c) => ({ ...c, [positionId]: { flags, note, capturedAt: new Date().toISOString() } }));
    setError(null);
    try {
      const res = await fetch("/api/conditions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeNumber,
          positionId,
          flags,
          note,
          capturedAt: new Date().toISOString(),
          deviceHash: getDeviceHash(),
          shift: "",
        }),
      });
      if (res.ok) {
        const { saved } = await res.json();
        setConds((c) => ({ ...c, [positionId]: { flags: saved.flags, note: saved.note, capturedAt: saved.capturedAt } }));
      } else if (res.status === 409) {
        const { current } = await res.json();
        setConds((c) => ({ ...c, [positionId]: { flags: current.flags, note: current.note, capturedAt: current.capturedAt } }));
      } else {
        setConds((c) => ({ ...c, [positionId]: previous }));
        const { error } = await res.json().catch(() => ({ error: "save failed" }));
        setError(error ?? "save failed");
      }
    } catch {
      setConds((c) => ({ ...c, [positionId]: previous }));
      setError("offline — change not saved yet, try again");
    }
  }

  async function assign(positionId: number, productId: number | null) {
    const previous = assigned[positionId];
    const product = productId != null ? nameById.get(productId) : null;
    setAssigned((a) => ({
      ...a,
      [positionId]: product
        ? { productId: product.id, name: product.quickName, kind: product.kind === "tablet" ? "tablet" : "camera" }
        : null,
    }));
    setPickFor(null);
    setSearch("");
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/layout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeNumber,
          deviceHash: getDeviceHash(),
          assignments: [{ positionId, productId }],
        }),
      });
      if (!res.ok) {
        setAssigned((a) => ({ ...a, [positionId]: previous }));
        const { error } = await res.json().catch(() => ({ error: "save failed" }));
        setError(error ?? "save failed");
      }
    } catch {
      setAssigned((a) => ({ ...a, [positionId]: previous }));
      setError("offline — change not saved yet, try again");
    } finally {
      setBusy(false);
    }
  }

  function toggleFlag(positionId: number, key: string) {
    const current = conds[positionId] ?? { flags: [], note: "", capturedAt: null };
    const flags = current.flags.includes(key)
      ? current.flags.filter((f) => f !== key)
      : [...current.flags, key];
    void saveCondition(positionId, flags, current.note);
  }

  const editing = mode === "edit";
  const filteredProducts = products.filter(
    (p) => search === "" || p.quickName.toLowerCase().includes(search.toLowerCase()),
  );

  // Position numbers run continuously across the whole side, left → right.
  const visibleCounts = side.sections.map((section) =>
    section.capacity === 4 ? 4 : assigned[section.slots[4]?.positionId]?.name != null ? 5 : 4,
  );
  const sectionOffsets = visibleCounts.map((_, i) =>
    visibleCounts.slice(0, i).reduce((sum, n) => sum + n, 0),
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-6">
      <header
        className={`sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-3 border-b px-4 py-3 backdrop-blur ${
          editing ? "border-warn bg-warn/15" : "border-border bg-bg/95"
        }`}
      >
        <Link href={`/store/${storeNumber}/${brandSlug}`} aria-label={`back to ${tableName} table`}>
          <Icon name="chevron-right" size={22} className="rotate-180" />
        </Link>
        <span className="text-lg font-bold">
          {tableName} · {side.label}
        </span>
        {editing && <span className="text-xs font-bold uppercase text-warn-text">editing layout</span>}
      </header>

      <div className="mb-1 flex border-2 border-border-strong text-sm font-bold" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!editing}
          onClick={() => setMode("record")}
          className={`flex-1 py-2 ${!editing ? "bg-accent text-accent-ink" : "text-text-muted"}`}
        >
          Record
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={editing}
          onClick={() => setMode("edit")}
          className={`flex-1 py-2 ${editing ? "bg-warn text-warn-ink" : "text-text-muted"}`}
        >
          Edit layout
        </button>
      </div>
      <p className="mb-3 text-xs text-text-faint">
        viewed from the end cap · positions run left → right
      </p>
      {editing && (
        <p className="mb-3 border border-warn bg-warn/10 px-3 py-2 text-xs font-semibold text-warn-text">
          Editing this store&apos;s layout — tap a slot to pick from the master list.
        </p>
      )}
      {error && <p className="mb-3 text-sm text-danger-text">{error}</p>}

      <div className="flex gap-2.5 overflow-x-auto pb-4">
        {side.sections.map((section, sectionIdx) => {
          const visible = visibleCounts[sectionIdx];
          const assignedFifth = visible === 5;
          return (
            <div key={section.key} className="flex gap-2.5">
              {sectionIdx > 0 && <div className="w-0 self-stretch border-l-2 border-dashed border-border" aria-hidden />}
              {section.slots.slice(0, visible).map((slot, slotIdx) => {
                const positionNumber = sectionOffsets[sectionIdx] + slotIdx + 1;
                const position = slot.positionId;
                const assignment = assigned[position];
                const condition = conds[position] ?? { flags: [], note: "", capturedAt: null };
                const hasFlags = condition.flags.length > 0;
                return (
                  <div key={`${section.key}-${slot.idx}`} className="flex w-32 flex-none flex-col gap-2">
                    <p className="text-center text-[10px] font-extrabold tracking-wider text-text-faint">
                      {positionNumber}
                    </p>
                    {editing ? (
                      <button
                        type="button"
                        disabled={busy || position < 0}
                        onClick={() => setPickFor(position)}
                        className={`min-h-14 border-2 border-dashed px-2 py-2 text-sm font-bold ${
                          assignment ? "border-border-strong" : "border-border text-text-faint"
                        }`}
                      >
                        {assignment?.name ?? "— empty —"}
                        <span className="ml-1 text-warn-text">▾</span>
                      </button>
                    ) : (
                      <div
                        className={`flex min-h-14 items-center justify-center border-2 px-2 py-2 text-center text-sm font-bold ${
                          hasFlags ? "border-danger bg-danger/10" : "border-border"
                        } ${assignment ? "" : "text-text-faint"}`}
                      >
                        {assignment?.name ?? "— empty —"}
                      </div>
                    )}
                    {!editing && (
                      <>
                        <div className="grid grid-cols-2 gap-1.5">
                          {flagVocab.map((flag) => {
                            const active = condition.flags.includes(flag.key);
                            return (
                              <button
                                key={flag.key}
                                type="button"
                                disabled={!assignment || position < 0}
                                aria-pressed={active}
                                onClick={() => toggleFlag(position, flag.key)}
                                className={`border-2 px-1 py-2.5 text-[11px] font-bold disabled:opacity-30 ${
                                  active
                                    ? "border-danger bg-danger text-danger-ink"
                                    : "border-border text-text-muted"
                                }`}
                              >
                                {flag.label}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          disabled={!assignment || position < 0}
                          onClick={() => {
                            setNoteDraft(condition.note);
                            setNoteFor(position);
                          }}
                          className={`text-center text-xs font-bold disabled:opacity-30 ${
                            condition.note ? "text-danger-text" : "text-info-text"
                          }`}
                        >
                          {condition.note ? "1 note ›" : "＋ note"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              {editing && section.capacity === 5 && !assignedFifth && (
                <button
                  type="button"
                  onClick={() => setPickFor(section.slots[4].positionId)}
                  className="mt-6 h-14 w-24 flex-none border-2 border-dashed border-border text-xs font-bold text-info-text"
                >
                  ＋ 5th slot
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-auto text-center text-xs text-text-faint">← swipe · left → right as you face the wall →</p>

      {/* note sheet */}
      <Sheet
        open={noteFor != null}
        onClose={() => setNoteFor(null)}
        title={noteFor != null ? (assigned[noteFor]?.name ?? "Note") : "Note"}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setNoteFor(null)}>
              Cancel
            </Button>
            <Button
              block
              icon="check"
              onClick={() => {
                if (noteFor == null) return;
                const current = conds[noteFor] ?? { flags: [], note: "", capturedAt: null };
                void saveCondition(noteFor, current.flags, noteDraft);
                setNoteFor(null);
              }}
            >
              Save note
            </Button>
          </div>
        }
      >
        <Field
          label="Note"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value.slice(0, 280))}
          placeholder="Loose from the mount, told MOD…"
          hint={`${noteDraft.length}/280`}
        />
      </Sheet>

      {/* master-list picker sheet */}
      <Sheet
        open={pickFor != null}
        onClose={() => {
          setPickFor(null);
          setSearch("");
        }}
        title="Choose camera"
        footer={
          pickFor != null && assigned[pickFor] ? (
            <Button variant="secondary" block onClick={() => pickFor != null && void assign(pickFor, null)}>
              Clear slot
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3">
          <Field
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models…"
          />
          <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickFor != null && void assign(pickFor, p.id)}
                className="border border-border px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface"
              >
                {p.quickName}
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="py-4 text-center text-sm text-text-faint">
                No match. Admins add new models to the master list in the CMS.
              </p>
            )}
          </div>
        </div>
      </Sheet>
    </main>
  );
}
