"use client";

import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { BrandChip, StatusChip } from "@/components/ui/Chip";
import { FlagToggle } from "@/components/ui/FlagToggle";
import { Sheet } from "@/components/ui/Sheet";
import {
  TablePlan,
  type PlanSection,
  type PlanSlot,
} from "@/components/ui/TablePlan";

const ALL_ICONS: IconName[] = [
  "aperture", "shutter", "lens", "camera", "flag", "slot", "grid", "store",
  "clock", "search", "check", "x", "plus", "minus", "chevron-right",
  "chevron-down", "alert", "edit", "trash", "cloud-check", "cloud-pending",
];

const DEMO_SECTIONS: PlanSection[] = [
  {
    key: "endcap",
    label: "Endcap",
    slots: [
      { id: 1, idx: 0, product: { quickName: "Demo Alpha 7", brand: "sony" } },
      {
        id: 2, idx: 1, product: { quickName: "Demo EOS R", brand: "canon" },
        flags: [{ tone: "danger", label: "broken" }],
      },
      {
        id: 3, idx: 2, product: { quickName: "Demo Z6", brand: "nikon" },
        flags: [{ tone: "warn", label: "demo mode off" }],
      },
      { id: 4, idx: 3, product: null },
    ],
  },
  {
    key: "lens",
    label: "Lens Wall",
    slots: [
      {
        id: 5, idx: 0, product: { quickName: "Demo 24-70 Lens", brand: "sony" },
        flags: [{ tone: "danger", label: "missing" }, { tone: "info", label: "wrong lens" }],
      },
    ],
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-8">
      <h2 className="mb-4 text-2xs font-semibold uppercase tracking-widest text-text-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ token, label }: { token: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-12 w-full border border-border"
        style={{ background: `var(${token})` }}
      />
      <span className="text-2xs text-text-muted">{label}</span>
      <span className="tabular text-2xs text-text-faint">{token}</span>
    </div>
  );
}

