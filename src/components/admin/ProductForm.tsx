"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ActionState } from "@/app/admin/products/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { productKinds } from "@/lib/contracts";

type BrandOption = { id: number; name: string };
type Initial = {
  brandId?: number;
  quickName?: string;
  longName?: string;
  model?: string;
  sku?: string;
  kind?: string;
  active?: boolean;
};

export function ProductForm({
  action,
  brands,
  initial = {},
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  brands: BrandOption[];
  initial?: Initial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Brand</span>
        <select
          name="brandId"
          defaultValue={initial.brandId ?? ""}
          required
          className="min-h-11 rounded-none border border-border-strong bg-bg px-3 text-base"
        >
          <option value="" disabled>Select a brand…</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>

      <Field label="Quick name" name="quickName" defaultValue={initial.quickName} required placeholder="A7 V" hint="Short label shown in the survey" />
      <Field label="Long name" name="longName" defaultValue={initial.longName} required placeholder="Alpha 7 V Full-Frame Camera" />
      <Field label="Model" name="model" defaultValue={initial.model} required placeholder="ILCE-7M5" />
      <Field label="SKU" name="sku" mono defaultValue={initial.sku} required placeholder="1234567" inputMode="numeric" hint="Exactly 7 digits" />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Kind</span>
        <select
          name="kind"
          defaultValue={initial.kind ?? "camera"}
          className="min-h-11 rounded-none border border-border-strong bg-bg px-3 text-base"
        >
          {productKinds.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={initial.active ?? true} value="true" className="size-5" />
        <span className="text-sm">Active</span>
      </label>

      {state.error && (
        <p className="border border-danger bg-danger/10 px-3 py-2 text-sm font-medium text-danger-text">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} icon="check">
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href="/admin/products">
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}
