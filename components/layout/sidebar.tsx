import Link from "next/link";
import { Home, UserCircle2, Store, LayoutGrid, UtensilsCrossed, Megaphone } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/restaurants", label: "Restaurants", icon: Store },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/menu-items", label: "Menu Catalog", icon: UtensilsCrossed },
  { href: "/promos", label: "Merchandising", icon: Megaphone },
  { href: "/profile", label: "Profile", icon: UserCircle2 },
];

export function Sidebar() {
  return (
    <aside className="w-72 flex-col border-r border-border bg-white/82 px-5 py-6 flex">
      <div className="mb-8 rounded-3xl bg-secondary px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          YummyDoors
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">Control Center</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customer, restaurant, and POS-linked delivery operations.
        </p>
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
