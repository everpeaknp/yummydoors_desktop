import type { StoredUser } from "@/lib/auth-storage";

export type NavItem = {
  href: string;
  label: string;
};

export function getUserModeLabel(user: StoredUser | null): string {
  const mode = user?.activeWorkspace?.workspaceType;
  if (mode === "merchant") return "Merchant mode";
  if (mode === "rider") return "Rider mode";
  return "Customer mode";
}

export function getSiteNavItems(user: StoredUser | null): NavItem[] {
  const items: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/restaurants", label: "Restaurants" },
  ];

  if (!user) {
    return items;
  }

  items.push({ href: "/reservations", label: "Reservations" });
  items.push({ href: "/wishlist", label: "Wishlist" });
  items.push({ href: "/cart", label: "Cart" });
  items.push({ href: "/merchant", label: "Merchant" });
  items.push({ href: "/profile", label: "Profile" });
  return items;
}

export function hasMerchantWorkspace(user: StoredUser | null): boolean {
  return Boolean((user?.workspaces ?? []).some((workspace) => workspace.workspaceType === "merchant"));
}

export function hasRiderAccess(user: StoredUser | null): boolean {
  return Boolean(
    user?.roles?.some((role) => role === "rider") ||
      user?.workspaces?.some((workspace) => workspace.workspaceType === "rider"),
  );
}
