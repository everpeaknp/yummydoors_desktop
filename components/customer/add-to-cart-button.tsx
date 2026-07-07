"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/http";
import { extractApiErrorMessage, readJsonSafely } from "@/lib/api-utils";
import { useAuth } from "@/hooks/use-auth";

type AddToCartButtonProps = {
  restaurantId: number;
  menuItemId: number;
  className?: string;
};

export function AddToCartButton({
  restaurantId,
  menuItemId,
  className,
}: AddToCartButtonProps) {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "added">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    setLoading(true);
    setStatus("idle");
    setError(null);
    const response = await apiFetch(`/carts/${restaurantId}/items`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        menu_item_id: menuItemId,
        quantity: 1,
      }),
    });

    const payload = await readJsonSafely(response);
    if (!response.ok) {
      setLoading(false);
      setError(extractApiErrorMessage(payload, "Failed to add item to cart."));
      return;
    }

    setLoading(false);
    setStatus("added");
    window.dispatchEvent(new CustomEvent("yummydoors:cart-updated"));
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          void handleAdd();
        }}
        disabled={loading}
        className={className}
      >
        <ShoppingCart className="h-4 w-4" />
        {loading ? "Adding..." : status === "added" ? "Added" : "Add to cart"}
      </Button>
      {error ? <p className="text-xs text-[#be123c]">{error}</p> : null}
    </div>
  );
}
