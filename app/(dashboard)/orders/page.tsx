"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock3, MapPin, ReceiptText, ShoppingBag, Truck } from "lucide-react";
import { GoogleMap, MarkerF, PolylineF } from "@react-google-maps/api";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { config } from "@/lib/config";
import { apiFetch } from "@/lib/http";
import { ORDER_EVENT_NAME, type OrderNotificationPayload } from "@/lib/web-push";
import { Modal } from "@/components/ui/modal";

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
  toPay: "bg-[#6c757d]",
  placed: "bg-[#0d84ff]",
  preparing: "bg-[#f5b800]",
  rider_assigned: "bg-[#8b5cf6]",
  picked_up: "bg-[#f97316]",
  delivered: "bg-[#25b546]",
  cancelled: "bg-[#e53e4f]",
};

function formatMoney(value: number) {
  return `Rs. ${value.toFixed(2)}`;
}

function formatStatus(status: OrderStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function OrderTrackingMap({ order, customerLocation }: { order: CustomerOrder; customerLocation: { lat: number; lng: number } | null }) {
  const { isLoaded } = useGoogleMaps();
  const [routePath, setRoutePath] = useState<Array<{ lat: number; lng: number }>>([]);
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
  const center = rider ?? customerLocation ?? destination ?? restaurant;
  const trackingDestination = customerLocation ?? destination;
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

  if (!rider && !customerLocation) {
    return (
      <div className="rounded-[18px] border border-[#efe4d8] bg-[#eff3f7] px-4 py-10 text-center text-sm text-[#6b7280]">
        Live rider location will appear here after the rider&apos;s GPS is available.
      </div>
    );
  }

  if (!center || !isLoaded) return null;

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#efe4d8]">
      <div className="flex items-center justify-between bg-white px-4 py-3">
        <p className="text-sm font-semibold text-[#1f2937]">Live delivery location</p>
        <p className="text-xs text-[#6b7280]">{rider ? `Rider: ${order.rider?.full_name}` : "Waiting for rider GPS"}</p>
      </div>
      <GoogleMap mapContainerStyle={{ width: "100%", height: "360px" }} center={center} zoom={rider ? 14 : 13} options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: true, zoomControl: true }}>
        {routePath.length > 1 ? <PolylineF path={routePath} options={{ strokeColor: "#e8505b", strokeOpacity: 0.9, strokeWeight: 5 }} /> : null}
        {restaurant ? <MarkerF position={restaurant} label="R" title="Restaurant" /> : null}
        {destination ? <MarkerF position={destination} label="D" title="Delivery address" /> : null}
        {rider ? <MarkerF position={rider} label="Rider" title={order.rider?.full_name ?? "Rider"} /> : null}
        {customerLocation ? <MarkerF position={customerLocation} label="You" title="Your location" /> : null}
      </GoogleMap>
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

  const expandedOrder = orders.find((order) => order.id === expandedOrderId) ?? null;

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
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />
      <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-10 lg:px-10">
        <section className="flex flex-col gap-5 rounded-[28px] border border-[#efe4d8] bg-white px-7 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.06)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">My Orders</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1f2937]">
              Track every placed order in one place.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6b7280]">
              This page is the customer-facing order inbox. When the merchant marks an order
              preparing, delivered, or cancelled, the status should update here too.
            </p>
          </div>
          <Link href="/restaurants">
            <Button>Browse restaurants</Button>
          </Link>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "All", value: summary.total, icon: ReceiptText },
            { label: "Placed", value: summary.placed, icon: ShoppingBag },
            { label: "Preparing", value: summary.preparing, icon: Clock3 },
            { label: "Delivered", value: summary.delivered, icon: Truck },
            { label: "Cancelled", value: summary.cancelled, icon: MapPin },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="border-[#efe4d8] bg-white">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4ec]">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-[#6b7280]">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-[#1f2937]">{item.value}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {error ? (
          <div className="rounded-[18px] border border-[#ffd8cc] bg-[#fff4ef] px-5 py-4 text-sm text-[#9a3412]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <Card className="border-[#efe4d8]">
            <CardContent className="text-sm text-[#6b7280]">Loading your orders...</CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card className="border-[#efe4d8] bg-white">
            <CardContent className="space-y-3">
              <h2 className="text-xl font-semibold text-[#1f2937]">No orders yet</h2>
              <p className="text-sm leading-7 text-[#6b7280]">
                Once you place an order, it will appear here and update automatically as the restaurant changes the status.
              </p>
              <Link href="/restaurants">
                <Button>Order now</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5">
            {orders.map((order) => (
              <Card key={order.orderNumber} className="border-[#efe4d8] bg-white">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                        {order.orderNumber}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-[#1f2937]">
                        {order.restaurantName}
                      </h2>
                      <p className="mt-2 text-sm text-[#6b7280]">
                        {order.address?.address_text ?? "No delivery address captured."}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => setExpandedOrderId(order.id)}
                      >
                        Order details
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      {order.status === "delivered" ? (
                        <Link href={`/restaurants/${order.restaurantSlug}?order_id=${order.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            Leave a review
                          </Button>
                        </Link>
                      ) : null}
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${STATUS_TONE[order.status]}`}>
                        {formatStatus(order.status)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm text-[#6b7280] md:grid-cols-2 xl:grid-cols-4">
                    <p className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-primary" />
                      {order.deliveryTime}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {order.paymentMethod ?? "cash"}
                    </p>
                    <p className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-primary" />
                      {order.items.length} item{order.items.length === 1 ? "" : "s"}
                    </p>
                    <p className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      {formatMoney(order.totalPrice)}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-[#efe4d8] bg-[#fcfcfd] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#1f2937]">Timeline</p>
                      <p className="text-xs text-[#6b7280]">Live status from merchant</p>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {order.timeline.map((event) => (
                        <div key={event.key} className="flex items-start gap-3">
                          <span
                            className={`mt-1 h-2.5 w-2.5 rounded-full ${
                              event.state === "completed"
                                ? "bg-[#25b546]"
                                : event.state === "current"
                                  ? "bg-primary"
                                  : event.state === "cancelled"
                                    ? "bg-[#e53e4f]"
                                    : "bg-[#d1d5db]"
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium text-[#1f2937]">{event.label}</p>
                            <p className="text-xs text-[#6b7280]">
                              {event.description ?? event.timestamp ?? "Pending"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Modal
        isOpen={Boolean(expandedOrder)}
        onClose={() => setExpandedOrderId(null)}
        title={expandedOrder ? `Order ${expandedOrder.orderNumber}` : "Order details"}
      >
        {expandedOrder ? (
          <div className="space-y-5 p-5">
            <div className="rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-[#1f2937]">{expandedOrder.restaurantName}</p>
                  <p className="mt-1 text-sm text-[#6b7280]">{expandedOrder.address?.address_text ?? "Delivery address unavailable"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${STATUS_TONE[expandedOrder.status]}`}>
                  {formatStatus(expandedOrder.status)}
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm font-semibold text-[#1f2937]">Items</p>
              <div className="mt-3 space-y-2 text-sm text-[#6b7280]">
                {expandedOrder.items.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex justify-between gap-4">
                    <span>{item.quantity} × {item.name}</span>
                    <span>{formatMoney(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between border-t border-[#efe4d8] pt-3 font-semibold text-[#1f2937]">
                <span>Total</span><span>{formatMoney(expandedOrder.totalPrice)}</span>
              </div>
            </div>
            {expandedOrder.status !== "delivered" && expandedOrder.status !== "cancelled" ? (
              <OrderTrackingMap order={expandedOrder} customerLocation={customerLocation} />
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
