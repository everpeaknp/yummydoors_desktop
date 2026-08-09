"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Check, CircleX, MapPinned, RefreshCw, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import { config } from "@/lib/config";
import { loadStoredAuth } from "@/lib/auth-storage";
import { DirectionsRenderer, DirectionsService, GoogleMap, MarkerF } from "@react-google-maps/api";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { MINIMAL_MAP_STYLE } from "@/lib/map-style";
import type { OrderStatus } from "@/lib/order-contract";

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
  invitation_type: "private";
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
  const [workModeLoading, setWorkModeLoading] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [invitations, setInvitations] = useState<RiderInvitation[]>([]);
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [showRequestHistory, setShowRequestHistory] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const { isLoaded } = useGoogleMaps();

  const loadOrders = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/orders/rider/me", { auth: true });
      if (!res.ok) throw new Error("Failed to load orders");
      const data: RiderOrder[] = await res.json();
      setOrders(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (!options?.silent) setLoading(false);
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadOrders({ silent: true });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadOrders]);

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
    let cancelled = false;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    async function connect() {
      if (cancelled) return;

      // A dropped connection that reconnects with the same (possibly expired)
      // access token would just get closed again with code 4001. Route an
      // authenticated request through first so apiFetch's existing 401-refresh
      // flow can rotate the token in storage before we read it below.
      await loadOrders({ silent: true });
      if (cancelled) return;

      const stored = loadStoredAuth();
      if (!stored?.accessToken) return;

      const wsBase = config.apiBaseUrl
        .replace("https://", "wss://")
        .replace("http://", "ws://");
      const ws = new WebSocket(
        `${wsBase}${config.apiPrefix}/orders/ws/rider?token=${stored.accessToken}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === "order_update" || msg.event === "rider_offer") {
            void loadOrders({ silent: true });
          }
        } catch (e) {
          console.error("WS parse error", e);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        if (cancelled) return;
        const delay = Math.min(2000 * (attempt + 1), 20000);
        attempt += 1;
        reconnectTimer = window.setTimeout(() => void connect(), delay);
      };
    }

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
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

  const updateWorkMode = async (nextMode: "freelance" | "assigned") => {
    if (!user || workModeLoading || user.riderWorkMode === nextMode) return;
    setWorkModeLoading(true);
    try {
      const res = await apiFetch("/auth/me/rider-work-mode", {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ rider_work_mode: nextMode }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.detail || "Failed to update rider mode");
      }
      setUser({ ...user, riderWorkMode: payload.data.rider_work_mode ?? nextMode });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update rider mode");
    } finally {
      setWorkModeLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (activeTab === "available") return !o.riderAssignedAt && o.status !== "cancelled";
    if (activeTab === "active") return o.riderAssignedAt && !o.deliveredAt && o.status !== "cancelled";
    if (activeTab === "completed") return o.deliveredAt || o.status === "cancelled";
    return false;
  });

  const activeCount = orders.filter(o => o.riderAssignedAt && !o.deliveredAt && o.status !== "cancelled").length;
  const assignedCount = orders.filter(o => o.riderAssignedAt).length;
  const doneCount = orders.filter(o => o.deliveredAt || o.status === "cancelled").length;

  const activeOrder = orders.find(o => o.riderAssignedAt && !o.deliveredAt && o.status !== "cancelled");

  const pendingInvitations = invitations.filter((i) => i.status === "pending" || i.status === "sent");
  const resolvedInvitations = invitations.filter((i) => i.status !== "pending" && i.status !== "sent");

  const availableCount = orders.filter(o => !o.riderAssignedAt && o.status !== "cancelled").length;
  const TAB_COUNTS = { available: availableCount, active: activeCount, completed: doneCount };
  const offerSecondsLeft = (order: RiderOrder) => {
    if (!order.riderOfferId || !order.riderOfferExpiresAt) return null;
    return Math.max(0, Math.ceil((new Date(order.riderOfferExpiresAt).getTime() - clock) / 1000));
  };
  useEffect(() => {
    setDirections(null);
  }, [activeOrder?.id, activeOrder?.pickedUpAt]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fafafb] text-[#111827]">
      <header className="border-b border-[#eceff3] bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-6 lg:px-10 lg:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8505b]">Delivery workspace</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">Rider dashboard</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{user?.fullName || "Rider"} · manage offers, team requests, and live routes.</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#fecdd3] bg-[#fff1f2] px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e8505b]" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#e8505b]">Rider mode</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] border border-gray-200 px-4 text-[13px] font-semibold text-[#374151] transition hover:bg-gray-50"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" /> Switch
            </button>
            <label className="flex items-center gap-3 rounded-[8px] border border-[#eceff3] bg-white px-4 py-2.5">
              <span className="text-right">
                <span className="block text-[13px] font-semibold text-[#111827]">
                  {user?.isAcceptingOffers ? "Online" : "Offline"}
                </span>
                <span className="block text-[11px] text-muted-foreground">Freelance offers</span>
              </span>
              <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${user?.isAcceptingOffers ? "bg-[#e8505b]" : "bg-gray-300"}`}>
                <input
                  type="checkbox"
                  checked={Boolean(user?.isAcceptingOffers)}
                  disabled={!user || availabilityLoading}
                  onChange={(event) => void updateAvailability(event.target.checked)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span
                  className={`pointer-events-none absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    user?.isAcceptingOffers ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </span>
            </label>
            {user && user.riderWorkMode !== "platform" ? (
              <div className="flex items-center gap-1 rounded-[8px] border border-[#eceff3] bg-white p-1">
                <button
                  type="button"
                  disabled={workModeLoading}
                  onClick={() => void updateWorkMode("assigned")}
                  className={`rounded-[6px] px-3 py-1.5 text-[12px] font-semibold transition ${
                    user.riderWorkMode === "assigned" ? "bg-[#e8505b] text-white" : "text-[#6b7280] hover:bg-gray-50"
                  }`}
                >
                  Assigned
                </button>
                <button
                  type="button"
                  disabled={workModeLoading}
                  onClick={() => void updateWorkMode("freelance")}
                  className={`rounded-[6px] px-3 py-1.5 text-[12px] font-semibold transition ${
                    user.riderWorkMode === "freelance" ? "bg-[#e8505b] text-white" : "text-[#6b7280] hover:bg-gray-50"
                  }`}
                >
                  Freelance
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Assigned restaurants can send delivery requests even while you are offline.
          {user?.riderWorkMode === "freelance"
            ? " Freelance mode lets you receive delivery offers from any restaurant nearby, not just your own team."
            : ""}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-[8px] border border-[#eceff3] bg-white py-4 text-center">
            <div className="text-xl font-bold text-[#111827]">{activeCount}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Active</div>
          </div>
          <div className="rounded-[8px] border border-[#eceff3] bg-white py-4 text-center">
            <div className="text-xl font-bold text-[#111827]">{assignedCount}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Assigned</div>
          </div>
          <div className="rounded-[8px] border border-[#eceff3] bg-white py-4 text-center">
            <div className="text-xl font-bold text-[#111827]">{doneCount}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Done</div>
          </div>
        </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1280px] gap-6 px-6 py-6 lg:px-10 lg:py-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div className="space-y-5">
          <div className="sticky top-0 z-10 -mx-6 bg-[#fafafb]/95 px-6 pb-2 pt-2 backdrop-blur-sm sm:mx-0 sm:px-0">
            <div className="flex rounded-full border border-[#eceff3] bg-white p-1 shadow-sm">
              {(["available", "active", "completed"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors ${
                    activeTab === tab
                      ? "bg-[#e8505b] text-white shadow-sm"
                      : "text-muted-foreground hover:text-[#111827]"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  <span className={activeTab === tab ? "ml-1.5 text-white/80" : "ml-1.5 text-gray-400"}>
                    {TAB_COUNTS[tab]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {loading && orders.length === 0 ? (
            <div className="animate-pulse rounded-[10px] border border-[#eceff3] bg-white py-10 text-center text-sm text-muted-foreground">Loading orders...</div>
          ) : error && orders.length === 0 ? (
            <div className="rounded-[10px] border border-[#fecdd3] bg-[#fff1f2] py-10 text-center text-sm text-[#be123c]">{error}</div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-gray-200 bg-white py-10 text-center text-sm text-muted-foreground">
              No orders in this lane yet.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="rounded-[10px] border border-[#eceff3] bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-[14px] font-bold text-[#111827]">Order #{order.orderNumber}</h3>
                        <p className="text-[13px] text-muted-foreground">{order.restaurantName}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-[14px] font-bold text-[#111827]">Rs. {order.totalPrice.toFixed(2)}</div>
                        <div className="text-[11px] capitalize text-muted-foreground">{order.status.replace("_", " ")}</div>
                      </div>
                    </div>

                    <div className="mb-4 mt-3 space-y-1 text-[13px] text-[#374151]">
                      <p><span className="font-semibold text-muted-foreground">Pickup:</span> {order.restaurantName}</p>
                      <p><span className="font-semibold text-muted-foreground">Dropoff:</span> {order.address?.address_text || "No address"}</p>
                      {order.riderOfferId ? (
                        <p className={offerSecondsLeft(order) === 0 ? "font-semibold text-[#be123c]" : "font-semibold text-[#e8505b]"}>
                          {offerSecondsLeft(order) === 0 ? "Offer expired. Refreshing..." : `Private rider offer expires in ${offerSecondsLeft(order)}s`}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      {activeTab === "available" && (
                        <>
                          {order.riderOfferId ? (
                            <button
                              type="button"
                              disabled={actionLoading === order.id}
                              onClick={() => void rejectOffer(order)}
                              className="h-11 flex-1 rounded-[6px] border border-[#fecdd3] text-[13px] font-semibold text-[#be123c] transition hover:bg-[#fff1f2] disabled:opacity-50"
                            >
                              Reject
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={actionLoading === order.id || offerSecondsLeft(order) === 0}
                            onClick={() => handleAction(order.id, "claim")}
                            className="h-11 flex-1 rounded-[6px] bg-[#e8505b] text-[13px] font-bold text-white transition hover:bg-[#d6414c] disabled:opacity-50"
                          >
                            {actionLoading === order.id
                              ? "Updating..."
                              : order.riderOfferId
                                ? "Accept Offer"
                                : "Claim Order"}
                          </button>
                        </>
                      )}
                      {activeTab === "active" && !order.pickedUpAt && (
                        <button
                          type="button"
                          disabled={actionLoading === order.id}
                          onClick={() => handleAction(order.id, "picked-up")}
                          className="h-11 flex-1 rounded-[6px] bg-[#3b82f6] text-[13px] font-bold text-white transition hover:bg-[#2563eb] disabled:opacity-50"
                        >
                          {actionLoading === order.id ? "Updating..." : "Mark Picked Up"}
                        </button>
                      )}
                      {activeTab === "active" && order.pickedUpAt && !order.deliveredAt && (
                        <button
                          type="button"
                          disabled={actionLoading === order.id}
                          onClick={() => handleAction(order.id, "delivered")}
                          className="h-11 flex-1 rounded-[6px] bg-[#16a34a] text-[13px] font-bold text-white transition hover:bg-[#15803d] disabled:opacity-50"
                        >
                          {actionLoading === order.id ? "Updating..." : "Mark Delivered"}
                        </button>
                      )}
                    </div>
                </div>
              ))}
            </div>
          )}

          <section className="rounded-[10px] border border-[#eceff3] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#eceff3] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[15px] font-bold text-[#111827]">
                    Restaurant team requests
                    {pendingInvitations.length > 0 ? (
                      <span className="ml-2 rounded-full bg-[#e8505b] px-2 py-0.5 text-[11px] font-bold text-white">
                        {pendingInvitations.length}
                      </span>
                    ) : null}
                  </h2>
                  <p className="text-[12px] text-muted-foreground">Private restaurants can invite you directly.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadInvitations()}
                className="inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-[6px] border border-gray-200 px-3 text-[12px] font-semibold text-[#374151] transition hover:bg-gray-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            <div className="space-y-3 px-6 py-5">
              {invitations.length === 0 ? (
                <p className="rounded-[8px] bg-[#fafafa] px-4 py-5 text-[13px] text-muted-foreground">No restaurant team requests yet.</p>
              ) : (
                <>
                  {pendingInvitations.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">No pending requests right now.</p>
                  ) : (
                    pendingInvitations.map((invitation) => (
                      <div key={invitation.id} className="rounded-[8px] border border-[#eceff3] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[14px] font-bold text-[#111827]">{invitation.restaurant_name || "Restaurant"}</p>
                            <p className="mt-1 text-[13px] text-muted-foreground">{invitation.notes || "This restaurant wants to add you to its rider team."}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#fff1f2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#e8505b]">
                            Private rider
                          </span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void respondToInvitation(invitation.id, "accept")}
                            disabled={invitationLoading}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] bg-[#e8505b] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#d6414c] disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => void respondToInvitation(invitation.id, "reject")}
                            disabled={invitationLoading}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] border border-gray-200 px-3.5 text-[13px] font-semibold text-[#374151] transition hover:bg-gray-50 disabled:opacity-50"
                          >
                            <CircleX className="h-3.5 w-3.5" /> Decline
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {resolvedInvitations.length > 0 ? (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowRequestHistory((current) => !current)}
                        className="text-[12px] font-semibold text-[#e8505b] hover:underline"
                      >
                        {showRequestHistory ? "Hide" : "Show"} {resolvedInvitations.length} past request{resolvedInvitations.length === 1 ? "" : "s"}
                      </button>
                      {showRequestHistory ? (
                        <div className="mt-3 space-y-2">
                          {resolvedInvitations.map((invitation) => (
                            <div key={invitation.id} className="flex items-center justify-between gap-4 rounded-[8px] bg-[#fafafa] px-4 py-3">
                              <div>
                                <p className="text-[13px] font-semibold text-[#111827]">{invitation.restaurant_name || "Restaurant"}</p>
                                <p className="text-[12px] capitalize text-muted-foreground">Status: {invitation.status}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                Private
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>

        <div className="min-h-0 xl:sticky xl:top-6 xl:self-start">
          <div className="h-[520px] overflow-hidden rounded-[10px] border border-[#eceff3] bg-white shadow-sm sm:h-[620px]">
            <div className="flex items-center justify-between border-b border-[#eceff3] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
                  <MapPinned className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[15px] font-bold text-[#111827]">Live route</h2>
                  <p className="text-[12px] text-muted-foreground">Pickup and dropoff route updates in real time.</p>
                </div>
              </div>
              <span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#16a34a]">Live</span>
            </div>
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
                  styles: MINIMAL_MAP_STYLE,
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
          </div>
        </div>
      </main>
    </div>
  );
}
