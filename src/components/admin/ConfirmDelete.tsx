"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/** Generic two-click delete (no native dialog). Takes a bound server action. */
export function ConfirmDelete({
  action,
  label = "Delete",
}: {
  action: () => Promise<void>;
  label?: string;
}) {
  const [armed, setArmed] = useState(false);
  const router = useRouter();
  return armed ? (
    <span className="inline-flex gap-1">
      <Button size="sm" variant="danger" onClick={async () => { await action(); router.refresh(); }}>
        Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>Cancel</Button>
    </span>
  ) : (
    <Button size="sm" variant="ghost" icon="trash" onClick={() => setArmed(true)}>
      {label}
    </Button>
  );
}
