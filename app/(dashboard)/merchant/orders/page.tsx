"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import { config } from "@/lib/config";
import { loadStoredAuth } from "@/lib/auth-storage";

type OrderStatus = "toPay" | "placed" | "preparing" | "delivered" | "cancelled";

type OrderItem = { name: string; price: number; quantity: number };

type MerchantOrder = {
  id: number;
  orderNumber: string;
  restaurantName: string;
  customerName: string;
  date: string;
  status: OrderStatus;
  totalPrice: number;
  items: OrderItem[];
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  toPay: "bg-[#6c757d]",
  placed: "bg-[#0d84ff]",
  preparing: "bg-[#f5b800]",
  delivered: "bg-[#25b546]",
  cancelled: "bg-[#e53e4f]",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  toPay: "To Pay",
  placed: "Placed",
  preparing: "Preparing",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  placed: ["preparing", "cancelled"],
  preparing: ["delivered", "cancelled"],
};

export default function MerchantOrdersPage() {
  const { user } = useAuth();
  const merchantWorkspaceReady = user?.activeWorkspace?.workspaceType === "merchant";
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/orders/merchant/me", { auth: true });
      if (!res.ok) throw new Error("Failed to load orders");
      const data: MerchantOrder[] = await res.json();
      setOrders(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // WebSocket for real-time order updates
  useEffect(() => {
    if (!merchantWorkspaceReady) {
      return;
    }
    const stored = loadStoredAuth();
    if (!stored?.accessToken) return;

    const wsBase = config.apiBaseUrl
      .replace("https://", "wss://")
      .replace("http://", "ws://");
    const ws = new WebSocket(
      `${wsBase}${config.apiPrefix}/orders/ws/merchant?token=${stored.accessToken}`
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "order_update") {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === msg.order_id ? { ...o, status: msg.status as OrderStatus } : o
            )
          );
        } else if (msg.event === "new_order") {
          // A new order was just placed, reload the list to get all details
          loadOrders();
        }
      } catch {}
    };

    ws.onerror = () => {};

    return () => {
      ws.close();
    };
  }, [loadOrders, merchantWorkspaceReady]);

  const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await apiFetch(
        `/orders/merchant/${orderId}/status?new_status=${newStatus}`,
        { method: "PATCH", auth: true }
      );
      if (!res.ok) throw new Error("Status update failed");
      const updated: MerchantOrder = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.restaurantName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
        <span className="text-[#e53e4f]">Dashboard</span>
        <span className="mx-2">/</span>
        <span>Orders</span>
      </div>

      <div className="bg-white rounded shadow-sm border border-[#e9ecef] overflow-hidden">
        <div className="border-b border-[#e9ecef] px-6 py-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[#495057]">Merchant Orders</h2>
          <button
            onClick={loadOrders}
            className="text-[13px] text-[#e53e4f] hover:underline"
          >
            Refresh
          </button>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[14px] text-[#495057]">
              {filtered.length} order{filtered.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center text-[14px] text-[#495057]">
              Search:
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ml-2 border border-[#ced4da] rounded px-3 py-1 outline-none focus:border-[#e53e4f] w-[200px] text-[13px]"
                placeholder="Name, order #…"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-[#868e96] text-[14px]">Loading orders…</div>
          ) : error ? (
            <div className="py-16 text-center text-[#e53e4f] text-[14px]">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-[#868e96] text-[14px]">No orders found.</div>
          ) : (
            <table className="w-full text-left text-[14px] text-[#495057]">
              <thead>
                <tr className="border-b-2 border-[#dee2e6]">
                  {["#", "Order No.", "Customer", "Date", "Total", "Status", "Actions"].map((h) => (
                    <th key={h} className="py-3 px-2 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dee2e6]">
                {filtered.map((order, i) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="py-4 px-2 text-[#868e96]">{i + 1}</td>
                    <td className="py-4 px-2 font-medium">{order.orderNumber}</td>
                    <td className="py-4 px-2">{order.customerName}</td>
                    <td className="py-4 px-2">{order.date}</td>
                    <td className="py-4 px-2 font-semibold">
                      Rs. {order.totalPrice.toFixed(2)}
                    </td>
                    <td className="py-4 px-2">
                      <span
                        className={`px-3 py-1 text-[12px] font-semibold rounded-[4px] text-white ${STATUS_STYLES[order.status] ?? "bg-[#6c757d]"}`}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/merchant/orders/${order.id}`}
                          className="text-[#e53e4f] hover:underline text-[13px]"
                        >
                          View
                        </Link>
                        {(NEXT_STATUSES[order.status] ?? []).map((ns) => (
                          <button
                            key={ns}
                            disabled={updatingId === order.id}
                            onClick={() => handleStatusChange(order.id, ns)}
                            className={`text-[12px] px-2 py-1 rounded text-white font-semibold disabled:opacity-50 ${STATUS_STYLES[ns]}`}
                          >
                            {updatingId === order.id ? "…" : STATUS_LABELS[ns]}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MerchantDashboardLayout>
  );
}
