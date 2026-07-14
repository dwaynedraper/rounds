import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { Icon, type IconName } from "@/components/icons";
import { SignOutButton } from "@/components/admin/SignOutButton";

const NAV: { href: string; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { href: "/admin", label: "Dashboard", icon: "grid" },
  { href: "/admin/products", label: "Products", icon: "camera" },
  { href: "/admin/planogram", label: "Planogram", icon: "slot" },
  { href: "/admin/stores", label: "Stores", icon: "store", adminOnly: true },
  { href: "/admin/flags", label: "Flags", icon: "flag", adminOnly: true },
  { href: "/admin/audit", label: "Audit log", icon: "clock", adminOnly: true },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The whole /admin tree is per-user and auth-gated — no useful static
  // shell exists, so opt out of prerendering (cacheComponents/PPR).
  await connection();

  // Page-level gate. NOT the security boundary on its own — every mutation
  // re-checks role + brand scope in its server action (S4).
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const nav = NAV.filter((n) => !n.adminOnly || user.role === "admin");

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Icon name="aperture" size={22} />
          <span className="font-semibold">Rounds CMS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-text-muted sm:inline">
            {user.email} · {user.role}
          </span>
          <SignOutButton />
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-14 shrink-0 border-r border-border sm:w-52">
          <ul className="flex flex-col py-2">
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="flex min-h-11 items-center gap-3 px-4 text-sm text-text-muted hover:bg-surface hover:text-text"
                >
                  <Icon name={n.icon} size={20} />
                  <span className="hidden sm:inline">{n.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
