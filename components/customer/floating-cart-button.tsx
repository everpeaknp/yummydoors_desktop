"use client";

import { ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";

type FloatingCartButtonProps = {
  itemCount: number;
  onClick: () => void;
  className?: string;
};

export function FloatingCartButton({ itemCount, onClick, className }: FloatingCartButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        itemCount > 0 ? `Open cart, ${itemCount} item${itemCount === 1 ? "" : "s"}` : "Open cart"
      }
      className={cn(
        "fixed bottom-6 right-6 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-[#e8505b] text-white shadow-[0_12px_32px_rgba(232,80,91,0.4)] transition-transform duration-200 hover:scale-105 hover:bg-[#d6414c] active:scale-95",
        className,
      )}
    >
      <ShoppingCart className="h-6 w-6" strokeWidth={2} />
      {itemCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-[#111] px-1 text-[11px] font-bold leading-none text-white">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </button>
  );
}
