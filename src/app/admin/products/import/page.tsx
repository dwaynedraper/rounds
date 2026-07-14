import { requireUser } from "@/lib/auth-helpers";
import { BulkImport } from "@/components/admin/BulkImport";

export default async function ImportPage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Bulk import products</h1>
      <BulkImport />
    </div>
  );
}
