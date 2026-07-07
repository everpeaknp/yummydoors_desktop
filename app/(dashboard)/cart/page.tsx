"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, TicketPercent, Trash2 } from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/http";
import { extractApiErrorMessage, readJsonSafely } from "@/lib/api-utils";

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
      return;
    }
    setCarts((current) => current.map((cart) => (cart.restaurant_id === restaurantId ? nextCart : cart)));
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
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />

      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Cart
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
            Checkout-ready carts
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {totalItems} item{totalItems === 1 ? "" : "s"} across {carts.length} restaurant cart{carts.length === 1 ? "" : "s"}.
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-border bg-white px-6 py-10 text-sm text-muted-foreground">
            Loading carts...
          </div>
        ) : (
          <div className="space-y-6">
            {error ? (
              <div className="rounded-3xl border border-[#fbcfe8] bg-[#fff1f2] px-6 py-5 text-sm text-[#be123c]">
                {error}
              </div>
            ) : null}

            {carts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                  <ShoppingCart className="h-10 w-10 text-[#ff6b3d]" />
                  <div>
                    <p className="text-lg font-semibold text-foreground">Your cart is empty</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Add dishes from restaurant detail and they will appear here instantly.
                    </p>
                  </div>
                  <Link href="/restaurants">
                    <Button>Browse restaurants</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              carts.map((cart) => (
                <Card key={cart.id}>
                  <CardContent className="space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                          {cart.eta_text}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-foreground">
                          {cart.restaurant_name}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {cart.address?.address_summary ?? "No delivery address selected yet."}
                        </p>
                      </div>
                      <Link href={`/checkout/${cart.restaurant_id}`}>
                        <Button>Continue to checkout</Button>
                      </Link>
                    </div>

                    <div className="grid gap-4">
                      {cart.items.map((item) => (
                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{item.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{formatMoney(item.price)} each</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity > 1) {
                                  void updateQuantity(cart.restaurant_id, item.id, item.quantity - 1);
                                }
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-foreground"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold text-foreground">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                void updateQuantity(cart.restaurant_id, item.id, item.quantity + 1);
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-foreground"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void removeItem(cart.restaurant_id, item.id);
                              }}
                              className="ml-2 flex h-9 w-9 items-center justify-center rounded-full border border-[#fecdd3] bg-[#fff1f2] text-[#be123c]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                      <div className="rounded-2xl border border-border bg-[#fcfcfd] p-4">
                        <div className="flex items-center gap-2">
                          <TicketPercent className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold text-foreground">Coupon code</p>
                        </div>
                        <div className="mt-3 flex gap-3">
                          <Input
                            value={couponDrafts[cart.restaurant_id] ?? ""}
                            onChange={(event) =>
                              setCouponDrafts((current) => ({
                                ...current,
                                [cart.restaurant_id]: event.target.value,
                              }))
                            }
                            placeholder="FREEDEL or SAVE10"
                            className="h-11 rounded-2xl"
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              void applyCoupon(cart.restaurant_id);
                            }}
                          >
                            Apply
                          </Button>
                          {cart.coupon_code ? (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                void removeCoupon(cart.restaurant_id);
                              }}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-[#fcfcfd] p-4 text-sm">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground">Items</span>
                          <span className="font-medium text-foreground">{formatMoney(cart.pricing.items_total)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground">Coupon</span>
                          <span className="font-medium text-foreground">- {formatMoney(cart.pricing.coupon_discount)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground">Delivery</span>
                          <span className="font-medium text-foreground">{formatMoney(cart.pricing.delivery_fee)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground">Tax + service</span>
                          <span className="font-medium text-foreground">
                            {formatMoney(cart.pricing.tax_amount + cart.pricing.service_fee)}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                          <span className="font-semibold text-foreground">Total</span>
                          <span className="text-lg font-semibold text-foreground">{formatMoney(cart.pricing.total_amount)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
