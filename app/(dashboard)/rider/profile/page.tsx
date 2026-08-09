"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/http";

type RiderPayout = {
  id: number;
  orderId: number;
  orderNumber: string | null;
  restaurantName: string | null;
  payoutAmount: number;
  status: string;
};

type RiderProfile = {
  riderUserId: number;
  fullName: string;
  riderWorkMode: string;
  tier: string;
  tierLabel: string;
  lifetimeDeliveries: number;
  deliveriesToNextTier: number | null;
  nextTierLabel: string | null;
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  walletBalance: number | null;
  canAcceptOffers: boolean;
  recentDeliveries: RiderPayout[];
};

const TIER_COLOR: Record<string, string> = {
  platinum: "#6b7280",
  basic: "#2563eb",
  new: "#9aa3b2",
};

export default function RiderProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/riders/me/profile", { auth: true });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.detail || "Failed to load rider profile.");
      setProfile((payload?.data ?? payload) as RiderProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rider profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#fafafb] text-[#111827]">
      <header className="border-b border-[#eceff3] bg-white">
        <div className="mx-auto max-w-[900px] px-6 py-6 lg:px-10 lg:py-7">
          <button
            type="button"
            onClick={() => router.push("/rider")}
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-gray-200 px-3 text-[13px] font-semibold text-[#374151] transition hover:bg-gray-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </button>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">Rider profile</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Tier, earnings, and wallet.</p>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] space-y-5 px-6 py-6 lg:px-10 lg:py-8">
        {loading ? (
          <div className="animate-pulse rounded-[10px] border border-[#eceff3] bg-white py-10 text-center text-sm text-muted-foreground">
            Loading profile...
          </div>
        ) : error ? (
          <div className="rounded-[10px] border border-[#fecdd3] bg-[#fff1f2] py-10 text-center text-sm text-[#be123c]">{error}</div>
        ) : profile ? (
          <>
            <section className="rounded-[10px] border border-[#eceff3] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-bold"
                  style={{
                    color: TIER_COLOR[profile.tier] ?? "#9aa3b2",
                    backgroundColor: `${TIER_COLOR[profile.tier] ?? "#9aa3b2"}1f`,
                  }}
                >
                  {profile.tierLabel} tier
                </span>
                <span className="text-[13px] font-semibold text-muted-foreground">
                  {profile.lifetimeDeliveries} lifetime deliveries
                </span>
              </div>
              {profile.deliveriesToNextTier != null && profile.nextTierLabel ? (
                <p className="mt-3 text-[13px] text-muted-foreground">
                  {profile.deliveriesToNextTier} more deliveries to reach {profile.nextTierLabel}.
                </p>
              ) : null}
            </section>

            <section className="grid grid-cols-3 gap-3">
              <div className="rounded-[10px] border border-[#eceff3] bg-white p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total earnings</div>
                <div className="mt-1.5 text-xl font-bold text-[#111827]">Rs. {profile.totalEarnings.toFixed(0)}</div>
              </div>
              <div className="rounded-[10px] border border-[#eceff3] bg-white p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pending</div>
                <div className="mt-1.5 text-xl font-bold text-[#e8505b]">Rs. {profile.pendingEarnings.toFixed(0)}</div>
              </div>
              <div className="rounded-[10px] border border-[#eceff3] bg-white p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paid out</div>
                <div className="mt-1.5 text-xl font-bold text-[#16a34a]">Rs. {profile.paidEarnings.toFixed(0)}</div>
              </div>
            </section>

            {profile.walletBalance != null ? (
              <section
                className={`rounded-[10px] border p-6 shadow-sm ${
                  profile.canAcceptOffers ? "border-[#eceff3] bg-white" : "border-[#fecdd3] bg-[#fff1f2]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Wallet balance</div>
                    <div className="text-xl font-bold text-[#111827]">Rs. {profile.walletBalance.toFixed(0)}</div>
                  </div>
                </div>
                {!profile.canAcceptOffers ? (
                  <p className="mt-3 text-[13px] font-semibold text-[#be123c]">
                    Your wallet balance is too low to receive new offers. Contact us on WhatsApp to top up.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-[10px] border border-[#eceff3] bg-white shadow-sm">
              <div className="border-b border-[#eceff3] px-6 py-4">
                <h2 className="text-[15px] font-bold text-[#111827]">Recent deliveries</h2>
              </div>
              <div className="divide-y divide-[#eceff3] px-6">
                {profile.recentDeliveries.length === 0 ? (
                  <p className="py-6 text-[13px] text-muted-foreground">No deliveries yet.</p>
                ) : (
                  profile.recentDeliveries.map((delivery) => (
                    <div key={delivery.id} className="flex items-center justify-between py-3.5">
                      <div>
                        <p className="text-[13px] font-semibold text-[#111827]">{delivery.orderNumber ?? `Order #${delivery.orderId}`}</p>
                        <p className="text-[12px] text-muted-foreground">{delivery.restaurantName ?? ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-bold text-[#111827]">Rs. {delivery.payoutAmount.toFixed(0)}</p>
                        <p className="text-[11px] capitalize text-muted-foreground">{delivery.status}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
