"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { UserPlus, RefreshCw } from "lucide-react";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { apiFetch } from "@/lib/http";

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
  rider_preferred_offer_timeout_seconds: number;
  rider_open_offer_timeout_seconds: number;
};

const unwrap = <T,>(payload: any): T => payload?.data ?? payload;

export default function MerchantRidersPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [invitationType, setInvitationType] = useState("private");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      body: JSON.stringify({ invited_email: email.trim(), invitation_type: invitationType, notes: notes.trim() || null }),
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
          <label className="mt-5 block text-sm font-medium">Dispatch policy<select className="mt-2 w-full rounded border border-[#ced4da] px-3 py-2" value={profile.rider_dispatch_policy} onChange={(event) => void updateProfile({ rider_dispatch_policy: event.target.value })}><option value="ranked">Ranked: private, preferred, then open</option><option value="private_only">Private riders only</option></select></label>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {(["private", "preferred", "open"] as const).map((tier) => { const key = `rider_${tier}_offer_timeout_seconds` as keyof Profile; return <label key={tier} className="text-sm font-medium capitalize">{tier} timeout (sec)<input className="mt-2 w-full rounded border border-[#ced4da] px-3 py-2" type="number" min={1} value={profile[key] as number} onChange={(event) => setProfile({ ...profile, [key]: Number(event.target.value) })} onBlur={() => void updateProfile({ [key]: profile[key] as number })} /></label>; })}
          </div>
        </section>

        <section className="rounded border border-[#e9ecef] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#212529]">Invite a private rider</h2>
          <form className="mt-4 space-y-3" onSubmit={invite}>
            <input className="w-full rounded border border-[#ced4da] px-3 py-2 text-sm" type="email" required placeholder="rider@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            <select className="w-full rounded border border-[#ced4da] px-3 py-2 text-sm" value={invitationType} onChange={(event) => setInvitationType(event.target.value)}><option value="private">Private rider</option><option value="preferred">Preferred rider</option></select>
            <textarea className="w-full rounded border border-[#ced4da] px-3 py-2 text-sm" placeholder="Optional note" value={notes} onChange={(event) => setNotes(event.target.value)} />
            <button className="inline-flex items-center gap-2 rounded bg-[#e9572d] px-4 py-2 text-sm font-semibold text-white" type="submit"><UserPlus size={16} /> Send invitation</button>
          </form>
        </section>

        <section className="rounded border border-[#e9ecef] bg-white p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-[#212529]">Available riders</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{candidates.map((rider) => <div className="rounded border border-[#e9ecef] p-4" key={rider.id}><div className="flex justify-between"><span className="font-semibold">{rider.full_name}</span><span className={rider.is_accepting_offers ? "text-green-600" : "text-[#868e96]"}>{rider.is_accepting_offers ? "Online" : "Offline"}</span></div><p className="mt-1 text-sm text-[#868e96]">{rider.phone || "No phone"} · {rider.assignment_type.replace("rider_", "")}</p><p className="mt-2 text-xs text-[#868e96]">{rider.busy ? "Currently busy" : "Available"}{rider.distance_km != null ? ` · ${rider.distance_km.toFixed(1)} km away` : ""}</p></div>)}</div>
          {!candidates.length && <p className="mt-4 text-sm text-[#868e96]">No riders are currently available for this restaurant.</p>}
        </section>

        <section className="rounded border border-[#e9ecef] bg-white p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-[#212529]">Invitations</h2>
          <div className="mt-4 divide-y divide-[#e9ecef]">{invitations.map((invitation) => <div className="flex items-center justify-between py-3 text-sm" key={invitation.id}><span>{invitation.invited_email}</span><span className="text-[#868e96]">{invitation.invitation_type} · {invitation.status}</span></div>)}</div>
          {!invitations.length && <p className="mt-4 text-sm text-[#868e96]">No rider invitations yet.</p>}
        </section>
      </div>}
    </MerchantDashboardLayout>
  );
}
