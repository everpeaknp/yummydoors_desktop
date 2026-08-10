"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Award, Bolt, Check, ChevronRight, Info, Leaf, Lock, Percent, Star, Trophy, Wallet } from "lucide-react";
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
  averageRating: number | null;
  totalReviews: number;
  recentDeliveries: RiderPayout[];
};

const ACCENT = "#e8505b";
const ACCENT_SUBTLE = "#fff1f2";

type TierDef = {
  key: string;
  label: string;
  minDeliveries: number;
  commissionPercent: number;
  icon: typeof Leaf;
};

// Kept in sync with the backend's RIDER_TIERS (app/modules/rider_payouts/tier.py).
const TIER_LADDER: TierDef[] = [
  { key: "new", label: "New", minDeliveries: 0, commissionPercent: 20, icon: Leaf },
  { key: "basic", label: "Basic", minDeliveries: 50, commissionPercent: 18, icon: Award },
  { key: "platinum", label: "Platinum", minDeliveries: 100, commissionPercent: 15, icon: Trophy },
];

function dispatchLabel(tierKey: string) {
  if (tierKey === "platinum") return "First pick";
  if (tierKey === "basic") return "Priority";
  return "Standard";
}

function RiderStandingCard({ profile }: { profile: RiderProfile }) {
  const [expanded, setExpanded] = useState(false);
  const tier = TIER_LADDER.find((t) => t.key === profile.tier) ?? TIER_LADDER[0];
  const currentIndex = TIER_LADDER.indexOf(tier);
  const isMaxTier = profile.deliveriesToNextTier == null;
  const nextMin = isMaxTier ? null : profile.lifetimeDeliveries + (profile.deliveriesToNextTier ?? 0);
  const progress = isMaxTier
    ? 1
    : Math.min(1, Math.max(0, (profile.lifetimeDeliveries - tier.minDeliveries) / Math.max(1, (nextMin ?? 1) - tier.minDeliveries)));
  const TierIcon = tier.icon;

  return (
    <section className="rounded-[10px] border border-[#eceff3] bg-white p-6">
      <div className="flex items-center gap-3.5">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[12px]" style={{ backgroundColor: ACCENT_SUBTLE }}>
          <TierIcon className="h-6 w-6" style={{ color: ACCENT }} />
        </span>
        <div className="flex-1">
          <div className="text-[19px] font-extrabold text-[#111827]">{tier.label} Rider</div>
          {profile.totalReviews > 0 ? (
            <div className="mt-1 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-[#f59e0b]" style={{ color: "#f59e0b" }} />
              <span className="text-[12.5px] font-bold text-[#111827]">{profile.averageRating?.toFixed(1)}</span>
              <span className="text-[11px] text-muted-foreground">
                ({profile.totalReviews} {profile.totalReviews === 1 ? "review" : "reviews"})
              </span>
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-muted-foreground">No reviews yet</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[22px] font-extrabold" style={{ color: ACCENT }}>
            {profile.lifetimeDeliveries}
          </div>
          <div className="text-[10.5px] text-muted-foreground">deliveries</div>
        </div>
      </div>

      <div className="mt-5">
        {isMaxTier ? (
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
            <Trophy className="h-4 w-4" style={{ color: ACCENT }} />
            Top tier unlocked — you&apos;re at the peak!
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-[#111827]">
                <span className="font-extrabold" style={{ color: ACCENT }}>
                  {profile.lifetimeDeliveries}
                </span>{" "}
                / {nextMin} deliveries
              </span>
              <span className="text-[13px] font-extrabold text-[#111827]">{Math.round(progress * 100)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef0f3]">
              <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: ACCENT }} />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {profile.deliveriesToNextTier} more {profile.deliveriesToNextTier === 1 ? "delivery" : "deliveries"} to reach{" "}
              {profile.nextTierLabel}
            </p>
          </>
        )}
      </div>

      <div className="my-5 border-t border-[#eef0f3]" />

      <div className="flex items-center">
        {TIER_LADDER.map((def, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLocked = index > currentIndex;
          const Icon = def.icon;
          return (
            <div key={def.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isLocked ? "#f2f3f5" : isCurrent ? ACCENT : ACCENT_SUBTLE,
                  }}
                >
                  {isDone ? (
                    <Check className="h-[18px] w-[18px]" style={{ color: isCurrent ? "#fff" : ACCENT }} />
                  ) : isLocked ? (
                    <Lock className="h-[18px] w-[18px] text-[#9aa3b2]" />
                  ) : (
                    <Icon className="h-[18px] w-[18px]" style={{ color: isCurrent ? "#fff" : ACCENT }} />
                  )}
                </span>
                <span
                  className="mt-1.5 text-[11px] font-semibold"
                  style={{ color: isLocked ? "#8692a9" : isCurrent ? ACCENT : "#111827" }}
                >
                  {def.label}
                </span>
              </div>
              {index !== TIER_LADDER.length - 1 ? (
                <div className="mx-1.5 h-[2px] flex-1" style={{ backgroundColor: index < currentIndex ? ACCENT : "#e2e8f0" }} />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-[12px] bg-[#f6f7fb] p-3.5">
        <div className="text-[12px] font-bold text-[#111827]">Your current benefits</div>
        <div className="mt-3 grid grid-cols-2 divide-x divide-[#e2e5ea]">
          <div className="flex flex-col items-center gap-1.5 px-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: ACCENT_SUBTLE }}>
              <Percent className="h-3.5 w-3.5" style={{ color: ACCENT }} />
            </span>
            <span className="text-center text-[12px] font-semibold text-[#111827]">{100 - tier.commissionPercent}% earnings</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 px-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: ACCENT_SUBTLE }}>
              <Bolt className="h-3.5 w-3.5" style={{ color: ACCENT }} />
            </span>
            <span className="text-center text-[12px] font-semibold text-[#111827]">{dispatchLabel(tier.key)} dispatch</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="mx-auto mt-3.5 flex items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#3f444a] transition hover:bg-gray-50"
      >
        {expanded ? "Hide level benefits" : "View all level benefits"}
        <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded ? (
        <div className="mt-3.5 space-y-2">
          {TIER_LADDER.map((def) => {
            const isCurrent = def.key === tier.key;
            const Icon = def.icon;
            return (
              <div
                key={def.key}
                className="flex items-center gap-2 rounded-[10px] px-3 py-2.5"
                style={{
                  backgroundColor: isCurrent ? ACCENT_SUBTLE : "#f6f7fb",
                  border: isCurrent ? `1px solid ${ACCENT}4d` : undefined,
                }}
              >
                <Icon className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                <span className="flex-1 text-[12px] font-bold text-[#111827]">
                  {def.label} · {def.minDeliveries}+ deliveries
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {100 - def.commissionPercent}% · {dispatchLabel(def.key)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

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
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-[16px] font-bold text-[#111827]">Rider standing</h2>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Your level is based on completed deliveries</p>
              <div className="mt-3.5">
                <RiderStandingCard profile={profile} />
              </div>
            </div>

            <section className="grid grid-cols-3 gap-3">
              <div className="rounded-[10px] border border-[#eceff3] bg-white p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total earnings</div>
                <div className="mt-1.5 text-xl font-bold text-[#111827]">Rs. {profile.totalEarnings.toFixed(0)}</div>
              </div>
              <div className="rounded-[10px] border border-[#eceff3] bg-white p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pending</div>
                <div className="mt-1.5 text-xl font-bold text-[#e8505b]">Rs. {profile.pendingEarnings.toFixed(0)}</div>
              </div>
              <div className="rounded-[10px] border border-[#eceff3] bg-white p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paid out</div>
                <div className="mt-1.5 text-xl font-bold text-[#16a34a]">Rs. {profile.paidEarnings.toFixed(0)}</div>
              </div>
            </section>

            {profile.walletBalance != null ? (
              <section
                className={`rounded-[10px] border p-6 ${
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

            <section className="rounded-[10px] border border-[#eceff3] bg-white">
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
