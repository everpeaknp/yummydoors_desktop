"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, CircleX, PencilLine, Send } from "lucide-react";

import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { extractApiErrorMessage } from "@/lib/api-utils";
import { apiFetch } from "@/lib/http";
import { config } from "@/lib/config";
import { loadStoredAuth } from "@/lib/auth-storage";

type OrderStatus = "toPay" | "placed" | "preparing" | "picked_up" | "delivered" | "cancelled";

type OrderItem = {
  name: string;
  price: number;
  quantity: number;
};

type MerchantOrder = {
  id: number;
  orderNumber: string;
  restaurantName: string;
  customerName: string;
  date: string;
  status: OrderStatus;
  totalPrice: number;
  items: OrderItem[];
  riderAssignedAt: string | null;
  rider: { full_name: string } | null;
};

type RiderCandidate = {
  id: number;
  full_name: string;
  phone: string | null;
  rider_work_mode: string;
  is_accepting_offers: boolean;
  busy: boolean;
};

const STATUS_META: Record<
  OrderStatus,
  { label: string; tone: string; nextActions: Array<{ label: string; nextStatus: OrderStatus }> }
> = {
  toPay: {
    label: "To Pay",
    tone: "bg-[#6c757d]",
    nextActions: [{ label: "Mark placed", nextStatus: "placed" }],
  },
  placed: {
    label: "Placed",
    tone: "bg-[#0d84ff]",
    nextActions: [
      { label: "Start preparing", nextStatus: "preparing" },
      { label: "Cancel order", nextStatus: "cancelled" },
    ],
  },
  preparing: {
    label: "Preparing",
    tone: "bg-[#f5b800]",
    nextActions: [
      { label: "Mark delivered", nextStatus: "delivered" },
      { label: "Cancel order", nextStatus: "cancelled" },
    ],
  },
  picked_up: {
    label: "Picked up",
    tone: "bg-[#8b5cf6]",
    nextActions: [],
  },
  delivered: {
    label: "Delivered",
    tone: "bg-[#25b546]",
    nextActions: [],
  },
  cancelled: {
    label: "Cancelled",
    tone: "bg-[#e53e4f]",
    nextActions: [],
  },
};

function formatMoney(value: number) {
  return `Rs. ${value.toFixed(2)}`;
}

function formatOrderDate(date: string) {
  return date || "Unknown";
}

function getStatusMeta(status: string) {
  return STATUS_META[status as OrderStatus] ?? {
    label: status.replaceAll("_", " "),
    tone: "bg-[#6c757d]",
    nextActions: [],
  };
}