export default function KitchenSink() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [flags, setFlags] = useState({ broken: false, missing: true, demo: false });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<PlanSlot | null>(null);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24">
      <header className="sticky top-0 z-10 -mx-4 mb-2 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Icon name="aperture" size={24} />
          <h1 className="text-lg font-semibold">Rounds — Kitchen Sink</h1>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={theme === "light" ? "aperture" : "lens"}
          onClick={toggleTheme}
        >
          {theme === "light" ? "Light" : "Dark"}
        </Button>
      </header>

      <p className="py-4 text-sm text-text-muted">
        Phase 1 design system, first pass. Light &amp; technical, legibility-first.
        Toggle the theme top-right — light is the design target; dark is the
        swappable token set. Everything here is built only from the token
        system.
      </p>

      <Section title="Neutrals">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Swatch token="--bg" label="bg" />
          <Swatch token="--surface" label="surface" />
          <Swatch token="--surface-2" label="surface-2" />
          <Swatch token="--border" label="border" />
          <Swatch token="--border-strong" label="border-strong" />
          <Swatch token="--text" label="text" />
        </div>
      </Section>

      <Section title="Brand accents (signal only)">
        <div className="grid grid-cols-3 gap-3">
          <Swatch token="--brand-sony" label="Sony" />
          <Swatch token="--brand-canon" label="Canon" />
          <Swatch token="--brand-nikon" label="Nikon" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <BrandChip brand="sony" />
          <BrandChip brand="canon" />
          <BrandChip brand="nikon" />
        </div>
      </Section>

      <Section title="Status">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Swatch token="--danger" label="danger / broken" />
          <Swatch token="--warn" label="warn / missing" />
          <Swatch token="--success" label="success" />
          <Swatch token="--info" label="info" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusChip tone="danger" icon="x">broken</StatusChip>
          <StatusChip tone="warn" icon="alert">missing</StatusChip>
          <StatusChip tone="success" icon="check">resolved</StatusChip>
          <StatusChip tone="info">note</StatusChip>
          <StatusChip tone="neutral">neutral</StatusChip>
        </div>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-2">
          <p className="text-3xl font-semibold">Store 0058 — Tuesday</p>
          <p className="text-2xl font-semibold">Section: Endcap</p>
          <p className="text-xl">Alpha 7 V — body</p>
          <p className="text-base">Base 16px body copy for the survey flow.</p>
          <p className="text-sm text-text-muted">Small muted secondary text.</p>
          <p className="text-2xs uppercase tracking-widest text-text-faint">Micro label</p>
          <p className="tabular text-lg">SKU 9990001 · 0058 · 3 issues</p>
        </div>
      </Section>

      <Section title="Icons">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {ALL_ICONS.map((n) => (
            <div key={n} className="flex flex-col items-center gap-1 border border-border py-3">
              <Icon name={n} size={24} />
              <span className="text-2xs text-text-faint">{n}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button icon="plus">Add product</Button>
            <Button variant="secondary" icon="search">Search</Button>
            <Button variant="secondary" iconRight="chevron-right">Next</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
          <Button block icon="check">Submit round</Button>
        </div>
      </Section>

      <Section title="Fields">
        <div className="flex flex-col gap-4">
          <Field label="Store number" placeholder="0058" mono hint="4-digit Best Buy store number" inputMode="numeric" />
          <Field label="Product name" placeholder="Alpha 7 V" defaultValue="Alpha 7 V" />
          <Field label="SKU" placeholder="1234567" mono error="Must be exactly 7 digits" defaultValue="12345" />
          <Field label="Disabled" placeholder="—" disabled />
        </div>
      </Section>

      <Section title="Flag toggles (the core survey interaction)">
        <div className="flex flex-wrap gap-2">
          <FlagToggle label="Broken" tone="danger" pressed={flags.broken} onToggle={(v) => setFlags((f) => ({ ...f, broken: v }))} />
          <FlagToggle label="Missing" tone="warn" pressed={flags.missing} onToggle={(v) => setFlags((f) => ({ ...f, missing: v }))} icon="alert" />
          <FlagToggle label="Demo mode off" tone="info" pressed={flags.demo} onToggle={(v) => setFlags((f) => ({ ...f, demo: v }))} />
          <FlagToggle label="Disabled" pressed={false} onToggle={() => {}} disabled />
        </div>
      </Section>

      <Section title="Sync status">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
            <Icon name="cloud-check" size={20} className="text-success-text" /> All changes saved
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-warn-text">
            <Icon name="cloud-pending" size={20} /> 2 changes pending
          </span>
        </div>
      </Section>

      <Section title="Table plan (tap a slot)">
        <TablePlan
          sections={DEMO_SECTIONS}
          onSelectSlot={(slot) => {
            setSelected(slot);
            setSheetOpen(true);
          }}
        />
      </Section>

      <Section title="Sheet">
        <Button variant="secondary" icon="grid" onClick={() => { setSelected(null); setSheetOpen(true); }}>
          Open bottom sheet
        </Button>
      </Section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={selected?.product ? selected.product.quickName : selected ? "Empty slot" : "Slot detail"}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button block icon="check" onClick={() => setSheetOpen(false)}>Save</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {selected?.product && <BrandChip brand={selected.product.brand} className="self-start" />}
          <p className="text-sm text-text-muted">
            Mark what you found on this slot. (Demo — wired to real conditions in Phase 3.)
          </p>
          <div className="flex flex-wrap gap-2">
            <FlagToggle label="Broken" tone="danger" pressed={flags.broken} onToggle={(v) => setFlags((f) => ({ ...f, broken: v }))} />
            <FlagToggle label="Missing" tone="warn" pressed={flags.missing} onToggle={(v) => setFlags((f) => ({ ...f, missing: v }))} icon="alert" />
          </div>
          <Field label="Note" placeholder="Optional note…" />
        </div>
      </Sheet>
    </main>
  );
}
