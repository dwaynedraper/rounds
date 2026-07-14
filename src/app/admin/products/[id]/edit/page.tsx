import { notFound } from "next/navigation";
import { getProduct, listBrands } from "@/lib/queries";
import { requireUser, getUserBrandIds } from "@/lib/auth-helpers";
import { updateProduct } from "../../actions";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const product = await getProduct(id);
  if (!product) notFound();

  const user = await requireUser();
  const all = await listBrands();
  let brands = all;
  if (user.role !== "admin") {
    const scoped = new Set(await getUserBrandIds(user.id));
    brands = all.filter((b) => scoped.has(b.id));
  }

  const action = updateProduct.bind(null, id);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Edit product</h1>
      <ProductForm
        action={action}
        brands={brands}
        initial={{
          brandId: product.brandId,
          quickName: product.quickName,
          longName: product.longName,
          model: product.model,
          sku: product.sku,
          kind: product.kind,
          active: product.active,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
