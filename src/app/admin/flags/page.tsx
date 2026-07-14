import { requireAdmin } from "@/lib/auth-helpers";
import { listFlags } from "@/lib/queries";
import { AddFlagForm } from "@/components/admin/AddFlagForm";
import { FlagRow } from "@/components/admin/FlagRow";

export default async function FlagsPage() {
  await requireAdmin();
  const flags = await listFlags();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Flags</h1>
        <p className="mt-1 text-sm text-text-muted">
          The condition vocabulary reps pick from when marking a slot.
        </p>
      </div>
      <AddFlagForm />

      {flags.length === 0 ? (
        <p className="text-sm text-text-muted">No flags yet.</p>
      ) : (
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-2xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Sort</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <FlagRow key={f.key} flag={f} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
