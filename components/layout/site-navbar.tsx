"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

type SiteNavbarProps = {
  className?: string;
};

const guestLinks = [
  { href: "/", label: "Home" },
  { href: "/restaurants", label: "Restaurants" },
];

const authLinks = [
  { href: "/", label: "Home" },
  { href: "/restaurants", label: "Restaurants" },
  { href: "/profile", label: "Profile" },
];

export function SiteNavbar({ className }: SiteNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, accessToken, user } = useAuth();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const links = accessToken ? authLinks : guestLinks;

  return (
    <header className={cn("border-b border-black/5 bg-white/92 backdrop-blur-xl", className)}>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="rounded-2xl bg-[#fff7f2] p-2.5">
            <Image
              src="/Yummy_Doors-Png.png"
              alt="YummyDoors"
              width={36}
              height={36}
              className="h-9 w-9"
              priority
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              YummyDoors
            </p>
            <p className="text-sm text-muted-foreground">Delivery, kept simple.</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {hydrated && accessToken ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-foreground">{user?.fullName ?? "YummyDoors user"}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.defaultAddress?.locationTitle ?? user?.email ?? user?.phone ?? "Signed in"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearAuth();
                  router.replace("/");
                }}
                className="rounded-full border border-[#ffd9c8] bg-[#fff7f2] px-4 py-2 text-sm font-medium text-primary transition hover:bg-[#fff1e8]"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
