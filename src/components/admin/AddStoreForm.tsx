"use client";

import { useActionState, useRef, useEffect } from "react";
import { createStore, type StoreState } from "@/app/admin/stores/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function AddStoreForm() {
  const [state, action, pending] = useActionState<StoreState, FormData>(createStore, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2 border border-border bg-surface p-3">
      <div className="w-28">
        <Field label="Number" name="number" mono placeholder="0058" inputMode="numeric" required />
      </div>
      <div className="min-w-40 flex-1">
        <Field label="Nickname" name="nickname" placeholder="Optional" />
      </div>
      <Button type="submit" icon="plus" disabled={pending}>Add store</Button>
      {state.error && <p className="w-full text-sm text-danger-text">{state.error}</p>}
    </form>
  );
}
