"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

export function Header() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-white/72 px-6 py-5 backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Dashboard
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back{user?.fullName ? `, ${user.fullName}` : ""}
        </h1>
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          clearAuth();
          router.replace("/login");
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </header>
  );
}

