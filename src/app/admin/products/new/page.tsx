import { listBrands } from "@/lib/queries";
import { requireUser, getUserBrandIds } from "@/lib/auth-helpers";
import { createProduct } from "../actions";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  const user = await requireUser();
  const all = await listBrands();
  let brands = all;
  if (user.role !== "admin") {
    const scoped = new Set(await getUserBrandIds(user.id));
    brands = all.filter((b) => scoped.has(b.id));
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Add product</h1>
      <ProductForm action={createProduct} brands={brands} submitLabel="Create product" />
    </div>
  );
}
