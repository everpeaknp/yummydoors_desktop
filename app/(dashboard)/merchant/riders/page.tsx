"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { UserPlus, RefreshCw, MapPinned } from "lucide-react";
import { GoogleMap, MarkerF } from "@react-google-maps/api";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { apiFetch } from "@/lib/http";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { MINIMAL_MAP_STYLE } from "@/lib/map-style";

type Restaurant = { id: number; name: string };
type Candidate = {
  id: number;
  full_name: string;
  phone: string | null;
  assignment_type: string;
  rider_work_mode: string;
  is_accepting_offers: boolean;
  busy: boolean;
  distance_km: number | null;
  current_latitude: number | null;
  current_longitude: number | null;
};
type Invitation = {
  id: number;
  invited_email: string;
  invitation_type: string;
  status: string;
  notes: string | null;
  created_at: string;
};
type Profile = {
  rider_dispatch_policy: string;
  rider_private_offer_timeout_seconds: number;
  rider_open_offer_timeout_seconds: number;
  latitude: number | null;
  longitude: number | null;
};

const TIER_MARKER_COLOR: Record<string, string> = {
  rider_private: "#e9572d",
  open: "#3b82f6",
  platform: "#16a34a",
};

const TIER_LABEL: Record<string, string> = {
  rider_private: "Private",
  open: "Open pool",
  platform: "Platform",
};

function markerIcon(color: string): google.maps.Symbol {
  return {
    path: "M0,0 m-7,0 a7,7 0 1,0 14,0 a7,7 0 1,0 -14,0",
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: 1,
  };
}

const unwrap = <T,>(payload: any): T => payload?.data ?? payload;

