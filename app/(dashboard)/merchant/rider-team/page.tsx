"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bike, Mail, RefreshCw, Send, ShieldCheck, Users } from "lucide-react";

import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { extractApiErrorMessage, readJsonSafely, unwrapApiData } from "@/lib/api-utils";
import { apiFetch } from "@/lib/http";

type DispatchPolicy = "ranked" | "private_only";

type RiderInvitation = {
  id: number;
  invited_email: string;
  invitation_type: string;
  status: string;
  notes?: string | null;
  created_at: string;
  responded_at?: string | null;
};

type MerchantRestaurantsResponse = {
  items?: Array<{ id: number; name?: string | null }>;
  active_restaurant_id?: number | null;
};

type MerchantProfile = {
  rider_dispatch_policy?: string | null;
};

function normalizeDispatchPolicy(value: string | null | undefined): DispatchPolicy {
  return value === "private_only" ? "private_only" : "ranked";
}

function buildInvitationPayload(email: string, notes: string) {
  return {
    invited_email: email.trim().toLowerCase(),
    invitation_type: "private",
    notes: notes.trim() || null,
  };
}

export default function MerchantRiderTeamPage() {
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<RiderInvitation[]>([]);
  const [policy, setPolicy] = useState<DispatchPolicy>("ranked");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [inviting, setInviting] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const restaurantsResponse = await apiFetch("/merchant/restaurants/me", { auth: true });
      const restaurantsPayload = await readJsonSafely<MerchantRestaurantsResponse>(restaurantsResponse);
      if (!restaurantsResponse.ok) {
        throw new Error(extractApiErrorMessage(restaurantsPayload, "Failed to load merchant restaurants."));
      }

      const restaurantsData = unwrapApiData(restaurantsPayload);
      const activeRestaurantId = restaurantsData?.active_restaurant_id ?? null;
      const restaurantItems = restaurantsData?.items ?? [];
      const activeRestaurant = restaurantItems.find((item) => item.id === activeRestaurantId) ?? null;

      setRestaurantId(activeRestaurantId);
      setRestaurantName(activeRestaurant?.name?.trim() || "");

      if (!activeRestaurantId) {
        setInvitations([]);
        setPolicy("ranked");
        return;
      }

      const [invitationsResponse, profileResponse] = await Promise.all([
        apiFetch(`/rider-dispatch/restaurants/${activeRestaurantId}/invitations`, { auth: true }),
        apiFetch(`/merchant/restaurants/${activeRestaurantId}/profile`, { auth: true }),
      ]);

      const invitationsPayload = await readJsonSafely<RiderInvitation[] | { data?: RiderInvitation[] }>(invitationsResponse);
      const profilePayload = await readJsonSafely<MerchantProfile | { data?: MerchantProfile }>(profileResponse);

      if (!invitationsResponse.ok) {
        throw new Error(extractApiErrorMessage(invitationsPayload, "Failed to load rider invitations."));
      }
      if (!profileResponse.ok) {
        throw new Error(extractApiErrorMessage(profilePayload, "Failed to load rider dispatch policy."));
      }

      const nextInvitations = Array.isArray(invitationsPayload)
        ? invitationsPayload
        : invitationsPayload?.data ?? [];
      const nextProfile: MerchantProfile | null =
        profilePayload && typeof profilePayload === "object" && "data" in profilePayload
          ? profilePayload.data ?? null
          : (profilePayload as MerchantProfile | null);

      setInvitations(Array.isArray(nextInvitations) ? nextInvitations : []);
      setPolicy(normalizeDispatchPolicy(nextProfile?.rider_dispatch_policy));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load rider team.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite() {
    if (!restaurantId || !email.trim()) {
      return;
    }

    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(`/rider-dispatch/restaurants/${restaurantId}/invitations`, {
        method: "POST",
        auth: true,
        body: JSON.stringify(buildInvitationPayload(email, notes)),
      });
      const payload = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload, "Failed to invite rider."));
      }

      setEmail("");
      setNotes("");
      setSuccess("Private rider invitation sent.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to invite rider.");
    } finally {
      setInviting(false);
    }
  }

  async function handleSavePolicy() {
    if (!restaurantId) {
      return;
    }

    setSavingPolicy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(`/merchant/restaurants/${restaurantId}/profile`, {
        method: "PUT",
        auth: true,
        body: JSON.stringify({ rider_dispatch_policy: policy }),
      });
      const payload = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload, "Failed to update dispatch policy."));
      }

      setSuccess("Dispatch policy updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update dispatch policy.");
    } finally {
      setSavingPolicy(false);
    }
  }

  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] font-medium text-[#868e96]">
        <span className="text-[#e53e4f]">Management</span>
        <span className="mx-2">/</span>
        <span>Rider team</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-[#212529]">Rider Team</h1>
          <p className="mt-2 max-w-3xl text-[15px] text-[#6b7280]">
            Manage private riders and dispatch fallback for {restaurantName || "your active restaurant"}.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="mb-6 rounded border border-[#fecdcd] bg-[#fff5f5] px-6 py-4 text-[14px] text-[#c92a2a]">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-6 rounded border border-[#c3fae8] bg-[#ebfbee] px-6 py-4 text-[14px] text-[#087f5b]">
          {success}
        </div>
      ) : null}

      {!loading && !restaurantId ? (
        <Card className="border-[#efe4d8]">
          <CardContent className="space-y-3 p-6 text-sm text-[#6b7280]">
            <p>Switch into a merchant restaurant first, then the rider team page will load against that restaurant.</p>
            <Link href="/merchant">
              <Button>Open Merchant Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-[#efe4d8] bg-white">
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#fff3e8] p-3 text-[#e8590c]">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold text-[#495057]">Invite a private rider</h2>
                  <p className="text-[14px] text-[#868e96]">
                    The user must already have rider access and must accept this invitation.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[13px] font-semibold text-[#495057]">Rider email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="rider@example.com"
                  className="h-11 w-full rounded border border-[#dee2e6] bg-white px-3 text-[14px] text-[#495057]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[13px] font-semibold text-[#495057]">Note (optional)</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Shift, zone, or internal note"
                  className="min-h-[130px] w-full rounded border border-[#dee2e6] bg-white px-3 py-3 text-[14px] text-[#495057]"
                />
              </div>

              <Button type="button" disabled={!restaurantId || !email.trim() || inviting} onClick={() => void handleInvite()}>
                <Send className="mr-2 h-4 w-4" />
                {inviting ? "Sending..." : "Send invitation"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[#efe4d8] bg-white">
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#ebfbee] p-3 text-[#2b8a3e]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold text-[#495057]">Dispatch policy</h2>
                  <p className="text-[14px] text-[#868e96]">
                    Choose how delivery offers flow once private riders exist.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[13px] font-semibold text-[#495057]">Policy</label>
                <select
                  value={policy}
                  onChange={(event) => setPolicy(normalizeDispatchPolicy(event.target.value))}
                  className="h-11 w-full rounded border border-[#dee2e6] bg-white px-3 text-[14px] text-[#495057]"
                >
                  <option value="ranked">Private riders first, then freelancers</option>
                  <option value="private_only">Private riders only</option>
                </select>
              </div>

              <div className="rounded border border-[#f1f3f5] bg-[#f8f9fa] p-4 text-[14px] text-[#6b7280]">
                {policy === "private_only"
                  ? "Only riders who accepted your private invitation can receive delivery offers."
                  : "Private riders get priority. If nobody accepts, freelance riders remain eligible."}
              </div>

              <Button type="button" variant="secondary" disabled={!restaurantId || savingPolicy} onClick={() => void handleSavePolicy()}>
                {savingPolicy ? "Saving..." : "Save policy"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[#efe4d8] bg-white xl:col-span-2">
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#e7f5ff] p-3 text-[#1971c2]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold text-[#495057]">Invitation history</h2>
                  <p className="text-[14px] text-[#868e96]">
                    Accepted invitations become private rider relationships for this restaurant.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="rounded border border-[#efe4d8] bg-[#fffdf8] px-6 py-5 text-sm text-[#6b7280]">
                  Loading rider team...
                </div>
              ) : invitations.length === 0 ? (
                <div className="rounded border border-dashed border-[#efe4d8] px-6 py-10 text-center">
                  <Bike className="mx-auto mb-3 h-8 w-8 text-[#adb5bd]" />
                  <p className="text-[16px] font-semibold text-[#495057]">No private rider invitations yet</p>
                  <p className="mt-2 text-[14px] text-[#6b7280]">Invite a rider by email to start your restaurant team.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="rounded border border-[#efe4d8] bg-[#fffdf8] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[16px] font-semibold text-[#495057]">{invitation.invited_email}</p>
                          <p className="mt-1 text-[14px] text-[#6b7280]">{invitation.notes || "No note provided."}</p>
                        </div>
                        <span className="rounded bg-[#f1f3f5] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#495057]">
                          {invitation.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-[#868e96]">
                        <span>Sent {new Date(invitation.created_at).toLocaleString()}</span>
                        {invitation.responded_at ? (
                          <span>Updated {new Date(invitation.responded_at).toLocaleString()}</span>
                        ) : null}
                        <span>Type: {invitation.invitation_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </MerchantDashboardLayout>
  );
}
