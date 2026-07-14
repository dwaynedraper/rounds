import { requireAdmin } from "@/lib/auth-helpers";
import { recentAudit } from "@/lib/queries";
import { StatusChip } from "@/components/ui/Chip";

const ACTION_TONE = {
  create: "success",
  update: "info",
  import: "info",
  revert: "warn",
  delete: "danger",
} as const;

export default async function AuditPage() {
  await requireAdmin();
  const rows = await recentAudit(100);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every CMS change and every anonymous survey write (S5). Actor is an
          email (CMS) or a device hash (survey) — never an IP.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No activity yet.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-2xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="tabular whitespace-nowrap px-3 py-2 text-text-muted">
                    {new Date(r.at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{r.actor}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {r.entity} #{r.entityId}
                  </td>
                  <td className="px-3 py-2">
                    <StatusChip tone={ACTION_TONE[r.action as keyof typeof ACTION_TONE] ?? "neutral"}>
                      {r.action}
                    </StatusChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
