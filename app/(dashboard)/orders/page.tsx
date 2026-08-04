"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Clock3,
  CreditCard,
  MapPin,
  ReceiptText,
  ShoppingBag,
  Star,
  Store,
  X,
} from "lucide-react";
import { GoogleMap, MarkerF, PolylineF } from "@react-google-maps/api";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { useAuth } from "@/hooks/use-auth";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { config } from "@/lib/config";
import { apiFetch } from "@/lib/http";
import { ORDER_EVENT_NAME, type OrderNotificationPayload } from "@/lib/web-push";
import { FALLBACK_RESTAURANT_COVER, isUsableImageUrl } from "@/lib/restaurant-media";

type OrderStatus = "toPay" | "placed" | "preparing" | "rider_assigned" | "picked_up" | "delivered" | "cancelled";

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

type OrderAddress = {
  address_text: string | null;
  recipient_name: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type CustomerOrder = {
  id: number;
  restaurantName: string;
  restaurantSlug: string;
  restaurantTags: string;
  restaurantLogo: string;
  deliveryTime: string;
  status: OrderStatus;
  items: OrderItem[];
  totalPrice: number;
  orderNumber: string;
  paymentMethod: string | null;
  address: OrderAddress | null;
  needsCutlery: boolean;
  cookingRequest: string | null;
  deliveryInstruction: string | null;
  timeline: OrderTimelineEvent[];
  restaurantLatitude?: number | null;
  restaurantLongitude?: number | null;
  rider?: {
    full_name: string;
    current_latitude?: number | null;
    current_longitude?: number | null;
  } | null;
};

const STATUS_TONE: Record<OrderStatus, string> = {
  toPay: "bg-[#6b7280]",
  placed: "bg-[#3b82f6]",
  preparing: "bg-[#f59e0b]",
  rider_assigned: "bg-[#8b5cf6]",
  picked_up: "bg-[#f97316]",
  delivered: "bg-[#16a34a]",
  cancelled: "bg-[#be123c]",
};

const FILTERS: Array<{ key: "all" | OrderStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "placed", label: "Placed" },
  { key: "preparing", label: "Preparing" },
  { key: "rider_assigned", label: "Rider assigned" },
  { key: "picked_up", label: "Picked up" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

function formatMoney(value: number) {
  return `Rs. ${value.toFixed(2)}`;
}

function formatStatus(status: OrderStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function restaurantImage(url: string | null | undefined) {
  return isUsableImageUrl(url) ? (url as string) : FALLBACK_RESTAURANT_COVER;
}

function OrderTrackingMap({ order, customerLocation }: { order: CustomerOrder; customerLocation: { lat: number; lng: number } | null }) {
  const { isLoaded } = useGoogleMaps();
  const [routePath, setRoutePath] = useState<Array<{ lat: number; lng: number }>>([]);
  const mapRef = useRef<google.maps.Map | null>(null);
  const destination = order.address?.latitude != null && order.address.longitude != null
    ? { lat: order.address.latitude, lng: order.address.longitude }
    : null;
  const restaurant = order.restaurantLatitude != null && order.restaurantLongitude != null
    ? { lat: order.restaurantLatitude, lng: order.restaurantLongitude }
    : null;
  const riderLat = order.rider?.current_latitude ?? null;
  const riderLng = order.rider?.current_longitude ?? null;
  const rider = riderLat != null && riderLng != null
    ? { lat: riderLat, lng: riderLng }
    : null;
  const customer = customerLocation;
  const points = [restaurant, destination, rider, customer].filter(
    (point): point is { lat: number; lng: number } => point != null,
  );
  const center = rider ?? destination ?? restaurant ?? { lat: 28.2096, lng: 83.9856 };
  const trackingDestination = destination;
  const trackingDestinationLat = trackingDestination?.lat ?? null;
  const trackingDestinationLng = trackingDestination?.lng ?? null;

  useEffect(() => {
    if (riderLat == null || riderLng == null || trackingDestinationLat == null || trackingDestinationLng == null) {
      setRoutePath([]);
      return;
    }

    let cancelled = false;
    const routeUrl = `https://router.project-osrm.org/route/v1/walking/${riderLng},${riderLat};${trackingDestinationLng},${trackingDestinationLat}?overview=full&geometries=geojson`;
    void fetch(routeUrl)
      .then((response) => response.json())
      .then((payload) => {
        const coordinates = payload?.routes?.[0]?.geometry?.coordinates;
        if (!cancelled && Array.isArray(coordinates)) {
          setRoutePath(coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })));
        }
      })
      .catch(() => {
        if (!cancelled) setRoutePath([]);
      });

    return () => { cancelled = true; };
  }, [riderLat, riderLng, trackingDestinationLat, trackingDestinationLng]);

  useEffect(() => {
    if (!mapRef.current || points.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds, 64);
  }, [points]);

  if (!isLoaded || points.length === 0) {
    return (
      <div className="rounded-[18px] border border-[#efe4d8] bg-[#eff3f7] px-4 py-10 text-center text-sm text-[#6b7280]">
        Location data is not available for this order yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#efe4d8]">
      <div className="flex items-center justify-between bg-white px-4 py-3">
        <p className="text-sm font-semibold text-[#1f2937]">Live delivery location</p>
        <p className="text-xs text-[#6b7280]">{rider ? `Rider: ${order.rider?.full_name}` : "Waiting for rider GPS"}</p>
      </div>
      <GoogleMap mapContainerStyle={{ width: "100%", height: "360px" }} center={center} zoom={14} onLoad={(map) => { mapRef.current = map; }} onUnmount={() => { mapRef.current = null; }} options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: true, zoomControl: true }}>
        {routePath.length > 1 ? <PolylineF path={routePath} options={{ strokeColor: "#e8505b", strokeOpacity: 0.9, strokeWeight: 5 }} /> : null}
        {restaurant ? <MarkerF position={restaurant} label="R" title="Restaurant pickup" /> : null}
        {destination ? <MarkerF position={destination} label="D" title="Customer delivery address" /> : null}
        {rider ? <MarkerF position={rider} label="🚴" title={order.rider?.full_name ?? "Live rider"} /> : null}
        {customer ? <MarkerF position={customer} label="You" title="Your current location" /> : null}
      </GoogleMap>
      <div className="flex flex-wrap gap-4 bg-white px-4 py-3 text-xs text-[#6b7280]">
        <span><strong className="text-[#1f2937]">R</strong> Restaurant</span>
        <span><strong className="text-[#1f2937]">D</strong> Customer delivery</span>
        <span><strong className="text-[#1f2937]">🚴</strong> Live rider</span>
        <span><strong className="text-[#1f2937]">You</strong> Current device location</span>
      </div>
    </div>
  );
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { hydrated, accessToken } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");

  const expandedOrder = orders.find((order) => order.id === expandedOrderId) ?? null;
  const visibleOrders = statusFilter === "all" ? orders : orders.filter((order) => order.status === statusFilter);

  useEffect(() => {
    if (!expandedOrderId || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => setCustomerLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setCustomerLocation(null),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [expandedOrderId]);

  const loadOrders = useCallback(async () => {
    const response = await apiFetch("/orders", { auth: true });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        typeof payload?.detail === "string"
          ? payload.detail
          : typeof payload?.message === "string"
            ? payload.message
            : "Failed to load your orders.",
      );
    }
    return Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function refreshOrders() {
      setLoading(true);
      setError(null);
      try {
        const nextOrders = await loadOrders();
        if (!cancelled) {
          setOrders(nextOrders);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load your orders.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void refreshOrders();

    return () => {
      cancelled = true;
    };
  }, [accessToken, hydrated, loadOrders, router]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadOrders()
        .then((nextOrders) => setOrders(nextOrders))
        .catch(() => {});
    }, 15000);

    return () => window.clearInterval(timer);
  }, [accessToken, loadOrders]);

  useEffect(() => {
    if (!accessToken || !expandedOrderId) return;

    const wsBase = config.apiBaseUrl.replace("https://", "wss://").replace("http://", "ws://");
    const socket = new WebSocket(`${wsBase}${config.apiPrefix}/orders/ws/customer?token=${accessToken}`);
    const refreshTimer = window.setInterval(() => {
      void loadOrders().then((nextOrders) => setOrders(nextOrders)).catch(() => {});
    }, 5000);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as OrderNotificationPayload;
        if (payload.event !== "rider_location_update" || payload.order_id !== expandedOrderId) return;
        if (payload.latitude == null || payload.longitude == null) return;
        setOrders((current) => current.map((order) => order.id === expandedOrderId
          ? {
              ...order,
              rider: {
                full_name: order.rider?.full_name ?? "Rider",
                current_latitude: payload.latitude,
                current_longitude: payload.longitude,
              },
            }
          : order));
      } catch {
        // Ignore malformed tracking events.
      }
    };

    return () => {
      window.clearInterval(refreshTimer);
      socket.close();
    };
  }, [accessToken, expandedOrderId, loadOrders]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    function handleOrderEvent(event: Event) {
      const customEvent = event as CustomEvent<OrderNotificationPayload>;
      const detail = customEvent.detail;
      if (!detail?.order_id || (detail.event !== "rider_location_update" && !detail.status)) {
        return;
      }

      setOrders((current) => {
        const hasOrder = current.some((order) => order.id === detail.order_id);
        if (!hasOrder) {
          void loadOrders()
            .then((nextOrders) => setOrders(nextOrders))
            .catch(() => {});
          return current;
        }

        return current.map((order) =>
          order.id === detail.order_id
            ? {
                ...order,
                status: detail.status ? detail.status as OrderStatus : order.status,
                rider: detail.event === "rider_location_update" && detail.latitude != null && detail.longitude != null
                  ? { ...order.rider, full_name: order.rider?.full_name ?? "Rider", current_latitude: detail.latitude, current_longitude: detail.longitude }
                  : order.rider,
              }
            : order,
        );
      });
    }

    window.addEventListener(ORDER_EVENT_NAME, handleOrderEvent as EventListener);
    return () => window.removeEventListener(ORDER_EVENT_NAME, handleOrderEvent as EventListener);
  }, [accessToken, loadOrders]);

  const summary = useMemo(
    () =>
      orders.reduce(
        (acc, order) => {
          acc.total += 1;
          acc[order.status] += 1;
          return acc;
        },
        {
          total: 0,
          toPay: 0,
          placed: 0,
          preparing: 0,
          rider_assigned: 0,
          picked_up: 0,
          delivered: 0,
          cancelled: 0,
        },
      ),
    [orders],
  );

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Preparing orders...</div>;
  }

  if (!accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#fafafb]">
      <SiteNavbar variant="light" />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-6 pb-16 pt-[92px] lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8505b]">My orders</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Order history
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {summary.total} order{summary.total === 1 ? "" : "s"} · status updates live from the restaurant.
            </p>
          </div>
          <Link
            href="/restaurants"
            className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#e8505b] px-4 text-[13px] font-bold text-white transition hover:bg-[#d6414c]"
          >
            Browse restaurants
          </Link>
        </div>

        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => {
            const count = filter.key === "all" ? summary.total : summary[filter.key];
            const active = statusFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  active
                    ? "border-[#e8505b] bg-[#fff5f5] text-[#e8505b]"
                    : "border-gray-200 bg-white text-[#6b7280] hover:border-gray-300"
                }`}
              >
                {filter.label}
                <span className={active ? "text-[#e8505b]" : "text-gray-400"}>{count}</span>
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="rounded-[10px] border border-[#fecdd3] bg-[#fff1f2] px-5 py-4 text-sm text-[#be123c]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="animate-pulse rounded-[10px] border border-[#eceff3] bg-white px-6 py-10 text-sm text-muted-foreground">
            Loading your orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[10px] border border-[#eceff3] bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
              <ReceiptText className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-[#111827]">No orders yet</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              Once you place an order, it will appear here and update automatically as the restaurant changes the status.
            </p>
            <Link
              href="/restaurants"
              className="mt-2 inline-flex h-11 items-center justify-center rounded-[6px] bg-[#e8505b] px-5 text-sm font-bold text-white transition hover:bg-[#d6414c]"
            >
              Order now
            </Link>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-muted-foreground">
            No orders with this status.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleOrders.map((order) => (
              <div key={order.orderNumber} className="overflow-hidden rounded-[10px] border border-[#eceff3] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedOrderId(order.id)}
                  className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition hover:bg-[#fafafa]"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={restaurantImage(order.restaurantLogo)}
                      alt={order.restaurantName}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-bold text-[#111827]">{order.restaurantName}</p>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${STATUS_TONE[order.status]}`}>
                        {formatStatus(order.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {order.orderNumber} · {order.items.length} item{order.items.length === 1 ? "" : "s"} · {formatMoney(order.totalPrice)}
                    </p>
                  </div>

                  <div className="hidden shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
                    <Clock3 className="h-3.5 w-3.5" />
                    {order.deliveryTime}
                  </div>

                  {order.status === "delivered" ? (
                    <Link
                      href={`/restaurants/${order.restaurantSlug}?order_id=${order.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="hidden shrink-0 items-center gap-1.5 rounded-[6px] border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-[#374151] transition hover:bg-gray-50 sm:flex"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Review
                    </Link>
                  ) : null}

                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {expandedOrder ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setExpandedOrderId(null)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[12px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#eceff3] bg-white px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8505b]">
                  Order {expandedOrder.orderNumber}
                </p>
                <h2 className="text-[15px] font-bold text-[#111827]">{expandedOrder.restaurantName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setExpandedOrderId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white ${STATUS_TONE[expandedOrder.status]}`}>
                  {formatStatus(expandedOrder.status)}
                </span>
                <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  {expandedOrder.paymentMethod ?? "cash"}
                </p>
              </div>

              <div className="rounded-[8px] border border-[#eceff3] p-4">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
                  <MapPin className="h-3.5 w-3.5 text-[#9ca3af]" />
                  Delivery address
                </p>
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  {expandedOrder.address?.address_text ?? "Delivery address unavailable"}
                </p>
              </div>

              <div className="rounded-[8px] border border-[#eceff3] p-4">
                <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
                  <ShoppingBag className="h-3.5 w-3.5 text-[#9ca3af]" />
                  Items
                </p>
                <div className="space-y-2 text-[13px]">
                  {expandedOrder.items.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex justify-between gap-4 text-[#374151]">
                      <span>{item.quantity} × {item.name}</span>
                      <span className="font-medium text-[#111827]">{formatMoney(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between border-t border-[#eceff3] pt-3 text-[14px] font-bold text-[#111827]">
                  <span>Total</span><span>{formatMoney(expandedOrder.totalPrice)}</span>
                </div>
              </div>

              <div className="rounded-[8px] border border-[#eceff3] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
                    <Store className="h-3.5 w-3.5 text-[#9ca3af]" />
                    Timeline
                  </p>
                  <p className="text-[11px] text-muted-foreground">Live from merchant</p>
                </div>
                <div className="space-y-3">
                  {expandedOrder.timeline.map((event, index) => (
                    <div key={event.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            event.state === "completed"
                              ? "bg-[#16a34a]"
                              : event.state === "current"
                                ? "bg-[#e8505b]"
                                : event.state === "cancelled"
                                  ? "bg-[#be123c]"
                                  : "bg-[#d1d5db]"
                          }`}
                        />
                        {index < expandedOrder.timeline.length - 1 ? (
                          <span className="mt-1 h-5 w-px bg-gray-200" />
                        ) : null}
                      </div>
                      <div className="pb-0.5">
                        <p className="text-[13px] font-medium text-[#111827]">{event.label}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {event.description ?? event.timestamp ?? "Pending"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {expandedOrder.status !== "delivered" && expandedOrder.status !== "cancelled" ? (
                <OrderTrackingMap order={expandedOrder} customerLocation={customerLocation} />
              ) : null}

              {expandedOrder.status === "delivered" ? (
                <Link
                  href={`/restaurants/${expandedOrder.restaurantSlug}?order_id=${expandedOrder.id}`}
                  className="flex h-11 items-center justify-center gap-2 rounded-[6px] border border-gray-200 text-[13px] font-semibold text-[#374151] transition hover:bg-gray-50"
                >
                  <Star className="h-4 w-4" />
                  Leave a review
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
