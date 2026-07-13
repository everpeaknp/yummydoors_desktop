"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import { config } from "@/lib/config";
import { loadStoredAuth } from "@/lib/auth-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleMap, MarkerF, PolylineF } from "@react-google-maps/api";
import { useGoogleMaps } from "@/hooks/use-google-maps";

type OrderStatus = "placed" | "preparing" | "picked_up" | "delivered" | "cancelled";

type OrderItem = { name: string; price: number; quantity: number };

type RiderOrder = {
  id: number;
  orderNumber: string;
  restaurantName: string;
  restaurantLatitude: number | null;
  restaurantLongitude: number | null;
  customerName: string;
  address: {
    address_text: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  status: OrderStatus;
  totalPrice: number;
  items: OrderItem[];
  riderAssignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  riderOfferExpiresAt: string | null;
  riderOfferId: number | null;
  riderOfferTier: string | null;
};

export default function RiderDashboardPage() {
  const { user, setUser } = useAuth();
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"available" | "active" | "completed">("available");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const { isLoaded } = useGoogleMaps();

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/orders/rider/me", { auth: true });
      if (!res.ok) throw new Error("Failed to load orders");
      const data: RiderOrder[] = await res.json();
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

  useEffect(() => {
    const stored = loadStoredAuth();
    if (!stored?.accessToken) return;

    const wsBase = config.apiBaseUrl
      .replace("https://", "wss://")
      .replace("http://", "ws://");
    const ws = new WebSocket(
      `${wsBase}${config.apiPrefix}/orders/ws/rider?token=${stored.accessToken}`
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "order_update" || msg.event === "rider_offer") {
          loadOrders(); // Quick refresh to get full updated state
        }
      } catch (e) {
        console.error("WS parse error", e);
      }
    };

    return () => {
      ws.close();
    };
  }, [loadOrders]);

  const handleAction = async (orderId: number, action: "claim" | "picked-up" | "delivered") => {
    setActionLoading(orderId);
    try {
      const res = await apiFetch(`/orders/rider/${orderId}/${action}`, {
        method: action === "claim" ? "POST" : "PATCH",
        auth: true,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Failed to ${action} order`);
      }
      await loadOrders();
    } catch (e) {
      alert(e instanceof Error ? e.message : `Failed to ${action} order`);
    } finally {
      setActionLoading(null);
    }
  };

  const rejectOffer = async (order: RiderOrder) => {
    if (!order.riderOfferId) return;
    setActionLoading(order.id);
    try {
      const res = await apiFetch(
        `/rider-dispatch/offers/${order.riderOfferId}/reject`,
        { method: "POST", auth: true },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Failed to reject offer");
      }
      await loadOrders();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to reject offer");
    } finally {
      setActionLoading(null);
    }
  };

  const updateAvailability = async (isAcceptingOffers: boolean) => {
    if (!user || availabilityLoading) return;
    setAvailabilityLoading(true);
    try {
      const res = await apiFetch("/auth/me/rider-availability", {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ is_accepting_offers: isAcceptingOffers }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.detail || "Failed to update availability");
      }
      setUser({
        ...user,
        riderWorkMode: payload.data.rider_work_mode ?? user.riderWorkMode,
        isAcceptingOffers: Boolean(payload.data.is_accepting_offers),
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update availability");
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (activeTab === "available") return !o.riderAssignedAt;
    if (activeTab === "active") return o.riderAssignedAt && !o.deliveredAt;
    if (activeTab === "completed") return o.deliveredAt;
    return false;
  });

  const activeCount = orders.filter(o => o.riderAssignedAt && !o.deliveredAt).length;
  const assignedCount = orders.filter(o => o.riderAssignedAt).length;
  const doneCount = orders.filter(o => o.deliveredAt).length;

  const activeOrder = orders.find(o => o.riderAssignedAt && !o.deliveredAt);

  return (
    <div className="flex h-screen flex-col bg-[#F6F7FB]">
      <header className="bg-white border-b border-[#E8EDF6] p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-[#495057]">Rider Dashboard</h1>
            <p className="text-sm text-[#868e96] mt-1">{user?.fullName || "Rider"}</p>
            <div className="mt-3 inline-block rounded-full bg-orange-50 border border-orange-200 px-3 py-1">
              <span className="text-xs font-semibold text-orange-500">Rider mode</span>
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-[#E7ECF4] bg-[#F8FAFC] px-4 py-3">
            <span className="text-right">
              <span className="block text-sm font-semibold text-[#495057]">
                {user?.isAcceptingOffers ? "Online" : "Offline"}
              </span>
              <span className="block text-xs text-[#868e96]">Freelance offers</span>
            </span>
            <input
              type="checkbox"
              checked={Boolean(user?.isAcceptingOffers)}
              disabled={!user || availabilityLoading}
              onChange={(event) => void updateAvailability(event.target.checked)}
              className="h-5 w-5 accent-orange-500"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-[#868e96]">
          Assigned restaurants can send delivery requests even while you are offline.
        </p>

        <div className="mt-6 flex space-x-4">
          <Card className="flex-1 rounded-2xl border-[#E7ECF4]">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#495057]">{activeCount}</div>
              <div className="text-xs text-[#868e96] mt-1">Active</div>
            </CardContent>
          </Card>
          <Card className="flex-1 rounded-2xl border-[#E7ECF4]">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#495057]">{assignedCount}</div>
              <div className="text-xs text-[#868e96] mt-1">Assigned</div>
            </CardContent>
          </Card>
          <Card className="flex-1 rounded-2xl border-[#E7ECF4]">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#495057]">{doneCount}</div>
              <div className="text-xs text-[#868e96] mt-1">Done</div>
            </CardContent>
          </Card>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
        <div className="flex-1 max-w-xl">
          <div className="bg-white rounded-full border border-[#E8EDF6] p-1 mb-6 flex">
            {(["available", "active", "completed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab
                    ? "bg-orange-500 text-white shadow"
                    : "text-[#868e96] hover:text-[#495057]"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {loading && orders.length === 0 ? (
            <div className="text-center text-[#868e96] py-10">Loading orders...</div>
          ) : error && orders.length === 0 ? (
            <div className="text-center text-red-500 py-10">{error}</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center text-[#868e96] py-10 bg-white rounded-2xl border border-[#E8EDF6]">
              No orders in this lane yet.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="rounded-2xl border-[#E8EDF6]">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-[#495057]">Order #{order.orderNumber}</h3>
                        <p className="text-sm text-[#868e96]">{order.restaurantName}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-orange-500">${order.totalPrice.toFixed(2)}</div>
                        <div className="text-xs text-[#868e96] capitalize">{order.status.replace("_", " ")}</div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-[#495057] mb-4 space-y-1">
                      <p><span className="font-semibold text-[#868e96]">Pickup:</span> {order.restaurantName}</p>
                      <p><span className="font-semibold text-[#868e96]">Dropoff:</span> {order.address?.address_text || "No address"}</p>
                    </div>

                    <div className="flex space-x-3">
                      {activeTab === "available" && (
                        <>
                          {order.riderOfferId ? (
                            <Button
                              variant="ghost"
                              className="flex-1 rounded-xl h-11 border-red-200 text-red-600"
                              disabled={actionLoading === order.id}
                              onClick={() => void rejectOffer(order)}
                            >
                              Reject
                            </Button>
                          ) : null}
                          <Button
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-11"
                            disabled={actionLoading === order.id}
                            onClick={() => handleAction(order.id, "claim")}
                          >
                            {actionLoading === order.id
                              ? "Updating..."
                              : order.riderOfferId
                                ? "Accept Offer"
                                : "Claim Order"}
                          </Button>
                        </>
                      )}
                      {activeTab === "active" && !order.pickedUpAt && (
                        <Button
                          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-xl h-11"
                          disabled={actionLoading === order.id}
                          onClick={() => handleAction(order.id, "picked-up")}
                        >
                          {actionLoading === order.id ? "Updating..." : "Mark Picked Up"}
                        </Button>
                      )}
                      {activeTab === "active" && order.pickedUpAt && !order.deliveredAt && (
                        <Button
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl h-11"
                          disabled={actionLoading === order.id}
                          onClick={() => handleAction(order.id, "delivered")}
                        >
                          {actionLoading === order.id ? "Updating..." : "Mark Delivered"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-[400px]">
          <Card className="h-full rounded-2xl border-[#E8EDF6] overflow-hidden">
            {!isLoaded ? (
              <div className="h-full flex items-center justify-center text-gray-500">Loading map...</div>
            ) : (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={
                  activeOrder?.restaurantLatitude && activeOrder?.restaurantLongitude
                    ? { lat: activeOrder.restaurantLatitude, lng: activeOrder.restaurantLongitude }
                    : { lat: 28.2096, lng: 83.9856 }
                }
                zoom={14}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                }}
              >
                {activeOrder?.restaurantLatitude && activeOrder?.restaurantLongitude && (
                  <MarkerF 
                    position={{ lat: activeOrder.restaurantLatitude, lng: activeOrder.restaurantLongitude }}
                    label="P"
                  />
                )}
                {activeOrder?.address?.latitude && activeOrder?.address?.longitude && (
                  <MarkerF 
                    position={{ lat: activeOrder.address.latitude, lng: activeOrder.address.longitude }} 
                    label="D"
                  />
                )}
                {activeOrder?.restaurantLatitude && activeOrder?.restaurantLongitude && activeOrder?.address?.latitude && activeOrder?.address?.longitude && (
                  <PolylineF 
                    path={[
                      { lat: activeOrder.restaurantLatitude, lng: activeOrder.restaurantLongitude },
                      { lat: activeOrder.address.latitude, lng: activeOrder.address.longitude }
                    ]}
                    options={{
                      strokeColor: "#f97316", // orange-500
                      strokeWeight: 4,
                    }}
                  />
                )}
              </GoogleMap>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
