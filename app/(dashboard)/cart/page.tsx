"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag, Store, TicketPercent, Trash2, X } from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/http";
import { extractApiErrorMessage, readJsonSafely } from "@/lib/api-utils";
import { FALLBACK_MENU_ITEM_IMAGE, FALLBACK_RESTAURANT_COVER, isUsableImageUrl } from "@/lib/restaurant-media";

type CartItem = {
  id: number;
  menu_item_id: number;
  quantity: number;
  name: string;
  price: number;
  image_url: string | null;
};

type CartAddress = {
  id: number;
  label: string | null;
  recipient_name: string;
  phone_number: string;
  address_summary: string;
  latitude: number | null;
  longitude: number | null;
};

type CartPricing = {
  items_total: number;
  coupon_discount: number;
  delivery_fee: number;
  service_fee: number;
  tax_amount: number;
  subtotal_amount: number;
  total_amount: number;
};

type Cart = {
  id: number;
  restaurant_id: number;
  status: string;
  items: CartItem[];
  items_count: number;
  total_price: number;
  restaurant_name: string;
  restaurant_image_asset: string | null;
  eta_text: string;
  address: CartAddress | null;
  needs_cutlery: boolean;
  cooking_request: string | null;
  delivery_instruction: string | null;
  coupon_code: string | null;
  pricing: CartPricing;
};

function formatMoney(value: number) {
  return `NPR ${value.toFixed(2)}`;
}

function itemImage(url: string | null) {
  return isUsableImageUrl(url) ? (url as string) : FALLBACK_MENU_ITEM_IMAGE;
}

function restaurantImage(url: string | null) {
  return isUsableImageUrl(url) ? (url as string) : FALLBACK_RESTAURANT_COVER;
}

