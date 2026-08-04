import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" && "h-8 gap-1.5 px-3 text-xs",
        size === "md" && "h-11 gap-2 px-4 text-sm",
        size === "lg" && "h-12 gap-2 px-6 text-base",
        variant === "primary" &&
          "bg-primary text-primary-foreground shadow-panel hover:bg-[#dd451a]",
        variant === "secondary" &&
          "border border-border bg-secondary text-secondary-foreground hover:bg-[#ffe8d3]",
        variant === "ghost" && "text-foreground hover:bg-muted",
        variant === "outline" &&
          "border border-gray-300 bg-white text-foreground hover:bg-gray-50",
        className,
      )}
      {...props}
    />
  );
}

