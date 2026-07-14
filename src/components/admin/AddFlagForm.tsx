"use client";

import { useActionState, useRef, useEffect } from "react";
import { createFlag, type FlagState } from "@/app/admin/flags/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function AddFlagForm() {
  const [state, action, pending] = useActionState<FlagState, FormData>(createFlag, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2 border border-border bg-surface p-3">
      <div className="w-40">
        <Field label="Key" name="key" mono placeholder="broken" required hint="lowercase-hyphens" />
      </div>
      <div className="min-w-48 flex-1">
        <Field label="Label" name="label" placeholder="Broken / not powering on" required />
      </div>
      <div className="w-20">
        <Field label="Sort" name="sort" mono inputMode="numeric" defaultValue="0" />
      </div>
      <input type="hidden" name="active" value="true" />
      <Button type="submit" icon="plus" disabled={pending}>Add flag</Button>
      {state.error && <p className="w-full text-sm text-danger-text">{state.error}</p>}
    </form>
  );
}
