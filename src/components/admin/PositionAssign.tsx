"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignPosition } from "@/app/admin/planogram/actions";

type ProductOption = { id: number; label: string; brandSlug: string };

export function PositionAssign({
  positionId,
  idx,
  currentProductId,
  products,
}: {
  positionId: number;
  idx: number;
  currentProductId: number | null;
  products: ProductOption[];
}) {
  const [value, setValue] = useState<string>(currentProductId ? String(currentProductId) : "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function onChange(next: string) {
    setValue(next);
    setSaving(true);
    await assignPosition(positionId, next === "" ? null : Number(next));
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-0">
      <span className="tabular w-8 shrink-0 text-sm text-text-faint">
        {String(idx + 1).padStart(2, "0")}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={saving}
        className="min-h-11 flex-1 rounded-none border border-border-strong bg-bg px-2 text-sm"
      >
        <option value="">— empty slot —</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      {saving && <span className="text-xs text-text-faint">saving…</span>}
    </div>
  );
}
