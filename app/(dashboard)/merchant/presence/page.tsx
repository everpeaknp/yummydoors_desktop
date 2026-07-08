"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Mail, MapPin, Phone, Store } from "lucide-react";

import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MapPicker from "@/components/ui/map-picker";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";

type MerchantRestaurantCategory = {
  id: number;
  name: string;
  slug: string;
};

type MerchantRestaurantProfile = {
  id: number;
  name: string;
  slug: string;
  integration_mode: string;
  status: string;
  cover_image_url: string | null;
  logo_url: string | null;
  short_description: string | null;
  primary_cuisine_label: string | null;
  city: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  rating_average: number;
  review_count: number;
  supports_delivery: boolean;
  has_free_delivery: boolean;
  supports_pickup: boolean;
  supports_table_booking: boolean;
  offer_text: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  opening_time: string | null;
  closing_time: string | null;
  about_text: string | null;
  facilities_text: string | null;
  delivery_eta_min_minutes: number | null;
  delivery_eta_max_minutes: number | null;
  sort_rank: number;
  is_featured: boolean;
  categories: MerchantRestaurantCategory[];
};

type ProfileForm = {
  name: string;
  short_description: string;
  primary_cuisine_label: string;
  city: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  offer_text: string;
  contact_phone: string;
  contact_email: string;
  opening_time: string;
  closing_time: string;
  about_text: string;
  facilities_text: string;
  delivery_eta_min_minutes: string;
  delivery_eta_max_minutes: string;
  cover_image_url: string;
  logo_url: string;
  supports_delivery: boolean;
  has_free_delivery: boolean;
  supports_pickup: boolean;
  supports_table_booking: boolean;
};

const emptyForm: ProfileForm = {
  name: "",
  short_description: "",
  primary_cuisine_label: "",
  city: "",
  area: "",
  latitude: null,
  longitude: null,
  offer_text: "",
  contact_phone: "",
  contact_email: "",
  opening_time: "",
  closing_time: "",
  about_text: "",
  facilities_text: "",
  delivery_eta_min_minutes: "",
  delivery_eta_max_minutes: "",
  cover_image_url: "",
  logo_url: "",
  supports_delivery: true,
  has_free_delivery: false,
  supports_pickup: false,
  supports_table_booking: false,
};

function extractErrorMessage(payload: any) {
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }
  if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
    return payload.detail
      .map((item: { msg?: string }) => item?.msg)
      .filter(Boolean)
      .join(" ");
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return "Something went wrong.";
}

