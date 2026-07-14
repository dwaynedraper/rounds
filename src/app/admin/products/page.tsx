import Link from "next/link";
import { listProducts } from "@/lib/queries";
import { BrandChip, StatusChip, type BrandKey } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

const BRAND_KEYS: BrandKey[] = ["sony", "canon", "nikon"];
const asBrand = (slug: string): BrandKey | null =>
  (BRAND_KEYS as string[]).includes(slug) ? (slug as BrandKey) : null;

export default async function ProductsPage() {
  const products = await listProducts();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link href="/admin/products/new">
          <Button icon="plus">Add product</Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="border border-border bg-surface p-6 text-sm text-text-muted">
          No products yet. Add one, or use bulk import.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-2xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 font-semibold">Brand</th>
                <th className="px-3 py-2 font-semibold">Quick name</th>
                <th className="px-3 py-2 font-semibold">Model</th>
                <th className="px-3 py-2 font-semibold">SKU</th>
                <th className="px-3 py-2 font-semibold">Kind</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const brand = asBrand(p.brandSlug);
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      {brand ? <BrandChip brand={brand} /> : p.brandName}
                    </td>
                    <td className="px-3 py-2 font-medium">{p.quickName}</td>
                    <td className="px-3 py-2 text-text-muted">{p.model}</td>
                    <td className="tabular px-3 py-2">{p.sku}</td>
                    <td className="px-3 py-2 text-text-muted">{p.kind}</td>
                    <td className="px-3 py-2">
                      {p.active ? (
                        <StatusChip tone="success">active</StatusChip>
                      ) : (
                        <StatusChip tone="neutral">inactive</StatusChip>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex justify-end gap-1">
                        <Link href={`/admin/products/${p.id}/edit`}>
                          <Button size="sm" variant="ghost" icon="edit">Edit</Button>
                        </Link>
                        <DeleteProductButton id={p.id} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
