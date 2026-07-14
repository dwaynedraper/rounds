import Link from "next/link";
import { listProducts, listStores, listFlags } from "@/lib/queries";
import { requireUser } from "@/lib/auth-helpers";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";

export default async function AdminDashboard() {
  const user = await requireUser();
  const [products, stores, flags] = await Promise.all([
    listProducts(),
    listStores(),
    listFlags(),
  ]);

  const stats = [
    { label: "Products", value: products.length, href: "/admin/products", icon: "camera" as const },
    { label: "Stores", value: stores.length, href: "/admin/stores", icon: "store" as const },
    { label: "Active flags", value: flags.filter((f) => f.active).length, href: "/admin/flags", icon: "flag" as const },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          Signed in as {user.email} ({user.role}).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="flex items-center gap-3 bg-bg p-4 hover:bg-surface">
            <Icon name={s.icon} size={24} className="text-text-faint" />
            <div>
              <div className="tabular text-2xl font-semibold">{s.value}</div>
              <div className="text-sm text-text-muted">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/products/new">
          <Button icon="plus">Add product</Button>
        </Link>
        <Link href="/admin/products/import">
          <Button variant="secondary" icon="plus">Bulk import</Button>
        </Link>
        <Link href="/admin/planogram">
          <Button variant="secondary" icon="slot">Edit planogram</Button>
        </Link>
      </div>
    </div>
  );
}
