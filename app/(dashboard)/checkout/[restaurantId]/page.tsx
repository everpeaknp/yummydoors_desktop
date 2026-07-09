"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Receipt, ShoppingBag } from "lucide-react";

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

type Address = {
  id: number;
  label: string | null;
  address_summary: string;
  recipient_name: string;
  phone_number: string;
  is_default: boolean;
};

type OrderItem = {
  name: string;
  price: number;
  quantity: number;
};

type OrderTimelineEvent = {
  key: string;
  label: string;
  state: string;
  timestamp: string | null;
  description: string | null;
};

type OrderResponse = {
  id: number;
  restaurantId?: number;
  restaurantName: string;
  restaurantTags: string;
  restaurantLogo: string;
  deliveryTime: string;
  status: string;
  items: OrderItem[];
  totalPrice: number;
  orderNumber: string;
  paymentMethod: string | null;
  pricing: CartPricing;
  timeline: OrderTimelineEvent[];
  address: {
    id: number | null;
    recipient_name: string | null;
    phone_number: string | null;
    address_text: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  needsCutlery: boolean;
  cookingRequest: string | null;
  deliveryInstruction: string | null;
};

function formatMoney(value: number) {
  return `NPR ${value.toFixed(2)}`;
}

function normalizePaymentMethod(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function wasPlacedRecently(order: OrderResponse, withinMinutes = 5) {
  const placedAt = order.timeline.find((event) => event.key === "placed")?.timestamp;
  if (!placedAt) {
    return false;
  }

  const placedTime = Date.parse(placedAt);
  if (Number.isNaN(placedTime)) {
    return false;
  }

  return Math.abs(Date.now() - placedTime) <= withinMinutes * 60_000;
}

function matchesRecoveredCheckoutOrder(
  order: OrderResponse,
  checkoutCart: Cart,
  addressId: number | null,
  selectedPaymentMethod: string,
) {
  const restaurantMatches =
    order.restaurantId === checkoutCart.restaurant_id ||
    order.restaurantName.trim().toLowerCase() === checkoutCart.restaurant_name.trim().toLowerCase();
  const totalMatches = Math.abs(order.totalPrice - checkoutCart.total_price) < 0.01;
  const addressMatches = addressId == null || order.address?.id == null || order.address.id === addressId;
  const paymentMatches =
    !order.paymentMethod ||
    normalizePaymentMethod(order.paymentMethod) === normalizePaymentMethod(selectedPaymentMethod);

  return restaurantMatches && totalMatches && addressMatches && paymentMatches;
}

export default function CheckoutPage() {
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = Number(params?.restaurantId);

  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [couponCode, setCouponCode] = useState("");
  const [needsCutlery, setNeedsCutlery] = useState(true);
  const [cookingRequest, setCookingRequest] = useState("");
  const [deliveryInstruction, setDeliveryInstruction] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartMissing, setCartMissing] = useState(false);
  const [successOrder, setSuccessOrder] = useState<OrderResponse | null>(null);

  const loadCheckoutState = useCallback(async () => {
    if (!Number.isFinite(restaurantId)) {
      setError("Invalid restaurant cart.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setCartMissing(false);

    const [cartResponse, addressesResponse] = await Promise.all([
      apiFetch(`/carts/${restaurantId}`, { auth: true }),
      apiFetch("/me/addresses", { auth: true }),
    ]);

    const cartPayload = await readJsonSafely<Cart>(cartResponse);
    const addressesPayload = await readJsonSafely(addressesResponse);

    if (cartResponse.status === 404) {
      setCart(null);
      setAddresses([]);
      setSelectedAddressId(null);
      setCouponCode("");
      setNeedsCutlery(true);
      setCookingRequest("");
      setDeliveryInstruction("");
      setCartMissing(true);
      setLoading(false);
      return;
    }

    if (!cartResponse.ok) {
      setLoading(false);
      setError(extractApiErrorMessage(cartPayload, "Failed to load checkout cart."));
      return;
    }

    if (!addressesResponse.ok) {
      setLoading(false);
      setError(extractApiErrorMessage(addressesPayload, "Failed to load saved addresses."));
      return;
    }

    const nextCart = cartPayload;
    const nextAddresses = Array.isArray(addressesPayload)
      ? addressesPayload
      : Array.isArray((addressesPayload as { data?: unknown } | null)?.data)
        ? ((addressesPayload as { data: Address[] }).data ?? [])
        : [];

    setCart(nextCart);
    setAddresses(nextAddresses);
    setSelectedAddressId(
      nextCart?.address?.id ??
        nextAddresses.find((item) => item.is_default)?.id ??
        nextAddresses[0]?.id ??
        null,
    );
    setCouponCode(nextCart?.coupon_code ?? "");
    setNeedsCutlery(nextCart?.needs_cutlery ?? true);
    setCookingRequest(nextCart?.cooking_request ?? "");
    setDeliveryInstruction(nextCart?.delivery_instruction ?? "");
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void loadCheckoutState();
  }, [loadCheckoutState]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  async function recoverCheckoutOrder(checkoutCart: Cart) {
    const response = await apiFetch("/orders", { auth: true });
    const payload = await readJsonSafely<OrderResponse[]>(response);
    if (!response.ok || !Array.isArray(payload)) {
      return null;
    }

    return (
      payload.find(
        (order) =>
          matchesRecoveredCheckoutOrder(order, checkoutCart, selectedAddressId, paymentMethod) &&
          wasPlacedRecently(order),
      ) ?? null
    );
  }

  async function saveCartContext() {
    if (!cart) {
      return false;
    }

    const response = await apiFetch(`/carts/${cart.restaurant_id}/context`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({
        address_id: selectedAddressId,
        needs_cutlery: needsCutlery,
        cooking_request: cookingRequest.trim() || null,
        delivery_instruction: deliveryInstruction.trim() || null,
      }),
    });
    const payload = await readJsonSafely<Cart>(response);
    if (!response.ok) {
      setError(extractApiErrorMessage(payload, "Failed to save checkout details."));
      return false;
    }

    if (payload) {
      setCart(payload);
    }
    return true;
  }

  async function syncCoupon() {
    if (!cart) {
      return false;
    }

    if (!couponCode.trim()) {
      const response = await apiFetch(`/carts/${cart.restaurant_id}/coupon`, {
        method: "DELETE",
        auth: true,
      });
      if (response.ok) {
        const payload = await readJsonSafely<Cart>(response);
        if (payload) setCart(payload);
        return true;
      }

      const payload = await readJsonSafely(response);
      setError(extractApiErrorMessage(payload, "Failed to clear coupon."));
      return false;
    }

    const response = await apiFetch(`/carts/${cart.restaurant_id}/coupon`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ coupon_code: couponCode }),
    });
    const payload = await readJsonSafely<Cart>(response);
    if (!response.ok) {
      setError(extractApiErrorMessage(payload, "Failed to apply coupon."));
      return false;
    }

    if (payload) {
      setCart(payload);
      setCouponCode(payload.coupon_code ?? couponCode);
    }
    return true;
  }

  async function handleCheckout() {
    if (!cart) {
      return;
    }

    setPlacingOrder(true);
    setError(null);

    const contextSaved = await saveCartContext();
    if (!contextSaved) {
      setPlacingOrder(false);
      return;
    }

    const couponSynced = await syncCoupon();
    if (!couponSynced) {
      setPlacingOrder(false);
      return;
    }

    const response = await apiFetch(`/orders/checkout/${cart.id}`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        payment_method: paymentMethod,
        address_id: selectedAddressId,
        coupon_code: couponCode.trim() || null,
        needs_cutlery: needsCutlery,
        cooking_request: cookingRequest.trim() || null,
        delivery_instruction: deliveryInstruction.trim() || null,
      }),
    });
    const payload = await readJsonSafely<OrderResponse>(response);
    if (!response.ok) {
      if (response.status >= 500) {
        const recoveredOrder = await recoverCheckoutOrder(cart);
        if (recoveredOrder) {
          setPlacingOrder(false);
          setSuccessOrder(recoveredOrder);
          window.dispatchEvent(new CustomEvent("yummydoors:cart-updated"));
          return;
        }
      }

      setPlacingOrder(false);
      setError(extractApiErrorMessage(payload, "Failed to place order."));
      return;
    }

    setPlacingOrder(false);
    setSuccessOrder(payload);
    window.dispatchEvent(new CustomEvent("yummydoors:cart-updated"));
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />

      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Checkout
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
            Confirm delivery details
          </h1>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-border bg-white px-6 py-10 text-sm text-muted-foreground">
            Loading checkout...
          </div>
        ) : cartMissing ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-4 py-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Checkout cart
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-foreground">
                  Cart no longer active
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  This restaurant does not have an active cart right now. Add items again from the restaurant page or return to your cart list.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/cart">
                  <Button>Return to cart</Button>
                </Link>
                <Link href="/restaurants">
                  <Button variant="secondary">Browse restaurants</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <div className="rounded-3xl border border-[#fbcfe8] bg-[#fff1f2] px-6 py-5 text-sm text-[#be123c]">
            {error}
          </div>
        ) : successOrder ? (
          <Card>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Order placed
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-foreground">
                  Order #{successOrder.orderNumber}
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  {successOrder.restaurantName} is now processing your order.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-[#fcfcfd] p-4">
                  <p className="text-sm font-semibold text-foreground">Delivery address</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {successOrder.address?.address_text ?? "Address not captured"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-[#fcfcfd] p-4">
                  <p className="text-sm font-semibold text-foreground">Payment</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {successOrder.paymentMethod ?? "cash"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-[#fcfcfd] p-4">
                <p className="text-sm font-semibold text-foreground">Timeline</p>
                <div className="mt-4 space-y-3">
                  {successOrder.timeline.map((event) => (
                    <div key={event.key} className="flex items-start gap-3">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${event.state === "completed" ? "bg-[#16a34a]" : event.state === "current" ? "bg-primary" : "bg-[#d1d5db]"}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{event.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.description ?? event.timestamp ?? "Pending"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Link href="/restaurants">
                  <Button>Continue browsing</Button>
                </Link>
                <Link href="/cart">
                  <Button variant="secondary">Back to carts</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : cart ? (
          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <Card>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Delivery address
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-foreground">
                      Where should we send this order?
                    </h2>
                  </div>

                  {addresses.length ? (
                    <div className="grid gap-3">
                      {addresses.map((address) => (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => setSelectedAddressId(address.id)}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            selectedAddressId === address.id
                              ? "border-[#ffb085] bg-[#fff7f2]"
                              : "border-border bg-[#fcfcfd]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {address.label || address.recipient_name}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {address.address_summary}
                              </p>
                            </div>
                            {address.is_default ? (
                              <span className="rounded-full bg-[#fff5ef] px-3 py-1 text-xs font-semibold text-primary">
                                Default
                              </span>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4 text-sm text-muted-foreground">
                      <p>No saved addresses found. Add one from the homepage location flow first.</p>
                      <Link href="/" className="mt-3 inline-flex">
                        <Button variant="secondary" className="h-10 px-3">
                          Add address
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Order preferences
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-foreground">
                      Final instructions for the kitchen and rider
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setNeedsCutlery((current) => !current)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        needsCutlery
                          ? "border-[#ffb085] bg-[#fff7f2] text-primary"
                          : "border-border bg-white text-[#4b5563]"
                      }`}
                    >
                      {needsCutlery ? "Cutlery included" : "No cutlery"}
                    </button>
                  </div>

                  <Input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    placeholder="Coupon code"
                    className="rounded-2xl"
                  />

                  <textarea
                    rows={4}
                    value={cookingRequest}
                    onChange={(event) => setCookingRequest(event.target.value)}
                    placeholder="Cooking request"
                    className="w-full resize-none rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />

                  <textarea
                    rows={4}
                    value={deliveryInstruction}
                    onChange={(event) => setDeliveryInstruction(event.target.value)}
                    placeholder="Delivery instruction"
                    className="w-full resize-none rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        {cart.restaurant_name}
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold text-foreground">
                        Order summary
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.quantity} x {formatMoney(item.price)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {formatMoney(item.quantity * item.price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-border bg-[#fcfcfd] p-4 text-sm">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground">Items total</span>
                      <span className="font-medium text-foreground">{formatMoney(cart.pricing.items_total)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground">Coupon discount</span>
                      <span className="font-medium text-foreground">- {formatMoney(cart.pricing.coupon_discount)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground">Delivery fee</span>
                      <span className="font-medium text-foreground">{formatMoney(cart.pricing.delivery_fee)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium text-foreground">{formatMoney(cart.pricing.tax_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground">Service fee</span>
                      <span className="font-medium text-foreground">{formatMoney(cart.pricing.service_fee)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <span className="text-base font-semibold text-foreground">Total</span>
                      <span className="text-lg font-semibold text-foreground">{formatMoney(cart.pricing.total_amount)}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-[#fcfcfd] p-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">Delivering to</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedAddress?.address_summary ?? "No address selected"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-[#fcfcfd] p-4">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">Payment method</p>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {["cash", "card", "wallet"].map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                            paymentMethod === method
                              ? "border-[#ffb085] bg-[#fff7f2] text-primary"
                              : "border-border bg-white text-[#4b5563]"
                          }`}
                        >
                          {method.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      void handleCheckout();
                    }}
                    disabled={placingOrder || !selectedAddressId}
                    className="w-full"
                  >
                    {placingOrder ? "Placing order..." : "Place order"}
                  </Button>

                  <Link href="/cart" className="block text-center text-sm font-medium text-muted-foreground hover:text-primary">
                    Back to carts
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
