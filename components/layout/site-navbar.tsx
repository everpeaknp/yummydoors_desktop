"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  ReceiptText,
  ShoppingCart,
  Store,
  UserCircle2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";
import { hasMerchantWorkspace } from "@/lib/navigation";

type SiteNavbarProps = {
  className?: string;
  variant?: "light" | "transparent";
};

export function SiteNavbar({ className, variant = "light" }: SiteNavbarProps) {
  const router = useRouter();
  const { hydrated, accessToken, user } = useAuth();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const merchantReady = hydrated && hasMerchantWorkspace(user);
  const displayName = user?.fullName?.trim() || user?.email?.trim() || "Account";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isLight = variant === "light";
  const useScrolledLight = variant === "transparent" && isScrolled;
  const bgClass = isLight || useScrolledLight
    ? "border-b border-black/5 bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl"
    : "bg-transparent";
  const textClass = isLight || useScrolledLight ? "text-[#1f2937]" : "text-white";
  const linkClass = useScrolledLight || isLight
    ? "hover:text-primary transition-colors"
    : "hover:text-primary transition-colors";
  const btnBorderClass = isLight || useScrolledLight ? "border-gray-300" : "border-white/30";
  const menuSurfaceClass = isLight || useScrolledLight
    ? "border border-[#f2d9cf] bg-white text-[#1f2937] shadow-[0_18px_50px_rgba(15,23,42,0.12)]"
    : "border border-white/15 bg-white text-[#1f2937] shadow-[0_18px_50px_rgba(15,23,42,0.22)]";

  useEffect(() => {
    if (variant !== "transparent") {
      setIsScrolled(false);
      return;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 32);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [variant]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSignOut = () => {
    setMenuOpen(false);
    clearAuth();
    router.replace("/");
  };

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-[80] transition-all duration-300",
        bgClass,
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full items-center justify-between px-6 lg:px-10",
          useScrolledLight || isLight ? "py-4" : "py-6",
        )}
      >
        <Link href="/" className="flex items-center gap-3.5">
          <div className="flex items-center justify-center">
            <Image
              src="/Yummy_Doors-Png.png"
              alt="YummyDoors logo"
              width={48}
              height={48}
              className="h-11 w-11 object-contain"
              priority
            />
          </div>
          <span className={cn("text-[30px] font-bold tracking-tight", textClass)}>YummyDoors</span>
        </Link>

        <nav className={cn("hidden md:flex items-center gap-8 text-[15px] font-semibold", textClass)}>
          <Link href="/" className={linkClass}>Home</Link>
          <Link href="/restaurants" className={linkClass}>Restaurants</Link>
          {hydrated && accessToken ? (
            <>
              <Link href="/merchant" className={linkClass}>
                {merchantReady ? "Merchant Portal" : "Create business"}
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((current) => !current)}
                  className={cn(
                    "flex items-center gap-3.5 rounded-full px-0 py-0 transition-colors",
                    isLight || useScrolledLight ? "text-[#1f2937]" : "text-white",
                  )}
                >
                  {user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt={displayName}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-[#1f2937] shadow-[0_4px_14px_rgba(15,23,42,0.12)]">
                      {initials}
                    </span>
                  )}
                  <span className="max-w-[170px] truncate text-[18px] font-medium leading-none tracking-[-0.01em]">
                    {displayName}
                  </span>
                  <ChevronDown className={cn("h-[18px] w-[18px] transition-transform", menuOpen ? "rotate-180" : "")} />
                </button>

                {menuOpen ? (
                  <div className={cn("absolute right-0 top-[calc(100%+14px)] z-50 w-[250px] rounded-[10px] p-2", menuSurfaceClass)}>
                    <div className="absolute -top-2 right-8 h-4 w-4 rotate-45 rounded-[2px] border-l border-t border-[#f2d9cf] bg-white" />
                    <div className="overflow-hidden rounded-[8px]">
                      <Link
                        href="/dashboard"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-[15px] font-medium text-[#2f3137] transition hover:bg-[#fff5ef]"
                      >
                        <LayoutDashboard className="h-5 w-5 text-[#444]" />
                        Dashboard
                      </Link>
                      {merchantReady ? (
                        <Link
                          href="/merchant/reservations"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-[15px] font-medium text-[#2f3137] transition hover:bg-[#fff5ef]"
                        >
                          <CalendarDays className="h-5 w-5 text-[#444]" />
                          Reservations
                        </Link>
                      ) : null}
                      <Link
                        href="/reservations"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-[15px] font-medium text-[#2f3137] transition hover:bg-[#fff5ef]"
                      >
                        <ReceiptText className="h-5 w-5 text-[#444]" />
                        My reservations
                      </Link>
                      <Link
                        href="/messages"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-[15px] font-medium text-[#2f3137] transition hover:bg-[#fff5ef]"
                      >
                        <MessageSquareText className="h-5 w-5 text-[#444]" />
                        Messages
                      </Link>
                      <Link
                        href="/wishlist"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-[15px] font-medium text-[#2f3137] transition hover:bg-[#fff5ef]"
                      >
                        <Heart className="h-5 w-5 text-[#444]" />
                        Wishlist
                      </Link>
                      <Link
                        href="/cart"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-[15px] font-medium text-[#2f3137] transition hover:bg-[#fff5ef]"
                      >
                        <ShoppingCart className="h-5 w-5 text-[#444]" />
                        Cart
                      </Link>
                      <Link
                        href="/merchant"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-[15px] font-medium text-[#2f3137] transition hover:bg-[#fff5ef]"
                      >
                        <Store className="h-5 w-5 text-[#444]" />
                        {merchantReady ? "Merchant Portal" : "Create business"}
                      </Link>
                      <Link
                        href="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-[15px] font-medium text-[#2f3137] transition hover:bg-[#fff5ef]"
                      >
                        <UserCircle2 className="h-5 w-5 text-[#444]" />
                        Profile
                      </Link>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 rounded-[8px] px-4 py-3 text-left text-[15px] font-medium text-[#2f3137] transition hover:bg-[#fff5ef]"
                      >
                        <LogOut className="h-5 w-5 text-[#444]" />
                        Log out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className={linkClass}>Sign in</Link>
              <Link href="/signup" className={cn("rounded-full border px-4 py-2 transition-colors hover:border-primary hover:text-primary", btnBorderClass, textClass)}>
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
