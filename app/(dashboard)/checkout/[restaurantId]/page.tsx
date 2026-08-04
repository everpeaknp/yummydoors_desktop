"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  MapPin,
  MessageSquareText,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
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
  latitude: number | null;
  longitude: number | null;
};

const LOCATION_STORAGE_KEY = "yummydoors.selectedLocation";

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
  const [checkoutAddressChosen, setCheckoutAddressChosen] = useState(false);
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
  const [latestLocation, setLatestLocation] = useState<{ lat: number; lng: number } | null>(null);

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

    try {
      const stored = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      if (Number.isFinite(parsed?.coords?.lat) && Number.isFinite(parsed?.coords?.lng)) {
        setLatestLocation({ lat: parsed.coords.lat, lng: parsed.coords.lng });
      }
    } catch {
      setLatestLocation(null);
    }

    setCart(nextCart);
    setAddresses(nextAddresses);
    setSelectedAddressId(
      nextAddresses.find((item) => item.is_default)?.id ??
        nextCart?.address?.id ??
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
        latitude: checkoutAddressChosen ? selectedAddress?.latitude ?? null : latestLocation?.lat ?? selectedAddress?.latitude ?? null,
        longitude: checkoutAddressChosen ? selectedAddress?.longitude ?? null : latestLocation?.lng ?? selectedAddress?.longitude ?? null,
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
    <div className="min-h-screen bg-[#fafafb]">
      <SiteNavbar variant="light" />

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-[92px] lg:px-10">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/cart"
            className="inline-flex h-9 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to cart
          </Link>

          {!loading && !cartMissing && !error && !successOrder ? (
            <ol className="hidden items-center gap-2 text-[12px] font-semibold text-muted-foreground sm:flex">
              <li className="flex items-center gap-1.5 text-[#e8505b]">
                <CheckCircle2 className="h-4 w-4" />
                Cart
              </li>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
              <li className="flex items-center gap-1.5 text-[#111827]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e8505b] text-[9px] text-white">2</span>
                Checkout
              </li>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
              <li className="flex items-center gap-1.5 text-gray-400">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[9px]">3</span>
                Confirmation
              </li>
            </ol>
          ) : null}
        </div>

        {loading ? (
          <div className="animate-pulse rounded-[10px] border border-[#eceff3] bg-white px-6 py-10 text-sm text-muted-foreground">
            Loading checkout...
          </div>
        ) : cartMissing ? (
          <div className="mx-auto max-w-lg rounded-[10px] border border-[#eceff3] bg-white px-8 py-12 text-center shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[#111827]">Cart no longer active</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This restaurant does not have an active cart right now. Add items again from the restaurant page or return to your cart list.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/cart"
                className="inline-flex h-11 items-center justify-center rounded-[6px] bg-[#e8505b] px-5 text-sm font-bold text-white transition hover:bg-[#d6414c]"
              >
                Return to cart
              </Link>
              <Link
                href="/restaurants"
                className="inline-flex h-11 items-center justify-center rounded-[6px] border border-gray-200 px-5 text-sm font-semibold text-[#374151] transition hover:bg-gray-50"
              >
                Browse restaurants
              </Link>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-[10px] border border-[#fecdd3] bg-[#fff1f2] px-6 py-5 text-sm text-[#be123c]">
            {error}
          </div>
        ) : successOrder ? (
          <div className="mx-auto max-w-2xl">
            <div className="rounded-[10px] border border-[#eceff3] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col items-center gap-3 border-b border-[#eceff3] px-8 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ecfdf3] text-[#16a34a]">
                  <Check className="h-8 w-8" strokeWidth={3} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8505b]">
                  Order placed
                </p>
                <h2 className="text-2xl font-semibold text-[#111827]">
                  Order #{successOrder.orderNumber}
                </h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {successOrder.restaurantName} is now processing your order.
                </p>
              </div>

              <div className="space-y-6 px-8 py-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-[#eceff3] bg-[#fafafa] p-4">
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
                      <MapPin className="h-4 w-4 text-[#9ca3af]" />
                      Delivery address
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {successOrder.address?.address_text ?? "Address not captured"}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#eceff3] bg-[#fafafa] p-4">
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
                      <CreditCard className="h-4 w-4 text-[#9ca3af]" />
                      Payment
                    </p>
                    <p className="mt-2 text-sm capitalize text-muted-foreground">
                      {successOrder.paymentMethod ?? "cash"}
                    </p>
                  </div>
                </div>

                <div className="rounded-[8px] border border-[#eceff3] p-5">
                  <p className="text-[13px] font-semibold text-[#111827]">Order timeline</p>
                  <div className="mt-4 space-y-4">
                    {successOrder.timeline.map((event, index) => (
                      <div key={event.key} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full ${
                              event.state === "completed"
                                ? "bg-[#16a34a] text-white"
                                : event.state === "current"
                                  ? "bg-[#e8505b] text-white"
                                  : "border border-gray-300 bg-white"
                            }`}
                          >
                            {event.state === "completed" ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                          </span>
                          {index < successOrder.timeline.length - 1 ? (
                            <span className="mt-1 h-6 w-px bg-gray-200" />
                          ) : null}
                        </div>
                        <div className="pb-1">
                          <p className="text-sm font-medium text-[#111827]">{event.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.description ?? event.timestamp ?? "Pending"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    href="/restaurants"
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-[6px] bg-[#e8505b] px-5 text-sm font-bold text-white transition hover:bg-[#d6414c]"
                  >
                    Continue browsing
                  </Link>
                  <Link
                    href="/orders"
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-[6px] border border-gray-200 px-5 text-sm font-semibold text-[#374151] transition hover:bg-gray-50"
                  >
                    Track order
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : cart ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <section className="rounded-[10px] border border-[#eceff3] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#eceff3] px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <h2 className="text-[15px] font-bold text-[#111827]">Delivery address</h2>
                  </div>
                  <Link href="/profile" className="text-[13px] font-semibold text-[#e8505b] hover:underline">
                    Manage
                  </Link>
                </div>

                <div className="px-6 py-5">
                  {addresses.length ? (
                    <div className="grid gap-3">
                      {addresses.map((address) => {
                        const selected = selectedAddressId === address.id;
                        return (
                          <button
                            key={address.id}
                            type="button"
                            onClick={() => {
                              setSelectedAddressId(address.id);
                              setCheckoutAddressChosen(true);
                            }}
                            className={`rounded-[8px] border px-4 py-3.5 text-left transition ${
                              selected
                                ? "border-[#e8505b] bg-[#fff5f5] ring-1 ring-[#e8505b]"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                                  selected ? "border-[#e8505b] bg-[#e8505b]" : "border-gray-300"
                                }`}
                              >
                                {selected ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} /> : null}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-semibold text-[#111827]">
                                    {address.label || address.recipient_name}
                                  </p>
                                  {address.is_default ? (
                                    <span className="rounded-full bg-[#fff1f2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#e8505b]">
                                      Default
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                                  {address.address_summary}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[8px] border border-dashed border-gray-200 px-4 py-6 text-center">
                      <p className="text-sm text-muted-foreground">No saved addresses found.</p>
                      <Link
                        href="/profile"
                        className="mt-3 inline-flex h-9 items-center justify-center rounded-[6px] border border-gray-200 px-4 text-[13px] font-semibold text-[#374151] hover:bg-gray-50"
                      >
                        Add address
                      </Link>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[10px] border border-[#eceff3] bg-white shadow-sm">
                <div className="flex items-center gap-2.5 border-b border-[#eceff3] px-6 py-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
                    <MessageSquareText className="h-4 w-4" />
                  </span>
                  <h2 className="text-[15px] font-bold text-[#111827]">Order notes</h2>
                </div>

                <div className="space-y-4 px-6 py-5">
                  <button
                    type="button"
                    onClick={() => setNeedsCutlery((current) => !current)}
                    className={`flex w-full items-center justify-between rounded-[8px] border px-4 py-3 text-left transition ${
                      needsCutlery ? "border-[#e8505b] bg-[#fff5f5]" : "border-gray-200 bg-white"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 text-[13px] font-medium text-[#374151]">
                      <UtensilsCrossed className="h-4 w-4 text-[#9ca3af]" />
                      Cutlery
                    </span>
                    <span
                      className={`relative h-5 w-9 rounded-full transition-colors ${needsCutlery ? "bg-[#e8505b]" : "bg-gray-300"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          needsCutlery ? "translate-x-[18px]" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </button>

                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">
                      Cooking request
                    </label>
                    <textarea
                      rows={3}
                      value={cookingRequest}
                      onChange={(event) => setCookingRequest(event.target.value)}
                      placeholder="Less spicy, no onions, etc."
                      className="w-full resize-none rounded-[8px] border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-[#111827] outline-none transition-colors placeholder:text-gray-400 focus:border-[#e8505b] focus:ring-2 focus:ring-[#e8505b]/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">
                      Delivery instruction
                    </label>
                    <textarea
                      rows={3}
                      value={deliveryInstruction}
                      onChange={(event) => setDeliveryInstruction(event.target.value)}
                      placeholder="Gate code, floor, landmark, etc."
                      className="w-full resize-none rounded-[8px] border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-[#111827] outline-none transition-colors placeholder:text-gray-400 focus:border-[#e8505b] focus:ring-2 focus:ring-[#e8505b]/10"
                    />
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:sticky lg:top-[80px] lg:self-start">
              <div className="rounded-[10px] border border-[#eceff3] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-2.5 border-b border-[#eceff3] px-6 py-4">
                  <ShoppingBag className="h-4 w-4 text-[#e8505b]" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {cart.restaurant_name}
                    </p>
                    <h2 className="text-[15px] font-bold text-[#111827]">Order summary</h2>
                  </div>
                </div>

                <div className="max-h-[240px] space-y-3 overflow-y-auto px-6 py-4">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 text-[13px]">
                      <div className="min-w-0">
                        <p className="font-medium text-[#111827]">{item.name}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {item.quantity} × {formatMoney(item.price)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-[#111827]">
                        {formatMoney(item.quantity * item.price)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 border-t border-[#eceff3] px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[#9ca3af]" />
                    <Input
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value)}
                      placeholder="Coupon code"
                      className="h-9 rounded-[6px] text-[13px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-[#eceff3] px-6 py-4 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Items total</span>
                    <span className="font-medium text-[#374151]">{formatMoney(cart.pricing.items_total)}</span>
                  </div>
                  {cart.pricing.coupon_discount > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Coupon discount</span>
                      <span className="font-medium text-[#16a34a]">- {formatMoney(cart.pricing.coupon_discount)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Delivery fee</span>
                    <span className="font-medium text-[#374151]">{formatMoney(cart.pricing.delivery_fee)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium text-[#374151]">{formatMoney(cart.pricing.tax_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Service fee</span>
                    <span className="font-medium text-[#374151]">{formatMoney(cart.pricing.service_fee)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-[#eceff3] pt-2.5">
                    <span className="text-[14px] font-bold text-[#111827]">Total</span>
                    <span className="text-[16px] font-bold text-[#111827]">{formatMoney(cart.pricing.total_amount)}</span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-[#eceff3] px-6 py-4">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
                    <CreditCard className="h-3.5 w-3.5 text-[#9ca3af]" />
                    Payment method
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "cash", label: "Cash", icon: Wallet },
                      { key: "card", label: "Card", icon: CreditCard },
                      { key: "wallet", label: "Wallet", icon: ShoppingBag },
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPaymentMethod(key)}
                        className={`flex flex-col items-center gap-1 rounded-[8px] border px-2 py-2.5 text-[11px] font-semibold transition ${
                          paymentMethod === key
                            ? "border-[#e8505b] bg-[#fff5f5] text-[#e8505b]"
                            : "border-gray-200 text-[#6b7280] hover:border-gray-300"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 px-6 pb-6 pt-2">
                  {!selectedAddressId ? (
                    <p className="text-center text-[12px] text-[#be123c]">Select a delivery address to continue.</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      void handleCheckout();
                    }}
                    disabled={placingOrder || !selectedAddressId}
                    className="flex w-full items-center justify-center gap-2 rounded-[6px] bg-[#e8505b] py-3.5 text-[14px] font-bold text-white transition hover:bg-[#d6414c] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {placingOrder ? "Placing order..." : `Place order · ${formatMoney(cart.pricing.total_amount)}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
