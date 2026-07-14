import { requireAdmin } from "@/lib/auth-helpers";
import { listStores } from "@/lib/queries";
import { deleteStore } from "./actions";
import { AddStoreForm } from "@/components/admin/AddStoreForm";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";

export default async function StoresPage() {
  await requireAdmin();
  const stores = await listStores();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Stores</h1>
      <AddStoreForm />

      {stores.length === 0 ? (
        <p className="text-sm text-text-muted">No stores yet.</p>
      ) : (
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-2xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Nickname</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="tabular px-3 py-2 font-medium">{s.number}</td>
                  <td className="px-3 py-2 text-text-muted">{s.nickname ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <ConfirmDelete action={deleteStore.bind(null, s.id)} />
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