export default function MerchantRidersPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { isLoaded: mapsLoaded } = useGoogleMaps();

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const [profileResponse, candidatesResponse, invitationsResponse] = await Promise.all([
        apiFetch(`/merchant/restaurants/${id}/profile`, { auth: true }),
        apiFetch(`/rider-dispatch/restaurants/${id}/candidates`, { auth: true }),
        apiFetch(`/rider-dispatch/restaurants/${id}/invitations`, { auth: true }),
      ]);
      if (!profileResponse.ok || !candidatesResponse.ok || !invitationsResponse.ok) {
        throw new Error("Failed to load rider management data.");
      }
      setProfile(unwrap<Profile>(await profileResponse.json()));
      setCandidates(unwrap<Candidate[]>(await candidatesResponse.json()));
      setInvitations(unwrap<Invitation[]>(await invitationsResponse.json()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load rider management data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await apiFetch("/merchant/restaurants/me", { auth: true });
      if (!response.ok) {
        setError("Failed to load merchant restaurants.");
        setLoading(false);
        return;
      }
      const payload = unwrap<{ active_restaurant_id: number | null; items: Restaurant[] }>(await response.json());
      const items = payload.items ?? [];
      const activeId = payload.active_restaurant_id ?? items[0]?.id ?? null;
      setRestaurants(items);
      setRestaurantId(activeId);
      if (activeId) void load(activeId);
      else setLoading(false);
    })();
  }, [load]);

  async function updateProfile(changes: Partial<Profile>) {
    if (!restaurantId || !profile) return;
    setError(null);
    const response = await apiFetch(`/merchant/restaurants/${restaurantId}/profile`, {
      method: "PUT",
      auth: true,
      body: JSON.stringify(changes),
    });
    if (!response.ok) {
      setError("Failed to save rider dispatch settings.");
      return;
    }
    setProfile(unwrap<Profile>(await response.json()));
    setMessage("Rider dispatch settings saved.");
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!restaurantId || !email.trim()) return;
    const response = await apiFetch(`/rider-dispatch/restaurants/${restaurantId}/invitations`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ invited_email: email.trim(), invitation_type: "private", notes: notes.trim() || null }),
    });
    if (!response.ok) {
      setError("Failed to invite rider.");
      return;
    }
    setEmail("");
    setNotes("");
    setMessage("Rider invitation sent.");
    if (restaurantId) void load(restaurantId);
  }

  async function invitationAction(invitationId: number, action: "resend" | "cancel") {
    if (!restaurantId) return;
    const response = await apiFetch(`/rider-dispatch/restaurants/${restaurantId}/invitations/${invitationId}/${action}`, { method: "POST", auth: true });
    if (!response.ok) { setError(`Failed to ${action} invitation.`); return; }
    setMessage(action === "resend" ? "Invitation resent." : "Invitation cancelled.");
    void load(restaurantId);
  }

  async function removeRider(riderId: number) {
    if (!restaurantId || !window.confirm("Remove this rider from the restaurant team?")) return;
    const response = await apiFetch(`/rider-dispatch/restaurants/${restaurantId}/riders/${riderId}`, { method: "DELETE", auth: true });
    if (!response.ok) { setError("Failed to remove rider."); return; }
    setMessage("Rider removed from the restaurant team.");
    void load(restaurantId);
  }

  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-[#868e96]">Dashboard / Management</p>
          <h1 className="mt-2 text-2xl font-bold text-[#212529]">Rider management</h1>
          <p className="mt-1 text-sm text-[#868e96]">Manage rider teams and how delivery offers are dispatched.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded border border-[#ced4da] bg-white px-3 py-2 text-sm" value={restaurantId ?? ""} onChange={(event) => { const id = Number(event.target.value); setRestaurantId(id); void load(id); }}>
            {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
          </select>
          <button className="rounded border border-[#ced4da] p-2" onClick={() => restaurantId && load(restaurantId)} aria-label="Refresh riders"><RefreshCw size={16} /></button>
        </div>
      </div>

      {message && <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="rounded bg-white p-8 text-center text-sm text-[#868e96]">Loading rider management...</div> : profile && <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded border border-[#e9ecef] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#212529]">Dispatch settings</h2>
          <p className="mt-1 text-sm text-[#868e96]">Choose which rider pool receives new delivery offers.</p>
          <label className="mt-5 block text-sm font-medium">Dispatch policy<select className="mt-2 w-full rounded border border-[#ced4da] px-3 py-2" value={profile.rider_dispatch_policy} onChange={(event) => void updateProfile({ rider_dispatch_policy: event.target.value })}><option value="ranked">Ranked: private, then open, then platform</option><option value="private_only">Private riders only</option></select></label>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(["private", "open"] as const).map((tier) => { const key = `rider_${tier}_offer_timeout_seconds` as keyof Profile; return <label key={tier} className="text-sm font-medium capitalize">{tier} timeout (sec)<input className="mt-2 w-full rounded border border-[#ced4da] px-3 py-2" type="number" min={1} value={profile[key] as number} onChange={(event) => setProfile({ ...profile, [key]: Number(event.target.value) })} onBlur={() => void updateProfile({ [key]: profile[key] as number })} /></label>; })}
          </div>
        </section>

        <section className="rounded border border-[#e9ecef] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#212529]">Invite a private rider</h2>
          <form className="mt-4 space-y-3" onSubmit={invite}>
            <input className="w-full rounded border border-[#ced4da] px-3 py-2 text-sm" type="email" required placeholder="rider@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            <textarea className="w-full rounded border border-[#ced4da] px-3 py-2 text-sm" placeholder="Optional note" value={notes} onChange={(event) => setNotes(event.target.value)} />
            <button className="inline-flex items-center gap-2 rounded bg-[#e9572d] px-4 py-2 text-sm font-semibold text-white" type="submit"><UserPlus size={16} /> Send invitation</button>
          </form>
        </section>

        <section className="rounded border border-[#e9ecef] bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
                <MapPinned className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[#212529]">Available riders</h2>
                <p className="mt-1 text-sm text-[#868e96]">Live positions of your team, plus open-pool and platform riders nearby.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-[#495057]">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIER_MARKER_COLOR.rider_private }} />Private</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIER_MARKER_COLOR.open }} />Open pool</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIER_MARKER_COLOR.platform }} />Platform</span>
            </div>
          </div>

          <div className="mt-4 h-[360px] overflow-hidden rounded-[10px] border border-[#eceff3]">
            {!mapsLoaded ? (
              <div className="flex h-full items-center justify-center text-sm text-[#868e96]">Loading map...</div>
            ) : (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={
                  profile.latitude && profile.longitude
                    ? { lat: profile.latitude, lng: profile.longitude }
                    : { lat: 28.2096, lng: 83.9856 }
                }
                zoom={13}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                  styles: MINIMAL_MAP_STYLE,
                }}
              >
                {profile.latitude && profile.longitude && (
                  <MarkerF position={{ lat: profile.latitude, lng: profile.longitude }} label="R" title="Your restaurant" />
                )}
                {candidates
                  .filter((rider) => rider.current_latitude != null && rider.current_longitude != null)
                  .map((rider) => (
                    <MarkerF
                      key={rider.id}
                      position={{ lat: rider.current_latitude!, lng: rider.current_longitude! }}
                      icon={markerIcon(TIER_MARKER_COLOR[rider.assignment_type] ?? TIER_MARKER_COLOR.open)}
                      title={`${rider.full_name} — ${TIER_LABEL[rider.assignment_type] ?? rider.assignment_type}${rider.busy ? " (busy)" : ""}`}
                    />
                  ))}
              </GoogleMap>
            )}
          </div>
          {candidates.some((rider) => rider.current_latitude == null) && (
            <p className="mt-2 text-xs text-[#868e96]">Riders without a recent GPS fix aren&apos;t shown on the map, only in the list below.</p>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{candidates.map((rider) => <div className="rounded border border-[#e9ecef] p-4" key={rider.id}><div className="flex justify-between"><span className="font-semibold">{rider.full_name}</span><span className={rider.is_accepting_offers ? "text-green-600" : "text-[#868e96]"}>{rider.is_accepting_offers ? "Online" : "Offline"}</span></div><p className="mt-1 text-sm text-[#868e96]">{rider.phone || "No phone"} · {TIER_LABEL[rider.assignment_type] ?? rider.assignment_type.replace("rider_", "")}</p><p className="mt-2 text-xs text-[#868e96]">{rider.busy ? "Currently busy" : "Available"}{rider.distance_km != null ? ` · ${rider.distance_km.toFixed(1)} km away` : ""}</p>{rider.assignment_type !== "open" && rider.assignment_type !== "platform" ? <button className="mt-3 text-xs font-semibold text-red-600 hover:underline" onClick={() => void removeRider(rider.id)}>Remove from team</button> : null}</div>)}</div>
          {!candidates.length && <p className="mt-4 text-sm text-[#868e96]">No riders are currently available for this restaurant.</p>}
        </section>

        <section className="rounded border border-[#e9ecef] bg-white p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-[#212529]">Invitations</h2>
          <div className="mt-4 divide-y divide-[#e9ecef]">{invitations.map((invitation) => <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={invitation.id}><span>{invitation.invited_email}</span><span className="flex items-center gap-3 text-[#868e96]">{invitation.invitation_type} · {invitation.status}{invitation.status === "pending" || invitation.status === "sent" ? <><button className="font-semibold text-[#e9572d] hover:underline" onClick={() => void invitationAction(invitation.id, "resend")}>Resend</button><button className="font-semibold text-red-600 hover:underline" onClick={() => void invitationAction(invitation.id, "cancel")}>Cancel</button></> : null}</span></div>)}</div>
          {!invitations.length && <p className="mt-4 text-sm text-[#868e96]">No rider invitations yet.</p>}
        </section>
      </div>}
    </MerchantDashboardLayout>
  );
}
