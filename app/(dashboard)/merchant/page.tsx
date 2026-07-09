"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowRightLeft,
  Building2,
  CalendarDays,
  CircleAlert,
  Layers3,
  Link2,
  PanelTop,
  Store,
  Table2,
  Mail,
  Star,
  ShoppingCart,
  Heart,
  ChevronRight,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { mapStoredUser } from "@/lib/auth-mappers";
import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth-store";

type RequestType = "create_external" | "claim_existing" | "pos_link";

type MerchantRestaurantRequest = {
  id: number;
  request_type: RequestType;
  status: string;
  restaurant_id: number | null;
  requested_name: string;
  requested_slug: string | null;
  city: string | null;
  area: string | null;
  source_system: string;
  pos_restaurant_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type MerchantApplication = {
  id: number;
  user_id: number;
  workspace_id: number | null;
  workspace: {
    id: number;
    workspace_type: string;
    name: string;
    slug: string | null;
    status: string;
    membership_role: string;
    is_primary: boolean;
    primary_restaurant_id: number | null;
    primary_restaurant_name: string | null;
  } | null;
  status: string;
  business_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  admin_notes: string | null;
  restaurant_requests: MerchantRestaurantRequest[];
  created_at: string;
  updated_at: string;
};

type MerchantRestaurant = {
  id: number;
  name: string;
  slug: string;
  city: string | null;
  area: string | null;
  integration_mode: string;
  status: string;
  logo_url: string | null;
  cover_image_url: string | null;
  primary_cuisine_label: string | null;
  is_active_context: boolean;
  ownership_types: string[];
};

type MerchantRestaurantListResponse = {
  active_restaurant_id: number | null;
  items: MerchantRestaurant[];
};

type PublicRestaurant = {
  id: number;
  name: string;
  slug: string;
  city: string | null;
  area: string | null;
  primary_cuisine_label: string | null;
  integration_mode?: string;
  cover_image_url: string | null;
  logo_url: string | null;
};

function extractErrorMessage(payload: any) {
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
    return payload.detail
      .map((issue: { msg?: string }) => issue.msg)
      .filter(Boolean)
      .join(" ");
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return "Something went wrong.";
}

function formatStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function requestTypeMeta(type: RequestType) {
  if (type === "claim_existing") {
    return {
      label: "Claim Existing",
      title: "Claim an existing restaurant",
      description: "Attach an already-listed YummyDoors restaurant to your merchant workspace.",
    };
  }
  if (type === "pos_link") {
    return {
      label: "POS Linked",
      title: "Request POS-linked access",
      description: "Match a Yummy POS identity with a restaurant you should operate in YummyDoors.",
    };
  }
  return {
    label: "Create External",
    title: "Launch a new restaurant",
    description: "Create a brand-new external restaurant that YummyDoors will operate directly.",
  };
}

const requestTypeCards: Array<{
  type: RequestType;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    type: "create_external",
    eyebrow: "Launch",
    title: "Create a new restaurant",
    description: "For restaurants starting directly in YummyDoors without POS ownership yet.",
  },
  {
    type: "claim_existing",
    eyebrow: "Claim",
    title: "Claim an existing listing",
    description: "For restaurants already listed in YummyDoors that need the right merchant owner.",
  },
  {
    type: "pos_link",
    eyebrow: "POS",
    title: "Request POS-linked access",
    description: "For owners already tied to Yummy POS who should manage a linked restaurant here too.",
  },
];

