"use client";

import { useRouter } from "next/navigation";
import { toggleFlag, deleteFlag } from "@/app/admin/flags/actions";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/Chip";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";

export function FlagRow({
  flag,
}: {
  flag: { key: string; label: string; sort: number; active: boolean };
}) {
  const router = useRouter();
  return (
    <tr className="border-b border-border last:border-0">
      <td className="tabular px-3 py-2 font-medium">{flag.key}</td>
      <td className="px-3 py-2">{flag.label}</td>
      <td className="tabular px-3 py-2 text-text-muted">{flag.sort}</td>
      <td className="px-3 py-2">
        {flag.active ? (
          <StatusChip tone="success">active</StatusChip>
        ) : (
          <StatusChip tone="neutral">off</StatusChip>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => { await toggleFlag(flag.key, !flag.active); router.refresh(); }}
          >
            {flag.active ? "Disable" : "Enable"}
          </Button>
          <ConfirmDelete action={deleteFlag.bind(null, flag.key)} />
        </span>
      </td>
    </tr>
  );
}