export default function CartPage() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [couponDrafts, setCouponDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCarts() {
    setLoading(true);
    setError(null);

    const response = await apiFetch("/carts", { auth: true });
    const payload = await readJsonSafely<Cart[]>(response);
    if (!response.ok) {
      setLoading(false);
      setError(extractApiErrorMessage(payload, "Failed to load cart."));
      return;
    }

    const data = payload ?? [];
    setCarts(data);
    setCouponDrafts(
      Object.fromEntries(data.map((cart) => [cart.restaurant_id, cart.coupon_code ?? ""])),
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadCarts();

    function handleCartUpdate() {
      void loadCarts();
    }

    window.addEventListener("yummydoors:cart-updated", handleCartUpdate);
    return () => window.removeEventListener("yummydoors:cart-updated", handleCartUpdate);
  }, []);

  const totalItems = useMemo(
    () => carts.reduce((sum, cart) => sum + cart.items_count, 0),
    [carts],
  );

  async function updateQuantity(restaurantId: number, itemId: number, quantity: number) {
    const response = await apiFetch(`/carts/${restaurantId}/items/${itemId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ quantity }),
    });
    const payload = await readJsonSafely<Cart>(response);
    if (!response.ok) {
      setError(extractApiErrorMessage(payload, "Failed to update cart item."));
      return;
    }
    const nextCart = payload;
    if (!nextCart) return;
    setCarts((current) => current.map((cart) => (cart.restaurant_id === restaurantId ? nextCart : cart)));
    window.dispatchEvent(new CustomEvent("yummydoors:cart-updated"));
  }

  async function removeItem(restaurantId: number, itemId: number) {
    const response = await apiFetch(`/carts/${restaurantId}/items/${itemId}`, {
      method: "DELETE",
      auth: true,
    });
    const payload = await readJsonSafely<Cart>(response);
    if (!response.ok) {
      setError(extractApiErrorMessage(payload, "Failed to remove cart item."));
      return;
    }
    const nextCart = payload;
    if (!nextCart) return;
    if (nextCart.items_count === 0) {
      setCarts((current) => current.filter((cart) => cart.restaurant_id !== restaurantId));
    } else {
      setCarts((current) => current.map((cart) => (cart.restaurant_id === restaurantId ? nextCart : cart)));
    }
    window.dispatchEvent(new CustomEvent("yummydoors:cart-updated"));
  }

  async function applyCoupon(restaurantId: number) {
    const couponCode = couponDrafts[restaurantId]?.trim();
    if (!couponCode) {
      return;
    }

    const response = await apiFetch(`/carts/${restaurantId}/coupon`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ coupon_code: couponCode }),
    });
    const payload = await readJsonSafely<Cart>(response);
    if (!response.ok) {
      setError(extractApiErrorMessage(payload, "Failed to apply coupon."));
      return;
    }
    const nextCart = payload;
    if (!nextCart) return;
    setCarts((current) => current.map((cart) => (cart.restaurant_id === restaurantId ? nextCart : cart)));
  }

  async function removeCoupon(restaurantId: number) {
    const response = await apiFetch(`/carts/${restaurantId}/coupon`, {
      method: "DELETE",
      auth: true,
    });
    const payload = await readJsonSafely<Cart>(response);
    if (!response.ok) {
      setError(extractApiErrorMessage(payload, "Failed to remove coupon."));
      return;
    }
    const nextCart = payload;
    if (!nextCart) return;
    setCouponDrafts((current) => ({ ...current, [restaurantId]: "" }));
    setCarts((current) => current.map((cart) => (cart.restaurant_id === restaurantId ? nextCart : cart)));
  }

  return (
    <div className="min-h-screen bg-[#fafafb]">
      <SiteNavbar variant="light" />

      <main className="mx-auto max-w-5xl px-6 pb-16 pt-[92px] lg:px-10">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8505b]">
            Cart
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
            Your carts
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {totalItems} item{totalItems === 1 ? "" : "s"} across {carts.length} restaurant cart{carts.length === 1 ? "" : "s"}.
          </p>
        </div>

        {loading ? (
          <div className="animate-pulse rounded-[10px] border border-[#eceff3] bg-white px-6 py-10 text-sm text-muted-foreground">
            Loading carts...
          </div>
        ) : (
          <div className="space-y-6">
            {error ? (
              <div className="rounded-[10px] border border-[#fecdd3] bg-[#fff1f2] px-6 py-4 text-sm text-[#be123c]">
                {error}
              </div>
            ) : null}

            {carts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[10px] border border-[#eceff3] bg-white px-6 py-16 text-center shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <p className="text-lg font-semibold text-[#111827]">Your cart is empty</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Add dishes from a restaurant page and they will appear here instantly.
                </p>
                <Link
                  href="/restaurants"
                  className="mt-2 inline-flex h-11 items-center justify-center rounded-[6px] bg-[#e8505b] px-5 text-sm font-bold text-white transition hover:bg-[#d6414c]"
                >
                  Browse restaurants
                </Link>
              </div>
            ) : (
              carts.map((cart) => (
                <div key={cart.id} className="overflow-hidden rounded-[10px] border border-[#eceff3] bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eceff3] px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={restaurantImage(cart.restaurant_image_asset)}
                          alt={cart.restaurant_name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#e8505b]">
                          <Store className="h-3 w-3" />
                          {cart.eta_text}
                        </p>
                        <h2 className="text-[16px] font-bold text-[#111827]">{cart.restaurant_name}</h2>
                      </div>
                    </div>
                    <Link
                      href={`/checkout/${cart.restaurant_id}`}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] bg-[#e8505b] px-4 text-[13px] font-bold text-white transition hover:bg-[#d6414c]"
                    >
                      Checkout
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  {cart.address ? (
                    <p className="border-b border-[#eceff3] px-6 py-2.5 text-[12px] text-muted-foreground">
                      Delivering to {cart.address.address_summary}
                    </p>
                  ) : null}

                  <div className="divide-y divide-gray-100 px-6">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 py-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[8px] bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={itemImage(item.image_url)}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-[#111827]">{item.name}</p>
                          <p className="mt-0.5 text-[13px] text-muted-foreground">{formatMoney(item.price)} each</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.quantity > 1) {
                                void updateQuantity(cart.restaurant_id, item.id, item.quantity - 1);
                              }
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-[#374151] transition hover:bg-gray-50"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-[14px] font-semibold text-[#111827]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => void updateQuantity(cart.restaurant_id, item.id, item.quantity + 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-[#374151] transition hover:bg-gray-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="w-20 shrink-0 text-right text-[14px] font-bold text-[#111827]">
                          {formatMoney(item.quantity * item.price)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void removeItem(cart.restaurant_id, item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-[#fff1f2] hover:text-[#be123c]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 border-t border-[#eceff3] bg-[#fafafa] px-6 py-5 lg:grid-cols-[1fr_300px]">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <TicketPercent className="h-4 w-4 text-[#9ca3af]" />
                        <p className="text-[13px] font-semibold text-[#111827]">Coupon code</p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={couponDrafts[cart.restaurant_id] ?? ""}
                          onChange={(event) =>
                            setCouponDrafts((current) => ({
                              ...current,
                              [cart.restaurant_id]: event.target.value,
                            }))
                          }
                          placeholder="FREEDEL or SAVE10"
                          className="h-10 rounded-[6px] bg-white text-[13px]"
                        />
                        <button
                          type="button"
                          onClick={() => void applyCoupon(cart.restaurant_id)}
                          className="h-10 shrink-0 rounded-[6px] border border-gray-200 bg-white px-4 text-[13px] font-semibold text-[#374151] transition hover:bg-gray-50"
                        >
                          Apply
                        </button>
                        {cart.coupon_code ? (
                          <button
                            type="button"
                            onClick={() => void removeCoupon(cart.restaurant_id)}
                            className="h-10 shrink-0 rounded-[6px] border border-[#fecdd3] bg-[#fff1f2] px-4 text-[13px] font-semibold text-[#be123c] transition hover:bg-[#ffe4e6]"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[13px]">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Items</span>
                        <span className="font-medium text-[#374151]">{formatMoney(cart.pricing.items_total)}</span>
                      </div>
                      {cart.pricing.coupon_discount > 0 ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Coupon</span>
                          <span className="font-medium text-[#16a34a]">- {formatMoney(cart.pricing.coupon_discount)}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Delivery</span>
                        <span className="font-medium text-[#374151]">{formatMoney(cart.pricing.delivery_fee)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tax + service</span>
                        <span className="font-medium text-[#374151]">
                          {formatMoney(cart.pricing.tax_amount + cart.pricing.service_fee)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
                        <span className="text-[14px] font-bold text-[#111827]">Total</span>
                        <span className="text-[15px] font-bold text-[#111827]">{formatMoney(cart.pricing.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
