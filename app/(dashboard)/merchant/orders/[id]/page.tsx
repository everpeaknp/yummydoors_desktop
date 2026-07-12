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

type OrderStatus = "toPay" | "placed" | "preparing" | "delivered" | "cancelled";

type OrderItem = {
  name: string;
  price: number;
  quantity: number;
};

type RiderSummary = {
  id: number;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  busy: boolean;
  assignment_type: string;
  rider_work_mode: string;
  restaurant_ids: number[];
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
  rider?: {
    id: number;
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  riderAssignedAt?: string | null;
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

export default function MerchantOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const orderId = Number(params?.id);
  const merchantWorkspaceReady = user?.activeWorkspace?.workspaceType === "merchant";

  const [order, setOrder] = useState<MerchantOrder | null>(null);
  const [riders, setRiders] = useState<RiderSummary[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<OrderStatus | null>(null);
  const [assigningRider, setAssigningRider] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setSelectedRiderId(nextOrder?.rider?.id ? String(nextOrder.rider.id) : "");
      if (!nextOrder) {
        setError("Order not found.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load order.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const loadRiders = useCallback(async () => {
    try {
      const response = await apiFetch("/orders/merchant/riders", { auth: true });
      if (!response.ok) {
        return;
      }

      const payload = await response.json().catch(() => null);
      const nextRiders = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      setRiders(nextRiders);
    } catch {
      // Best effort: the page still works without the picker.
    }
  }, []);

  useEffect(() => {
    void loadOrder();
    void loadRiders();
  }, [loadOrder, loadRiders]);

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
    return STATUS_META[order.status].nextActions;
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

  async function assignRider() {
    if (!order || !selectedRiderId) return;

    setAssigningRider(true);
    setError(null);
    try {
      const response = await apiFetch(`/orders/merchant/${order.id}/assign-rider`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({ rider_user_id: Number(selectedRiderId) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          extractApiErrorMessage(payload, "Failed to assign rider."),
        );
      }

      if (payload) {
        setOrder(payload);
        setSelectedRiderId(payload?.rider?.id ? String(payload.rider.id) : selectedRiderId);
      } else {
        await loadOrder();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to assign rider.");
    } finally {
      setAssigningRider(false);
    }
  }

  const availableRiders = useMemo(() => {
    if (!order) return riders;
    return riders.filter(
      (rider) => rider.restaurant_ids.length === 0 || rider.restaurant_ids.includes(order.restaurantId),
    );
  }, [order, riders]);

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
                  className={`rounded px-2 py-0.5 text-[11px] font-bold text-white ${STATUS_META[order.status].tone}`}
                >
                  {STATUS_META[order.status].label}
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
                      <Button type="button" onClick={() => void changeStatus("delivered")}>
                        <Check className="h-4 w-4" />
                        Mark delivered
                      </Button>
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
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardContent className="space-y-4 p-6">
                  <h3 className="text-[18px] font-semibold text-[#495057]">Rider assignment</h3>
                  <div className="rounded border border-[#e9ecef] bg-[#f8f9fa] p-4">
                    <div className="text-[14px] font-semibold text-[#495057]">
                      {order.rider?.full_name ?? "No rider assigned yet"}
                    </div>
                    <div className="mt-1 text-[13px] text-[#868e96]">
                      {order.rider?.phone ?? "Assign a rider to start live delivery tracking."}
                    </div>
                    {order.riderAssignedAt ? (
                      <div className="mt-2 text-[12px] text-[#868e96]">
                        Assigned at {new Date(order.riderAssignedAt).toLocaleString()}
                      </div>
                    ) : null}
                  </div>

                  {order.status !== "cancelled" && order.status !== "delivered" ? (
                    <div className="space-y-3">
                      <label className="block text-[13px] font-semibold text-[#495057]">
                        Assign rider to this order
                      </label>
                      <select
                        value={selectedRiderId}
                        onChange={(event) => setSelectedRiderId(event.target.value)}
                        className="h-11 w-full rounded border border-[#dee2e6] bg-white px-3 text-[14px] text-[#495057]"
                      >
                        <option value="">Choose a rider</option>
                        {availableRiders.map((rider) => (
                          <option key={rider.id} value={rider.id}>
                            {rider.full_name}
                            {rider.busy ? " (busy)" : ""}
                            {rider.rider_work_mode ? ` - ${rider.rider_work_mode}` : ""}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const isFreelance = availableRiders.find(r => r.id.toString() === selectedRiderId)?.rider_work_mode === "freelance";
                        return (
                          <Button
                            type="button"
                            disabled={!selectedRiderId || assigningRider}
                            onClick={() => void assignRider()}
                            className="w-full"
                          >
                            {assigningRider ? (isFreelance ? "Sending request..." : "Assigning...") : (isFreelance ? "Send assign request" : "Assign rider")}
                          </Button>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#868e96]">
                      Rider assignment is locked once the order is delivered or cancelled.
                    </p>
                  )}
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
                      {STATUS_META[order.status].label}
                    </span>
                  </div>
                  <div className="flex justify-between text-[14px] text-[#868e96]">
                    <span>Rider</span>
                    <span className="font-semibold text-[#495057]">
                      {order.rider?.full_name ?? "Unassigned"}
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
          </div>
        </div>
      ) : null}
    </MerchantDashboardLayout>
  );
}