export default function MerchantPage() {
  const router = useRouter();
  const { hydrated, accessToken, user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);

  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [merchantRestaurants, setMerchantRestaurants] = useState<MerchantRestaurantListResponse>({
    active_restaurant_id: null,
    items: [],
  });
  const [publicRestaurants, setPublicRestaurants] = useState<PublicRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [switchingRestaurantId, setSwitchingRestaurantId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [requestType, setRequestType] = useState<RequestType>("create_external");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [selectedPosRestaurantId, setSelectedPosRestaurantId] = useState("");
  const [notes, setNotes] = useState("");

  const merchantWorkspace =
    user?.workspaces?.find((workspace) => workspace.workspaceType === "merchant") ?? null;
  const activeRestaurant = merchantRestaurants.items.find((item) => item.is_active_context) ?? null;
  const activeApplication =
    applications.find((application) => application.status === "draft" || application.status === "submitted") ??
    null;
  const latestApplication = applications[0] ?? null;
  const hasApprovedMerchant = Boolean(merchantWorkspace?.status === "active");

  const ownedRestaurantIds = useMemo(
    () => new Set(merchantRestaurants.items.map((restaurant) => restaurant.id)),
    [merchantRestaurants.items],
  );

  const claimableRestaurants = useMemo(
    () => publicRestaurants.filter((restaurant) => !ownedRestaurantIds.has(restaurant.id)),
    [ownedRestaurantIds, publicRestaurants],
  );

  const posMatchedRestaurants = user?.posLinkStatus?.matchedRestaurants ?? [];

  const resetRequestFields = useCallback(() => {
    setRestaurantName("");
    setCity("");
    setArea("");
    setSelectedRestaurantId("");
    setSelectedPosRestaurantId("");
    setNotes("");
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await apiFetch("/auth/me", { auth: true });
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    if (payload?.data) {
      const nextUser = mapStoredUser(payload.data);
      setUser(nextUser);
      setBusinessName((current) => current || nextUser.activeWorkspace?.name || nextUser.fullName || "");
      setContactName((current) => current || nextUser.fullName || "");
      setContactEmail((current) => current || nextUser.email || "");
      setContactPhone((current) => current || nextUser.phone || "");
    }
  }, [setUser]);

  const loadMerchantState = useCallback(async () => {
    const [userResponse, applicationsResponse, merchantRestaurantsResponse, publicRestaurantsResponse] =
      await Promise.all([
        apiFetch("/auth/me", { auth: true }),
        apiFetch("/merchant/applications/me", { auth: true }),
        apiFetch("/merchant/restaurants/me", { auth: true }),
        apiFetch("/restaurants"),
      ]);

    if (
      userResponse.status === 401 ||
      applicationsResponse.status === 401 ||
      merchantRestaurantsResponse.status === 401
    ) {
      router.replace("/login");
      return;
    }

    if (!userResponse.ok) {
      const payload = await userResponse.json().catch(() => null);
      throw new Error(extractErrorMessage(payload));
    }
    if (!applicationsResponse.ok) {
      const payload = await applicationsResponse.json().catch(() => null);
      throw new Error(extractErrorMessage(payload));
    }
    if (!merchantRestaurantsResponse.ok) {
      const payload = await merchantRestaurantsResponse.json().catch(() => null);
      throw new Error(extractErrorMessage(payload));
    }
    if (!publicRestaurantsResponse.ok) {
      const payload = await publicRestaurantsResponse.json().catch(() => null);
      throw new Error(extractErrorMessage(payload));
    }

    const [userPayload, applicationsPayload, merchantRestaurantsPayload, publicRestaurantsPayload] =
      await Promise.all([
        userResponse.json(),
        applicationsResponse.json(),
        merchantRestaurantsResponse.json(),
        publicRestaurantsResponse.json(),
      ]);

    const nextUser = mapStoredUser(userPayload.data);
    setUser(nextUser);
    setApplications(Array.isArray(applicationsPayload?.data) ? applicationsPayload.data : []);
    setMerchantRestaurants(
      merchantRestaurantsPayload?.data ?? { active_restaurant_id: null, items: [] },
    );
    setPublicRestaurants(publicRestaurantsPayload?.data?.items ?? []);

    setBusinessName((current) => current || nextUser.activeWorkspace?.name || nextUser.fullName || "");
    setContactName((current) => current || nextUser.fullName || "");
    setContactEmail((current) => current || nextUser.email || "");
    setContactPhone((current) => current || nextUser.phone || "");
  }, [router, setUser]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        await loadMerchantState();
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load merchant state.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [accessToken, hydrated, loadMerchantState, router]);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      if (!hasApprovedMerchant || !activeRestaurant) return;
      setLoadingStats(true);
      try {
        const response = await apiFetch("/merchant/restaurants/me/stats", { auth: true });
        if (response.ok) {
          const payload = await response.json();
          if (!cancelled) setStats(payload);
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [hasApprovedMerchant, activeRestaurant]);

  async function handleRestaurantSwitch(restaurantId: number) {
    setError(null);
    setSuccess(null);
    setSwitchingRestaurantId(restaurantId);
    try {
      const response = await apiFetch("/merchant/restaurants/switch", {
        method: "POST",
        auth: true,
        body: JSON.stringify({ restaurant_id: restaurantId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload));
      }
      setMerchantRestaurants(payload.data);
      await refreshUser();
      const selected = payload.data.items.find((item: MerchantRestaurant) => item.id === restaurantId);
      setSuccess(`Active restaurant switched to ${selected?.name ?? "the selected restaurant"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to switch restaurant context.");
    } finally {
      setSwitchingRestaurantId(null);
    }
  }

  async function handleExitMerchantMode() {
    setError(null);
    const customerWorkspace = user?.workspaces?.find((w) => w.workspaceType === "customer");
    if (!customerWorkspace) {
      router.push("/");
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch("/workspaces/switch", {
        method: "POST",
        auth: true,
        body: JSON.stringify({ workspace_id: customerWorkspace.id }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(extractErrorMessage(payload));
      }
      await refreshUser();
      router.push("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to exit merchant mode.");
      setLoading(false);
    }
  }

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!businessName.trim() || !contactName.trim()) {
      setError("Business name and contact name are required.");
      return;
    }

    if (requestType === "create_external" && !restaurantName.trim()) {
      setError("Restaurant name is required for an external restaurant request.");
      return;
    }

    if (requestType === "claim_existing" && !selectedRestaurantId) {
      setError("Choose a restaurant to claim.");
      return;
    }

    if (requestType === "pos_link" && (!selectedRestaurantId || !selectedPosRestaurantId)) {
      setError("Choose both a restaurant and a POS identity to request POS-linked access.");
      return;
    }

    setSubmitting(true);
    try {
      let applicationId = activeApplication?.status === "draft" ? activeApplication.id : null;

      if (!applicationId) {
        const applicationResponse = await apiFetch("/merchant/applications", {
          method: "POST",
          auth: true,
          body: JSON.stringify({
            business_name: businessName.trim(),
            contact_name: contactName.trim(),
            contact_email: contactEmail.trim() || null,
            contact_phone: contactPhone.trim() || null,
            notes: notes.trim() || null,
          }),
        });
        const applicationPayload = await applicationResponse.json();
        if (!applicationResponse.ok) {
          throw new Error(extractErrorMessage(applicationPayload));
        }
        applicationId = applicationPayload?.data?.id ?? null;
      }

      if (!applicationId) {
        throw new Error("Merchant application id was not returned.");
      }

      const selectedRestaurant =
        requestType === "create_external"
          ? null
          : publicRestaurants.find((restaurant) => restaurant.id === Number(selectedRestaurantId)) ?? null;

      const requestPayload =
        requestType === "create_external"
          ? {
              request_type: "create_external",
              requested_name: restaurantName.trim(),
              city: city.trim() || null,
              area: area.trim() || null,
              notes: notes.trim() || null,
            }
          : {
              request_type: requestType,
              restaurant_id: Number(selectedRestaurantId),
              requested_name: selectedRestaurant?.name ?? restaurantName.trim(),
              city: selectedRestaurant?.city ?? (city.trim() || null),
              area: selectedRestaurant?.area ?? (area.trim() || null),
              pos_restaurant_id: requestType === "pos_link" ? selectedPosRestaurantId : null,
              notes: notes.trim() || null,
            };

      const requestResponse = await apiFetch(
        `/merchant/applications/${applicationId}/restaurant-requests`,
        {
          method: "POST",
          auth: true,
          body: JSON.stringify(requestPayload),
        },
      );
      const requestResponsePayload = await requestResponse.json();
      if (!requestResponse.ok) {
        throw new Error(extractErrorMessage(requestResponsePayload));
      }

      const submitResponse = await apiFetch(`/merchant/applications/${applicationId}/submit`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({}),
      });
      const submitPayload = await submitResponse.json();
      if (!submitResponse.ok) {
        throw new Error(extractErrorMessage(submitPayload));
      }

      await loadMerchantState();
      resetRequestFields();
      setSuccess(`${requestTypeMeta(requestType).title} has been submitted for review.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to submit merchant request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Preparing merchant surface...
      </div>
    );
  }

  if (!accessToken) {
    return null;
  }

  const selectedRequestMeta = requestTypeMeta(requestType);

  const dynamicChartData = stats?.order_volume_14d?.map((d: any) => ({
    name: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: d.count,
  })) || [];

  if (hasApprovedMerchant) {
    return (
      <MerchantDashboardLayout>
        {activeRestaurant ? (
          <div>
            <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
              <span className="text-[#e53e4f]">Dashboard</span>
              <span className="mx-2">/</span>
              <span>My Dashboard</span>
            </div>
            
            {/* 4 Stat Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              {[
                { label: `${stats?.unread_messages ?? 0} New Messages!`, bgColor: "bg-[#0d84ff]", icon: Mail, link: "/merchant/messages" },
                { label: `${stats?.new_reviews ?? 0} New Reviews!`, bgColor: "bg-[#f5b800]", icon: Star, link: "/merchant/reviews" },
                { label: `${stats?.new_orders ?? 0} New Orders!`, bgColor: "bg-[#25b546]", icon: ShoppingCart, link: "/merchant/orders" },
                { label: `${stats?.new_bookmarks ?? 0} New Bookmarks!`, bgColor: "bg-[#e53e4f]", icon: Heart, link: "/merchant/presence" },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <Link href={stat.link} key={i} className={`flex flex-col justify-between overflow-hidden rounded text-white shadow-sm transition hover:-translate-y-1 ${stat.bgColor}`}>
                    <div className="p-6 flex items-center justify-between">
                      <h3 className="text-[20px] font-bold tracking-tight">{stat.label}</h3>
                      <Icon className="h-10 w-10 opacity-30" strokeWidth={2} />
                    </div>
                    <div className="bg-black/10 px-6 py-3 hover:bg-black/20 transition cursor-pointer flex items-center justify-between text-[13px] font-medium">
                      <span>View Details</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                );
              })}
            </div>
            
            {/* Statistic Graph */}
            <div className="bg-white rounded shadow-sm border border-[#e9ecef] overflow-hidden">
               <div className="border-b border-[#e9ecef] px-6 py-4 flex items-center gap-3 justify-between">
                 <div className="flex items-center gap-3">
                   <Store className="w-5 h-5 text-[#868e96]" />
                   <h3 className="text-[18px] font-semibold text-[#495057]">Order Volume (Last 14 Days)</h3>
                 </div>
                 {loadingStats && <span className="text-[13px] text-[#868e96]">Loading...</span>}
               </div>
               <div className="p-6 h-[400px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dynamicChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8f9fa" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#868e96' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#868e96' }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="value" stroke="#0d84ff" strokeWidth={2} fill="#0d84ff" fillOpacity={0.2} />
                    </AreaChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>
        ) : (
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <Store className="mb-4 h-16 w-16 text-gray-300" />
            <h2 className="text-2xl font-bold text-gray-800">Select a restaurant</h2>
            <p className="mt-2 text-gray-500">Use the Operating Context menu in the sidebar to enter a restaurant dashboard.</p>
          </div>
        )}
      </MerchantDashboardLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] text-gray-800 antialiased pb-20">
      <SiteNavbar className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl" />

      <main className="bg-[#faf7f2] pb-20">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12 lg:px-10">
              {error ? (
                <div className="rounded-[18px] border border-[#ffd8cc] bg-[#fff4ef] px-5 py-4 text-sm text-[#9a3412]">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-[18px] border border-[#d4f3db] bg-[#f3fff6] px-5 py-4 text-sm text-[#166534]">
                  {success}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-[24px] border border-[#f0e7dd] bg-white px-6 py-8 text-sm text-[#7a7a7a] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                  Loading merchant context...
                </div>
              ) : null}

              <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <Card className="overflow-hidden rounded-[28px] border border-[#efe4d8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
                  <CardContent className="p-0">
                    <div className="border-b border-[#f2e8de] px-7 py-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Request Paths</p>
                      <h2 className="mt-3 text-[30px] font-semibold tracking-tight text-[#1f2937]">
                        Build your restaurant presence the right way.
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6b7280]">
                        Each request path maps to a different backend workflow, but all of them stay under
                        the same merchant identity and workspace.
                      </p>
                    </div>

                    <div className="grid gap-4 px-7 py-7 md:grid-cols-3">
                      {requestTypeCards.map((card) => (
                        <button
                          key={card.type}
                          type="button"
                          onClick={() => setRequestType(card.type)}
                          className={`rounded-[22px] border px-5 py-5 text-left transition ${
                            requestType === card.type
                              ? "border-primary bg-[#fff4ec] shadow-[0_14px_36px_rgba(249,115,22,0.12)]"
                              : "border-[#eee4d7] bg-[#fcfaf7] hover:border-[#ffd5bf]"
                          }`}
                        >
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                            {card.eyebrow}
                          </p>
                          <h3 className="mt-3 text-lg font-semibold text-[#1f2937]">{card.title}</h3>
                          <p className="mt-3 text-sm leading-7 text-[#6b7280]">{card.description}</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border border-[#efe4d8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
                  <CardContent className="space-y-5 p-7">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Application state</p>
                      <h2 className="mt-3 text-2xl font-semibold text-[#1f2937]">
                        {latestApplication ? latestApplication.business_name : "No merchant application yet"}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-[#6b7280]">
                        {latestApplication
                          ? `Latest status: ${formatStatus(latestApplication.status)}`
                          : "Open a request below to create the first merchant application."}
                      </p>
                    </div>

                    {latestApplication ? (
                      <div className="rounded-[22px] border border-[#f3e8dd] bg-[#fcfaf7] px-5 py-5">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                            {formatStatus(latestApplication.status)}
                          </span>
                          {latestApplication.workspace ? (
                            <span className="rounded-full border border-[#eadfce] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
                              {latestApplication.workspace.name}
                            </span>
                          ) : null}
                        </div>
                        {latestApplication.admin_notes ? (
                          <div className="mt-4 rounded-[18px] border border-[#ffe2cf] bg-[#fff6f0] px-4 py-4 text-sm leading-7 text-[#9a3412]">
                            <div className="mb-2 flex items-center gap-2 font-medium">
                              <CircleAlert className="h-4 w-4" />
                              Ops/admin notes
                            </div>
                            {latestApplication.admin_notes}
                          </div>
                        ) : null}
                        <div className="mt-4 space-y-3">
                          {latestApplication.restaurant_requests.map((request) => (
                            <div
                              key={request.id}
                              className="rounded-[18px] border border-[#eadfce] bg-white px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm font-semibold text-[#1f2937]">{request.requested_name}</span>
                                <span className="rounded-full bg-[#fcfaf7] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">
                                  {requestTypeMeta(request.request_type).label}
                                </span>
                                <span className="rounded-full bg-[#fff4ec] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                                  {formatStatus(request.status)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-[#6b7280]">
                                {[request.city, request.area].filter(Boolean).join(" • ") || "No location attached"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </section>

              {!activeApplication ? (
                <Card className="rounded-[28px] border border-[#efe4d8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
                  <CardContent className="grid gap-8 p-0 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="border-b border-[#f2e8de] bg-[#fcfaf7] px-7 py-8 lg:border-b-0 lg:border-r">
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                        {selectedRequestMeta.label}
                      </p>
                      <h2 className="mt-3 text-[30px] font-semibold tracking-tight text-[#1f2937]">
                        {selectedRequestMeta.title}
                      </h2>
                      <p className="mt-4 text-sm leading-7 text-[#6b7280]">
                        {selectedRequestMeta.description}
                      </p>
                      <div className="mt-8 space-y-3">
                        <div className="rounded-[20px] border border-[#efe4d8] bg-white px-5 py-4 text-sm leading-7 text-[#6b7280]">
                          We create one merchant application, attach the selected request type, and submit it for review.
                        </div>
                        <div className="rounded-[20px] border border-[#efe4d8] bg-white px-5 py-4 text-sm leading-7 text-[#6b7280]">
                          Approved merchants can still open new expansion requests later without creating a second identity.
                        </div>
                      </div>
                    </div>

                    <form className="space-y-5 px-7 py-8" onSubmit={handleRequestSubmit}>
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1f2937]">Business name</label>
                          <Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Yummy Hospitality Pvt. Ltd." />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1f2937]">Contact name</label>
                          <Input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Ramon Tiwari" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1f2937]">Contact email</label>
                          <Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="owner@restaurant.com" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1f2937]">Contact phone</label>
                          <Input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+97798XXXXXXXX" />
                        </div>
                      </div>

                      {requestType === "create_external" ? (
                        <div className="grid gap-5 md:grid-cols-3">
                          <div className="space-y-2 md:col-span-3">
                            <label className="text-sm font-medium text-[#1f2937]">Restaurant name</label>
                            <Input value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} placeholder="Yummy Momo House" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">City</label>
                            <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Pokhara" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">Area</label>
                            <Input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Lakeside" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">Notes</label>
                            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything ops should know before launch" />
                          </div>
                        </div>
                      ) : null}

                      {requestType === "claim_existing" ? (
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">Restaurant to claim</label>
                            <select
                              value={selectedRestaurantId}
                              onChange={(event) => setSelectedRestaurantId(event.target.value)}
                              className="flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                            >
                              <option value="">Choose a restaurant</option>
                              {claimableRestaurants.map((restaurant) => (
                                <option key={restaurant.id} value={restaurant.id}>
                                  {restaurant.name} {restaurant.city ? `• ${restaurant.city}` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">Notes</label>
                            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Explain why this restaurant should be attached to your merchant account" />
                          </div>
                        </div>
                      ) : null}

                      {requestType === "pos_link" ? (
                        <div className="space-y-5">
                          <div className="grid gap-5 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-[#1f2937]">Restaurant in YummyDoors</label>
                              <select
                                value={selectedRestaurantId}
                                onChange={(event) => setSelectedRestaurantId(event.target.value)}
                                className="flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                              >
                                <option value="">Choose a restaurant</option>
                                {claimableRestaurants.map((restaurant) => (
                                  <option key={restaurant.id} value={restaurant.id}>
                                    {restaurant.name} {restaurant.city ? `• ${restaurant.city}` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-[#1f2937]">Matched POS identity</label>
                              <select
                                value={selectedPosRestaurantId}
                                onChange={(event) => setSelectedPosRestaurantId(event.target.value)}
                                className="flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                              >
                                <option value="">Choose a POS restaurant</option>
                                {posMatchedRestaurants.map((restaurant) => (
                                  <option key={restaurant.posRestaurantId} value={restaurant.posRestaurantId}>
                                    {restaurant.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">Notes</label>
                            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe the POS ownership or admin relationship to speed up review" />
                          </div>
                          {posMatchedRestaurants.length === 0 ? (
                            <div className="rounded-[18px] border border-[#ffe2cf] bg-[#fff7f1] px-4 py-4 text-sm leading-7 text-[#9a3412]">
                              No POS restaurant matches were found on this account yet. That usually means the
                              current user is not linked to a matching Yummy POS identity by email.
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between gap-4 pt-2">
                        <p className="text-sm text-[#6b7280]">
                          This will submit a {selectedRequestMeta.label.toLowerCase()} request to ops/admin.
                        </p>
                        <Button className="rounded-full px-6" disabled={submitting} type="submit">
                          {submitting ? "Submitting..." : "Submit request"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-[28px] border border-[#efe4d8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
                  <CardContent className="space-y-4 p-7">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Open review</p>
                    <h2 className="text-[28px] font-semibold tracking-tight text-[#1f2937]">
                      You already have an active merchant review running.
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-[#6b7280]">
                      We only allow one open merchant application at a time so the ops and ownership flow
                      stays clean. Once this one is approved or rejected, you can open the next restaurant
                      request from the same workspace.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
    </div>
  );
}