function toForm(profile: MerchantRestaurantProfile): ProfileForm {
  return {
    name: profile.name,
    short_description: profile.short_description ?? "",
    primary_cuisine_label: profile.primary_cuisine_label ?? "",
    city: profile.city ?? "",
    area: profile.area ?? "",
    latitude: profile.latitude,
    longitude: profile.longitude,
    offer_text: profile.offer_text ?? "",
    contact_phone: profile.contact_phone ?? "",
    contact_email: profile.contact_email ?? "",
    opening_time: profile.opening_time ?? "",
    closing_time: profile.closing_time ?? "",
    about_text: profile.about_text ?? "",
    facilities_text: profile.facilities_text ?? "",
    delivery_eta_min_minutes:
      profile.delivery_eta_min_minutes === null ? "" : String(profile.delivery_eta_min_minutes),
    delivery_eta_max_minutes:
      profile.delivery_eta_max_minutes === null ? "" : String(profile.delivery_eta_max_minutes),
    cover_image_url: profile.cover_image_url ?? "",
    logo_url: profile.logo_url ?? "",
    supports_delivery: profile.supports_delivery,
    has_free_delivery: profile.has_free_delivery,
    supports_pickup: profile.supports_pickup,
    supports_table_booking: profile.supports_table_booking,
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function MerchantPresencePage() {
  const { hydrated, accessToken, user } = useAuth();
  const restaurantId = user?.activeRestaurantId;

  const [profile, setProfile] = useState<MerchantRestaurantProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [resolvedLocationLabel, setResolvedLocationLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const facilitiesPreview = useMemo(
    () =>
      form.facilities_text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [form.facilities_text],
  );

  const loadProfile = useCallback(async () => {
    if (!restaurantId) {
      setProfile(null);
      setForm(emptyForm);
      setLoading(false);
      setHasDraft(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/merchant/restaurants/${restaurantId}/profile`, { auth: true });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload));
      }

      const nextProfile = payload?.data as MerchantRestaurantProfile;
      setProfile(nextProfile);
      
      let appliedForm = toForm(nextProfile);
      const draftRaw = localStorage.getItem(`merchant_profile_draft_${restaurantId}`);
      
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw) as ProfileForm;
          if (JSON.stringify(draft) !== JSON.stringify(appliedForm)) {
            appliedForm = draft;
            setHasDraft(true);
          } else {
            localStorage.removeItem(`merchant_profile_draft_${restaurantId}`);
          }
        } catch {
          localStorage.removeItem(`merchant_profile_draft_${restaurantId}`);
        }
      }

      setForm(appliedForm);
      setResolvedLocationLabel(
        [appliedForm.area, appliedForm.city].filter(Boolean).join(", ") || "No exact map label yet",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load restaurant profile.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!hydrated || !accessToken) {
      return;
    }
    void loadProfile();
  }, [accessToken, hydrated, loadProfile]);

  useEffect(() => {
    if (!profile || !restaurantId || form === emptyForm) return;
    
    // Use setTimeout to avoid blocking render while stringifying
    const timer = setTimeout(() => {
      const isDifferent = JSON.stringify(form) !== JSON.stringify(toForm(profile));
      if (isDifferent) {
        localStorage.setItem(`merchant_profile_draft_${restaurantId}`, JSON.stringify(form));
        setHasDraft(true);
      } else {
        localStorage.removeItem(`merchant_profile_draft_${restaurantId}`);
        setHasDraft(false);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [form, profile, restaurantId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restaurantId) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(`/merchant/restaurants/${restaurantId}/profile`, {
        method: "PUT",
        auth: true,
        body: JSON.stringify({
          name: form.name.trim(),
          short_description: form.short_description.trim() || null,
          primary_cuisine_label: form.primary_cuisine_label.trim() || null,
          city: form.city.trim() || null,
          area: form.area.trim() || null,
          latitude: form.latitude,
          longitude: form.longitude,
          offer_text: form.offer_text.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          contact_email: form.contact_email.trim() || null,
          opening_time: form.opening_time || null,
          closing_time: form.closing_time || null,
          about_text: form.about_text.trim() || null,
          facilities_text: form.facilities_text.trim() || null,
          delivery_eta_min_minutes: parseOptionalNumber(form.delivery_eta_min_minutes),
          delivery_eta_max_minutes: parseOptionalNumber(form.delivery_eta_max_minutes),
          cover_image_url: form.cover_image_url.trim() || null,
          logo_url: form.logo_url.trim() || null,
          supports_delivery: form.supports_delivery,
          has_free_delivery: form.has_free_delivery,
          supports_pickup: form.supports_pickup,
          supports_table_booking: form.supports_table_booking,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload));
      }

      const nextProfile = payload?.data as MerchantRestaurantProfile;
      setProfile(nextProfile);
      setForm(toForm(nextProfile));
      setSuccess("Restaurant profile updated.");
      localStorage.removeItem(`merchant_profile_draft_${restaurantId}`);
      setHasDraft(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update restaurant profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Preparing merchant surface...</div>;
  }

  if (!accessToken) {
    return (
      <MerchantDashboardLayout>
        <div className="mx-auto max-w-4xl px-6 py-16 lg:px-10">
          <Card className="border-[#e9ecef] shadow-sm">
            <CardContent className="space-y-4">
              <p className="text-[14px] text-[#495057]">Sign in first to edit your merchant restaurant profile.</p>
              <div className="flex gap-3 mt-4">
                <Link href="/login" className="rounded bg-[#e53e4f] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#d63a4a]">
                  Sign in
                </Link>
                <Link href="/merchant" className="rounded bg-[#e9ecef] px-4 py-2 text-[14px] font-semibold text-[#495057] hover:bg-[#dee2e6]">
                  Back to merchant
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </MerchantDashboardLayout>
    );
  }

  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
        <span className="text-[#e53e4f]">Management</span>
        <span className="mx-2">/</span>
        <span>Restaurant presence</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-[16px] font-semibold text-[#495057]">
            Restaurant details and operating profile
          </h2>
          <p className="mt-1 max-w-3xl text-[14px] text-[#868e96]">
            This is where merchants should manage the live public identity of a restaurant:
            location, hours, contact details, delivery flags, and customer-facing copy.
          </p>
        </div>
      </div>

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

        {!restaurantId ? (
          <Card className="border-[#efe4d8]">
            <CardContent className="space-y-4">
              <p className="text-sm text-[#6b7280]">
                Select an active merchant restaurant first. Once a restaurant is approved and active in your merchant workspace,
                this page will let you edit its public details.
              </p>
            </CardContent>
          </Card>
        ) : loading ? (
          <Card className="border-[#efe4d8]">
            <CardContent className="text-sm text-[#6b7280]">Loading restaurant presence...</CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <Card className="border-[#efe4d8]">
                <CardContent className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4ec]">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-[#1f2937]">
                        {profile?.name ?? "Restaurant"}
                      </h2>
                      <p className="mt-1 text-sm text-[#6b7280]">
                        Update what customers and operators should see live.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-[#1f2937]">Restaurant name</span>
                      <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Primary cuisine</span>
                      <Input value={form.primary_cuisine_label} onChange={(event) => setForm((current) => ({ ...current, primary_cuisine_label: event.target.value }))} />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-[#1f2937]">Short description</span>
                      <Input value={form.short_description} onChange={(event) => setForm((current) => ({ ...current, short_description: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">City</span>
                      <Input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Area</span>
                      <Input value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Cover image URL</span>
                      <Input value={form.cover_image_url} onChange={(event) => setForm((current) => ({ ...current, cover_image_url: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Logo image URL</span>
                      <Input value={form.logo_url} onChange={(event) => setForm((current) => ({ ...current, logo_url: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Offer text</span>
                      <Input value={form.offer_text} onChange={(event) => setForm((current) => ({ ...current, offer_text: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Contact phone</span>
                      <Input value={form.contact_phone} onChange={(event) => setForm((current) => ({ ...current, contact_phone: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Contact email</span>
                      <Input type="email" value={form.contact_email} onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Opening time</span>
                      <Input type="time" value={form.opening_time} onChange={(event) => setForm((current) => ({ ...current, opening_time: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Closing time</span>
                      <Input type="time" value={form.closing_time} onChange={(event) => setForm((current) => ({ ...current, closing_time: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Delivery ETA min</span>
                      <Input type="number" value={form.delivery_eta_min_minutes} onChange={(event) => setForm((current) => ({ ...current, delivery_eta_min_minutes: event.target.value }))} />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#1f2937]">Delivery ETA max</span>
                      <Input type="number" value={form.delivery_eta_max_minutes} onChange={(event) => setForm((current) => ({ ...current, delivery_eta_max_minutes: event.target.value }))} />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-[#1f2937]">About</span>
                      <textarea
                        rows={5}
                        value={form.about_text}
                        onChange={(event) => setForm((current) => ({ ...current, about_text: event.target.value }))}
                        className="w-full rounded-xl border border-[#efe4d8] px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-[#1f2937]">Facilities</span>
                      <textarea
                        rows={4}
                        value={form.facilities_text}
                        onChange={(event) => setForm((current) => ({ ...current, facilities_text: event.target.value }))}
                        placeholder="WiFi, Family seating, Parking, Live music"
                        className="w-full rounded-xl border border-[#efe4d8] px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#efe4d8]">
                <CardContent className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#1f2937]">Service modes</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ["supports_delivery", "Delivery"],
                      ["has_free_delivery", "Free delivery"],
                      ["supports_pickup", "Pickup"],
                      ["supports_table_booking", "Table booking"],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-3 rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4 text-sm text-[#1f2937]"
                      >
                        <input
                          type="checkbox"
                          checked={form[key as keyof Pick<ProfileForm, "supports_delivery" | "has_free_delivery" | "supports_pickup" | "supports_table_booking">]}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              [key]: event.target.checked,
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-[#efe4d8]">
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <h2 className="text-xl font-semibold text-[#1f2937]">Restaurant location</h2>
                      <p className="text-sm text-[#6b7280]">Drag the pin or search the map to set the live operating point.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Resolved location</p>
                    <p className="mt-2 text-sm text-[#1f2937]">{resolvedLocationLabel || "No exact address label yet"}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-[#efe4d8] bg-white px-3 py-3 text-sm text-[#6b7280]">
                        Latitude: {form.latitude?.toFixed(6) ?? "Not set"}
                      </div>
                      <div className="rounded-xl border border-[#efe4d8] bg-white px-3 py-3 text-sm text-[#6b7280]">
                        Longitude: {form.longitude?.toFixed(6) ?? "Not set"}
                      </div>
                    </div>
                  </div>

                  <MapPicker
                    latitude={form.latitude}
                    longitude={form.longitude}
                    showSearch
                    heightClassName="h-[420px]"
                    onChange={(lat, lng) =>
                      setForm((current) => ({
                        ...current,
                        latitude: lat,
                        longitude: lng,
                      }))
                    }
                    onResolvedAddress={(label, city, area) => {
                      setResolvedLocationLabel(label);
                      if (city || area) {
                        setForm((current) => ({
                          ...current,
                          ...(city && { city }),
                          ...(area && { area }),
                        }));
                      }
                    }}
                  />
                </CardContent>
              </Card>

              <Card className="border-[#efe4d8]">
                <CardContent className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#1f2937]">Live summary</h2>
                  <div className="space-y-3 text-sm text-[#6b7280]">
                    <div className="flex items-center gap-3">
                      <Clock3 className="h-4 w-4 text-primary" />
                      <span>
                        {form.opening_time || "--:--"} to {form.closing_time || "--:--"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-primary" />
                      <span>{form.contact_phone || "Phone not listed"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-primary" />
                      <span>{form.contact_email || "Email not listed"}</span>
                    </div>
                  </div>

                  {profile?.categories?.length ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-[#1f2937]">Linked categories</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.categories.map((category) => (
                          <span
                            key={category.id}
                            className="rounded-full border border-[#efe4d8] bg-[#fffaf4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary"
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {facilitiesPreview.length ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-[#1f2937]">Facilities preview</p>
                      <div className="flex flex-wrap gap-2">
                        {facilitiesPreview.map((facility) => (
                          <span
                            key={facility}
                            className="rounded-full border border-[#efe4d8] bg-white px-3 py-1 text-xs text-[#6b7280]"
                          >
                            {facility}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save details"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={() => {
                        if (profile) {
                          setForm(toForm(profile));
                          localStorage.removeItem(`merchant_profile_draft_${restaurantId}`);
                          setHasDraft(false);
                        }
                      }}
                    >
                      Reset form
                    </Button>
                    {hasDraft && (
                      <span className="text-sm font-medium text-amber-600">
                        You have unsaved changes
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </form>
        )}
    </MerchantDashboardLayout>
  );
}
