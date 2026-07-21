"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Check, CircleX, MapPinned, RefreshCw, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import { config } from "@/lib/config";
import { loadStoredAuth } from "@/lib/auth-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DirectionsRenderer, DirectionsService, GoogleMap, MarkerF } from "@react-google-maps/api";
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

type RiderInvitation = {
  id: number;
  restaurant_name: string | null;
  invitation_type: "private" | "preferred";
  status: string;
  notes: string | null;
};

export default function RiderDashboardPage() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"available" | "active" | "completed">("available");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [invitations, setInvitations] = useState<RiderInvitation[]>([]);
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
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

  const loadInvitations = useCallback(async () => {
    const response = await apiFetch("/rider-dispatch/invitations/me", { auth: true });
    if (!response.ok) return;
    const payload = await response.json().catch(() => null);
    const data = Array.isArray(payload) ? payload : payload?.data;
    if (Array.isArray(data)) setInvitations(data);
  }, []);

  useEffect(() => {
    loadOrders();
    loadInvitations();
  }, [loadInvitations, loadOrders]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function respondToInvitation(id: number, action: "accept" | "reject") {
    setInvitationLoading(true);
    try {
      const response = await apiFetch(`/rider-dispatch/invitations/${id}/${action}`, {
        method: "POST",
        auth: true,
      });
      if (response.ok) await loadInvitations();
    } finally {
      setInvitationLoading(false);
    }
  }

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        void apiFetch("/auth/me/rider-location", {
          method: "PATCH",
          auth: true,
          body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
        });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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
  const offerSecondsLeft = (order: RiderOrder) => {
    if (!order.riderOfferId || !order.riderOfferExpiresAt) return null;
    return Math.max(0, Math.ceil((new Date(order.riderOfferExpiresAt).getTime() - clock) / 1000));
  };
  useEffect(() => {
    setDirections(null);
  }, [activeOrder?.id, activeOrder?.pickedUpAt]);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#20252d]">
      <header className="border-b border-[#e7ebf2] bg-white">
        <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff6b3d]">Delivery workspace</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#20252d]">Rider Dashboard</h1>
            <p className="mt-2 text-base text-[#697386]">{user?.fullName || "Rider"} · manage offers, team requests, and live routes.</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#ffd1c2] bg-[#fff4ef] px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ff6b3d]" />
              <span className="text-xs font-bold text-[#e9572d]">Rider mode</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => router.push("/")}>
              <ArrowLeftRight className="h-4 w-4" /> Switch
            </Button>
          <label className="flex items-center gap-4 rounded-2xl border border-[#e1e6ef] bg-[#f8fafc] px-5 py-3">
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
        </div>
        <p className="mt-4 text-sm text-[#697386]">
          Assigned restaurants can send delivery requests even while you are offline.
        </p>

        <div className="mt-7 grid grid-cols-3 gap-4">
          <Card className="rounded-2xl border-[#e7ebf2]">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#495057]">{activeCount}</div>
              <div className="text-xs text-[#868e96] mt-1">Active</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-[#e7ebf2]">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#495057]">{assignedCount}</div>
              <div className="text-xs text-[#868e96] mt-1">Assigned</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-[#e7ebf2]">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#495057]">{doneCount}</div>
              <div className="text-xs text-[#868e96] mt-1">Done</div>
            </CardContent>
          </Card>
        </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)] lg:px-10">
        <div className="space-y-6">
          <Card className="rounded-3xl border-[#e7ebf2] bg-white shadow-[0_18px_50px_rgba(31,41,55,0.06)]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><Users className="h-5 w-5 text-[#ff6b3d]" /><div><h2 className="text-xl font-bold">Restaurant team requests</h2><p className="mt-1 text-sm text-[#697386]">Private restaurants can invite you directly.</p></div></div>
                <Button type="button" variant="ghost" onClick={() => void loadInvitations()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
              </div>
              <div className="mt-5 space-y-3">
                {invitations.length === 0 ? <p className="rounded-2xl bg-[#f8fafc] px-4 py-5 text-sm text-[#697386]">No restaurant team requests yet.</p> : invitations.map((invitation) => (
                  <div key={invitation.id} className="rounded-2xl border border-[#e7ebf2] bg-[#fbfcfe] p-4">
                    <div className="flex items-start justify-between gap-4"><div><p className="font-bold">{invitation.restaurant_name || "Restaurant"}</p><p className="mt-1 text-sm text-[#697386]">{invitation.notes || "This restaurant wants to add you to its rider team."}</p></div><span className="rounded-full bg-[#fff0ea] px-3 py-1 text-xs font-bold text-[#e9572d]">{invitation.invitation_type === "private" ? "Private rider" : "Preferred rider"}</span></div>
                    {invitation.status === "pending" || invitation.status === "sent" ? <div className="mt-4 flex gap-2"><Button type="button" onClick={() => void respondToInvitation(invitation.id, "accept")} disabled={invitationLoading}><Check className="h-4 w-4" /> Accept</Button><Button type="button" variant="secondary" onClick={() => void respondToInvitation(invitation.id, "reject")} disabled={invitationLoading}><CircleX className="h-4 w-4" /> Decline</Button></div> : <p className="mt-3 text-sm font-semibold text-[#0e9f6e]">Status: {invitation.status}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
                      {order.riderOfferId ? (
                        <p className={offerSecondsLeft(order) === 0 ? "font-semibold text-red-600" : "font-semibold text-orange-600"}>
                          {offerSecondsLeft(order) === 0 ? "Offer expired. Refreshing..." : `Private rider offer expires in ${offerSecondsLeft(order)}s`}
                        </p>
                      ) : null}
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
                            disabled={actionLoading === order.id || offerSecondsLeft(order) === 0}
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

        <div className="min-h-[650px]">
          <Card className="h-full min-h-[650px] overflow-hidden rounded-3xl border-[#e7ebf2] bg-white shadow-[0_18px_50px_rgba(31,41,55,0.06)]">
            <div className="flex items-center justify-between border-b border-[#edf0f5] px-6 py-5"><div className="flex items-center gap-3"><MapPinned className="h-5 w-5 text-[#ff6b3d]" /><div><h2 className="text-xl font-bold">Live route</h2><p className="text-sm text-[#697386]">Pickup and dropoff route updates in real time.</p></div></div><span className="rounded-full bg-[#edf9f4] px-3 py-1 text-xs font-bold text-[#0e9f6e]">Live</span></div>
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
                  <>
                    <DirectionsService
                      options={{
                        origin: { lat: activeOrder.restaurantLatitude, lng: activeOrder.restaurantLongitude },
                        destination: { lat: activeOrder.address.latitude, lng: activeOrder.address.longitude },
                        travelMode: google.maps.TravelMode.DRIVING,
                      }}
                      callback={(result, status) => {
                        if (status === "OK" && result) setDirections(result);
                      }}
                    />
                    {directions ? <DirectionsRenderer directions={directions} options={{ suppressMarkers: true, polylineOptions: { strokeColor: "#f97316", strokeWeight: 5 } }} /> : null}
                  </>
                )}
              </GoogleMap>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
