"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, MapPin, ReceiptText, ShoppingBag, Truck } from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import { ORDER_EVENT_NAME, type OrderNotificationPayload } from "@/lib/web-push";

type OrderStatus = "toPay" | "placed" | "preparing" | "delivered" | "cancelled";

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
};

const STATUS_TONE: Record<OrderStatus, string> = {
  toPay: "bg-[#6c757d]",
  placed: "bg-[#0d84ff]",
  preparing: "bg-[#f5b800]",
  delivered: "bg-[#25b546]",
  cancelled: "bg-[#e53e4f]",
};

function formatMoney(value: number) {
  return `Rs. ${value.toFixed(2)}`;
}

function formatStatus(status: OrderStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { hydrated, accessToken } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (!accessToken) {
      return;
    }

    function handleOrderEvent(event: Event) {
      const customEvent = event as CustomEvent<OrderNotificationPayload>;
      const detail = customEvent.detail;
      if (!detail?.order_id || !detail.status) {
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
          order.id === detail.order_id ? { ...order, status: detail.status as OrderStatus } : order,
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
    </div>
  );
}