export default function MerchantOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const orderId = Number(params?.id);
  const merchantWorkspaceReady = user?.activeWorkspace?.workspaceType === "merchant";

  const [order, setOrder] = useState<MerchantOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [riderCandidates, setRiderCandidates] = useState<RiderCandidate[]>([]);
  const [riderPanelOpen, setRiderPanelOpen] = useState(false);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [assigningRiderId, setAssigningRiderId] = useState<number | null>(null);

  const loadOrder = useCallback(async () => {
    if (!Number.isFinite(orderId)) {
      setError("Invalid order id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/orders/merchant/me", { auth: true });
      if (!response.ok) {
        throw new Error("Failed to load orders.");
      }

      const payload = (await response.json()) as MerchantOrder[];
      const nextOrder = payload.find((item) => item.id === orderId) ?? null;
      setOrder(nextOrder);
      if (!nextOrder) {
        setError("Order not found.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load order.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!merchantWorkspaceReady) {
      return;
    }
    const stored = loadStoredAuth();
    if (!stored?.accessToken) {
      return;
    }

    const wsBase = config.apiBaseUrl.replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(
      `${wsBase}${config.apiPrefix}/orders/ws/merchant?token=${stored.accessToken}`,
    );

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { event?: string; order_id?: number; status?: OrderStatus };
        if (msg.event === "order_update" && msg.order_id === orderId && msg.status) {
          setOrder((current) => (current ? { ...current, status: msg.status } : current));
        }
        if (msg.event === "new_order" && msg.order_id === orderId) {
          void loadOrder();
        }
      } catch {
        // Ignore malformed websocket payloads.
      }
    };

    return () => {
      ws.close();
    };
  }, [loadOrder, merchantWorkspaceReady, orderId]);

  const nextActions = useMemo(() => {
    if (!order) {
      return [];
    }
    return getStatusMeta(order.status).nextActions.filter(
      (action) => action.nextStatus !== "delivered" || !order.riderAssignedAt,
    );
  }, [order]);

  async function changeStatus(nextStatus: OrderStatus) {
    if (!order) return;

    setSavingStatus(nextStatus);
    setError(null);
    try {
      const response = await apiFetch(
        `/orders/merchant/${order.id}/status?new_status=${nextStatus}`,
        { method: "PATCH", auth: true },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          extractApiErrorMessage(payload, "Failed to update order status."),
        );
      }

      if (payload) {
        setOrder(payload);
      } else {
        setOrder((current) => (current ? { ...current, status: nextStatus } : current));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update order status.");
    } finally {
      setSavingStatus(null);
    }
  }

  async function openRiderPanel() {
    if (!order) return;
    setRiderPanelOpen(true);
    setLoadingRiders(true);
    setError(null);
    try {
      const response = await apiFetch("/orders/merchant/riders", { auth: true });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload, "Failed to load riders."));
      }
      setRiderCandidates((payload as RiderCandidate[]) ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load riders.");
    } finally {
      setLoadingRiders(false);
    }
  }

  async function assignRider(riderUserId: number) {
    if (!order) return;
    setAssigningRiderId(riderUserId);
    setError(null);
    try {
      const response = await apiFetch(`/orders/merchant/${order.id}/assign-rider`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({ rider_user_id: riderUserId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload, "Failed to assign rider."));
      }
      setOrder(payload as MerchantOrder);
      setRiderPanelOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to assign rider.");
    } finally {
      setAssigningRiderId(null);
    }
  }

  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] font-medium text-[#868e96]">
        <span className="text-[#e53e4f]">Dashboard</span>
        <span className="mx-2">/</span>
        <Link href="/merchant/orders" className="hover:text-[#212529]">
          Orders
        </Link>
        <span className="mx-2">/</span>
        <span>Order detail</span>
      </div>

      {loading ? (
        <div className="rounded border border-[#e9ecef] bg-white px-6 py-10 text-center text-[14px] text-[#868e96]">
          Loading order...
        </div>
      ) : error && !order ? (
        <div className="rounded border border-[#fecdcd] bg-[#fff5f5] px-6 py-5 text-[14px] text-[#c92a2a]">
          {error}
        </div>
      ) : order ? (
        <div className="space-y-6">
          {error ? (
            <div className="rounded border border-[#fecdcd] bg-[#fff5f5] px-6 py-4 text-[14px] text-[#c92a2a]">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-start justify-between gap-4 rounded border border-[#e9ecef] bg-white px-6 py-5 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-[22px] font-semibold text-[#495057]">
                  Order {order.orderNumber}
                </h2>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-bold text-white ${getStatusMeta(order.status).tone}`}
                >
                  {getStatusMeta(order.status).label}
                </span>
              </div>
              <div className="grid gap-2 text-[14px] text-[#868e96] md:grid-cols-2">
                <div>
                  <span className="font-semibold text-[#495057]">Customer: </span>
                  {order.customerName}
                </div>
                <div>
                  <span className="font-semibold text-[#495057]">Restaurant: </span>
                  {order.restaurantName}
                </div>
                <div>
                  <span className="font-semibold text-[#495057]">Date: </span>
                  {formatOrderDate(order.date)}
                </div>
                <div>
                  <span className="font-semibold text-[#495057]">Total: </span>
                  {formatMoney(order.totalPrice)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {nextActions.map((action) => (
                <Button
                  key={action.nextStatus}
                  type="button"
                  disabled={savingStatus !== null}
                  onClick={() => {
                    void changeStatus(action.nextStatus);
                  }}
                >
                  {savingStatus === action.nextStatus ? "Saving..." : action.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/merchant/orders")}
              >
                Back to orders
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-2">
                <PencilLine className="h-4 w-4 text-[#e53e4f]" />
                <h3 className="text-[18px] font-semibold text-[#495057]">Order items</h3>
              </div>

              <table className="w-full text-left text-[14px] text-[#495057]">
                <thead>
                  <tr className="border-b-2 border-[#dee2e6]">
                    <th className="py-3 px-2 font-bold">Item</th>
                    <th className="py-3 px-2 font-bold">Quantity</th>
                    <th className="py-3 px-2 font-bold text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dee2e6]">
                  {order.items.map((item, index) => (
                    <tr key={`${item.name}-${index}`} className="hover:bg-gray-50">
                      <td className="py-4 px-2">{item.name}</td>
                      <td className="py-4 px-2">{item.quantity}</td>
                      <td className="py-4 px-2 text-right font-semibold">
                        {formatMoney(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-[#0d84ff]" />
                  <h3 className="text-[18px] font-semibold text-[#495057]">Workflow</h3>
                </div>
                <p className="text-[14px] text-[#868e96]">
                  Status changes are sent to the backend and will update the live merchant dashboard.
                </p>
                <div className="flex flex-wrap gap-2">
                  {order.status === "placed" ? (
                    <>
                      <Button type="button" onClick={() => void changeStatus("preparing")}>
                        <Check className="h-4 w-4" />
                        Mark preparing
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => void changeStatus("cancelled")}>
                        <CircleX className="h-4 w-4" />
                        Cancel
                      </Button>
                    </>
                  ) : order.status === "preparing" ? (
                    <>
                      {!order.riderAssignedAt ? <Button type="button" onClick={() => void changeStatus("delivered")}>
                          <Check className="h-4 w-4" />
                          Complete in-house
                        </Button> : null}
                      {!order.riderAssignedAt ? <Button type="button" variant="secondary" onClick={() => void openRiderPanel()}>
                          Assign rider
                        </Button> : null}
                      <Button type="button" variant="secondary" onClick={() => void changeStatus("cancelled")}>
                        <CircleX className="h-4 w-4" />
                        Cancel
                      </Button>
                    </>
                  ) : order.status === "toPay" ? (
                    <Button type="button" onClick={() => void changeStatus("placed")}>
                      <Check className="h-4 w-4" />
                      Mark placed
                    </Button>
                  ) : (
                    <p className="text-[14px] text-[#868e96]">No further actions available for this order.</p>
                  )}
                </div>
                {order.rider ? <p className="text-sm text-[#3559A8]">Assigned rider: {order.rider.full_name}</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-6">
                <h3 className="text-[18px] font-semibold text-[#495057]">Summary</h3>
                <div className="flex justify-between text-[14px] text-[#868e96]">
                  <span>Items</span>
                  <span>{order.items.length}</span>
                </div>
                <div className="flex justify-between text-[14px] text-[#868e96]">
                  <span>Status</span>
                  <span className="font-semibold text-[#495057]">
                    {getStatusMeta(order.status).label}
                  </span>
                </div>
                <div className="border-t border-[#e9ecef] pt-3">
                  <div className="flex justify-between text-[14px] font-semibold text-[#495057]">
                    <span>Total</span>
                    <span>{formatMoney(order.totalPrice)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          {riderPanelOpen ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
              <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-lg font-semibold text-[#212529]">Assign rider</h2><p className="text-sm text-[#868e96]">Choose a rider for {order.orderNumber}.</p></div>
                  <button className="text-sm text-[#868e96]" onClick={() => setRiderPanelOpen(false)}>Close</button>
                </div>
                <div className="mt-5 space-y-2">
                  {loadingRiders ? <p className="py-6 text-center text-sm text-[#868e96]">Loading riders...</p> : riderCandidates.map((rider) => <div className="flex items-center justify-between rounded border border-[#e9ecef] p-3" key={rider.id}><div><p className="font-semibold text-[#495057]">{rider.full_name}</p><p className="text-xs text-[#868e96]">{rider.rider_work_mode} · {rider.phone || "No phone"} · {rider.busy ? "Busy" : rider.is_accepting_offers ? "Online" : "Offline"}</p></div><Button type="button" disabled={rider.busy || assigningRiderId !== null} onClick={() => void assignRider(rider.id)}>{assigningRiderId === rider.id ? "Assigning..." : "Assign"}</Button></div>)}
                  {!loadingRiders && riderCandidates.length === 0 ? <p className="py-6 text-center text-sm text-[#868e96]">No eligible riders found.</p> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </MerchantDashboardLayout>
  );
}
