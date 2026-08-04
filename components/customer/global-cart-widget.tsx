"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/http";
import { extractApiErrorMessage, readJsonSafely } from "@/lib/api-utils";
import { useAuth } from "@/hooks/use-auth";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { FloatingCartButton } from "@/components/customer/floating-cart-button";
import { FALLBACK_MENU_ITEM_IMAGE, isUsableImageUrl } from "@/lib/restaurant-media";

type GlobalCartItem = {
  id: number;
  menu_item_id: number;
  quantity: number;
  name: string;
  price: number;
  image_url: string | null;
};

type GlobalCart = {
  id: number;
  restaurant_id: number;
  restaurant_name: string;
  items: GlobalCartItem[];
  items_count: number;
  pricing: { total_amount: number };
};

const HIDDEN_PREFIXES = ["/merchant", "/rider", "/login", "/signup"];

function formatMoney(value: number) {
  return `NPR ${value.toFixed(2)}`;
}

function itemImage(url: string | null) {
  return isUsableImageUrl(url) ? (url as string) : FALLBACK_MENU_ITEM_IMAGE;
}

export function GlobalCartWidget() {
  const pathname = usePathname();
  const { hydrated, accessToken } = useAuth();
  const [carts, setCarts] = useState<GlobalCart[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadCarts = useCallback(async () => {
    if (!hydrated || !accessToken) {
      setCarts([]);
      return;
    }
    const response = await apiFetch("/carts", { auth: true });
    const payload = await readJsonSafely<GlobalCart[]>(response);
    if (!response.ok) return;
    setCarts(payload ?? []);
  }, [hydrated, accessToken]);

  useEffect(() => {
    void loadCarts();
    function handleCartUpdated() {
      void loadCarts();
    }
    window.addEventListener("yummydoors:cart-updated", handleCartUpdated);
    return () => window.removeEventListener("yummydoors:cart-updated", handleCartUpdated);
  }, [loadCarts]);

  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  const itemCount = carts.reduce((total, cart) => total + cart.items_count, 0);

  async function updateQuantity(restaurantId: number, itemId: number, quantity: number) {
    const response = await apiFetch(`/carts/${restaurantId}/items/${itemId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ quantity }),
    });
    const payload = await readJsonSafely<GlobalCart>(response);
    if (!response.ok) return;
    if (payload) window.dispatchEvent(new CustomEvent("yummydoors:cart-updated"));
  }

  async function removeItem(restaurantId: number, itemId: number) {
    const response = await apiFetch(`/carts/${restaurantId}/items/${itemId}`, {
      method: "DELETE",
      auth: true,
    });
    await readJsonSafely(response);
    if (response.ok) window.dispatchEvent(new CustomEvent("yummydoors:cart-updated"));
  }

  if (hidden || !hydrated || !accessToken) return null;

  return (
    <>
      <FloatingCartButton itemCount={itemCount} onClick={() => setDrawerOpen(true)} />
      <CartDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {carts.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Your cart is empty.</p>
        ) : (
          <div className="space-y-5">
            {carts.map((cart) => (
              <div key={cart.id} className="rounded-[6px] border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <p className="text-[14px] font-bold text-[#111]">{cart.restaurant_name}</p>
                  <Link
                    href={`/checkout/${cart.restaurant_id}`}
                    onClick={() => setDrawerOpen(false)}
                    className="text-[12px] font-semibold text-[#e8505b] hover:underline"
                  >
                    Checkout
                  </Link>
                </div>
                <ul className="divide-y divide-gray-100 px-4">
                  {cart.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[6px] bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={itemImage(item.image_url)}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[#333]">{item.name}</p>
                        <p className="text-[12px] text-gray-500">{formatMoney(item.price)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.quantity > 1) void updateQuantity(cart.restaurant_id, item.id, item.quantity - 1);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-[13px] font-semibold text-[#111]">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => void updateQuantity(cart.restaurant_id, item.id, item.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeItem(cart.restaurant_id, item.id)}
                          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-[#fecdd3] bg-[#fff1f2] text-[#be123c] hover:bg-[#ffe4e6]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-[13px] font-bold text-[#111]">
                  <span>Total</span>
                  <span>{formatMoney(cart.pricing.total_amount)}</span>
                </div>
              </div>
            ))}

            <div className="space-y-2 pt-1">
              <Link
                href={carts.length === 1 ? `/checkout/${carts[0].restaurant_id}` : "/cart"}
                onClick={() => setDrawerOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#e8505b] py-3 text-[14px] font-bold text-white transition hover:bg-[#d6414c]"
              >
                <ArrowRight className="h-4 w-4" />
                Continue to checkout
              </Link>
              <Link
                href="/cart"
                onClick={() => setDrawerOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-gray-200 py-3 text-[13px] font-semibold text-[#374151] transition hover:bg-gray-50"
              >
                <ShoppingCart className="h-4 w-4" />
                View full cart
              </Link>
            </div>
          </div>
        )}
      </CartDrawer>
    </>
  );
}
