"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { apiFetch } from "@/lib/http";
import { FALLBACK_RESTAURANT_COVER, isUsableImageUrl } from "@/lib/restaurant-media";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

type CategorySummary = {
  id: number;
  slug: string;
  name: string;
};

type PublicRestaurant = {
  id: number;
  slug: string;
  name: string;
  cover_image_url: string | null;
  logo_url: string | null;
  primary_cuisine_label: string | null;
  city: string | null;
  rating_average: number;
  review_count: number;
  has_free_delivery: boolean;
  is_featured: boolean;
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
  offer_text: string | null;
  delivery_eta_min_minutes: number | null;
  delivery_eta_max_minutes: number | null;
  sort_rank: number;
  is_featured: boolean;
  categories: CategorySummary[];
};

type MerchantProfileForm = {
  name: string;
  slug: string;
  short_description: string;
  primary_cuisine_label: string;
  city: string;
  area: string;
  cover_image_url: string;
  logo_url: string;
  offer_text: string;
  supports_delivery: boolean;
  has_free_delivery: boolean;
  delivery_eta_min_minutes: string;
  delivery_eta_max_minutes: string;
};

function extractErrorMessage(payload: any) {
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return "Something went wrong.";
}

function buildFormState(profile: MerchantRestaurantProfile): MerchantProfileForm {
  return {
    name: profile.name,
    slug: profile.slug,
    short_description: profile.short_description ?? "",
    primary_cuisine_label: profile.primary_cuisine_label ?? "",
    city: profile.city ?? "",
    area: profile.area ?? "",
    cover_image_url: profile.cover_image_url ?? "",
    logo_url: profile.logo_url ?? "",
    offer_text: profile.offer_text ?? "",
    supports_delivery: profile.supports_delivery,
    has_free_delivery: profile.has_free_delivery,
    delivery_eta_min_minutes: profile.delivery_eta_min_minutes?.toString() ?? "",
    delivery_eta_max_minutes: profile.delivery_eta_max_minutes?.toString() ?? "",
  };
}

export default function RestaurantsPage() {
  const { hydrated, accessToken, user } = useAuth();
  const [restaurants, setRestaurants] = useState<PublicRestaurant[]>([]);
  const [merchantProfile, setMerchantProfile] = useState<MerchantRestaurantProfile | null>(null);
  const [form, setForm] = useState<MerchantProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const merchantMode = useMemo(
    () =>
      hydrated &&
      Boolean(accessToken) &&
      user?.activeWorkspace?.workspaceType === "merchant" &&
      Boolean(user?.activeRestaurantId),
    [accessToken, hydrated, user?.activeRestaurantId, user?.activeWorkspace?.workspaceType],
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (merchantMode && user?.activeRestaurantId) {
          const response = await apiFetch(`/merchant/restaurants/${user.activeRestaurantId}/profile`, {
            auth: true,
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(extractErrorMessage(payload));
          }
          if (!cancelled) {
            setMerchantProfile(payload.data);
            setForm(buildFormState(payload.data));
          }
          return;
        }

        const response = await apiFetch("/restaurants");
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(extractErrorMessage(payload));
        }
        if (!cancelled) {
          setRestaurants(payload?.data?.items ?? []);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load restaurant data.");
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
  }, [hydrated, merchantMode, user?.activeRestaurantId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!merchantProfile || !form) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(`/merchant/restaurants/${merchantProfile.id}/profile`, {
        method: "PUT",
        auth: true,
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          short_description: form.short_description.trim() || null,
          primary_cuisine_label: form.primary_cuisine_label.trim() || null,
          city: form.city.trim() || null,
          area: form.area.trim() || null,
          cover_image_url: form.cover_image_url.trim() || null,
          logo_url: form.logo_url.trim() || null,
          offer_text: form.offer_text.trim() || null,
          supports_delivery: form.supports_delivery,
          has_free_delivery: form.has_free_delivery,
          delivery_eta_min_minutes: form.delivery_eta_min_minutes
            ? Number(form.delivery_eta_min_minutes)
            : null,
          delivery_eta_max_minutes: form.delivery_eta_max_minutes
            ? Number(form.delivery_eta_max_minutes)
            : null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload));
      }
      setMerchantProfile(payload.data);
      setForm(buildFormState(payload.data));
      setSuccess("Restaurant profile updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update restaurant profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />
      <main className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
        {merchantMode ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Restaurant Presence</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Control how your restaurant appears to customers without leaving the shared YummyDoors app.
              </p>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading restaurant profile...</div>
            ) : error ? (
              <div className="rounded-2xl border border-[#ffd8cc] bg-[#fff4ef] px-5 py-4 text-sm text-[#9a3412]">
                {error}
              </div>
            ) : merchantProfile && form ? (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <Card className="overflow-hidden border-[#efe4d8]">
                  <div
                    className="h-56 w-full bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${
                        isUsableImageUrl(merchantProfile.cover_image_url)
                          ? merchantProfile.cover_image_url
                          : FALLBACK_RESTAURANT_COVER
                      })`,
                    }}
                  />
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-4">
                      {isUsableImageUrl(merchantProfile.logo_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={merchantProfile.logo_url as string}
                          alt={merchantProfile.name}
                          className="h-14 w-14 rounded-2xl border border-[#efe4d8] object-cover"
                        />
                      ) : null}
                      <div>
                        <h3 className="text-xl font-semibold text-[#1f2937]">{merchantProfile.name}</h3>
                        <p className="text-sm text-[#6b7280]">
                          {merchantProfile.primary_cuisine_label || "Cuisine not set"}
                          {merchantProfile.city ? ` • ${merchantProfile.city}` : ""}
                          {merchantProfile.area ? `, ${merchantProfile.area}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">Status</p>
                        <p className="mt-2 text-sm font-medium text-[#1f2937]">{merchantProfile.status}</p>
                      </div>
                      <div className="rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">Integration</p>
                        <p className="mt-2 text-sm font-medium text-[#1f2937]">{merchantProfile.integration_mode}</p>
                      </div>
                      <div className="rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">Offer</p>
                        <p className="mt-2 text-sm font-medium text-[#1f2937]">
                          {merchantProfile.offer_text || "No current offer"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">Categories</p>
                        <p className="mt-2 text-sm font-medium text-[#1f2937]">
                          {merchantProfile.categories.length}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">Linked categories</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {merchantProfile.categories.length > 0 ? (
                          merchantProfile.categories.map((category) => (
                            <span
                              key={category.id}
                              className="rounded-full border border-[#efe4d8] bg-white px-3 py-1 text-xs font-semibold text-[#6b7280]"
                            >
                              {category.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-[#6b7280]">No categories linked yet.</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#efe4d8]">
                  <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-semibold text-[#1f2937]">Edit live profile</h3>
                          <p className="mt-1 text-sm text-[#6b7280]">
                            These fields shape how your restaurant appears across discovery surfaces.
                          </p>
                        </div>
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save changes"}
                        </button>
                      </div>

                      {success ? (
                        <div className="rounded-2xl border border-[#d4f3db] bg-[#f3fff6] px-5 py-4 text-sm text-[#166534]">
                          {success}
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-[#1f2937]">Restaurant name</span>
                          <input
                            value={form.name}
                            onChange={(event) => setForm({ ...form, name: event.target.value })}
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                            required
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-[#1f2937]">Slug</span>
                          <input
                            value={form.slug}
                            onChange={(event) => setForm({ ...form, slug: event.target.value })}
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                            required
                          />
                        </label>
                        <label className="space-y-1.5 md:col-span-2">
                          <span className="text-sm font-medium text-[#1f2937]">Short description</span>
                          <textarea
                            rows={4}
                            value={form.short_description}
                            onChange={(event) => setForm({ ...form, short_description: event.target.value })}
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-[#1f2937]">Cuisine</span>
                          <input
                            value={form.primary_cuisine_label}
                            onChange={(event) =>
                              setForm({ ...form, primary_cuisine_label: event.target.value })
                            }
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-[#1f2937]">Offer text</span>
                          <input
                            value={form.offer_text}
                            onChange={(event) => setForm({ ...form, offer_text: event.target.value })}
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-[#1f2937]">City</span>
                          <input
                            value={form.city}
                            onChange={(event) => setForm({ ...form, city: event.target.value })}
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-[#1f2937]">Area</span>
                          <input
                            value={form.area}
                            onChange={(event) => setForm({ ...form, area: event.target.value })}
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-[#1f2937]">Cover image URL</span>
                          <input
                            value={form.cover_image_url}
                            onChange={(event) => setForm({ ...form, cover_image_url: event.target.value })}
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-[#1f2937]">Logo URL</span>
                          <input
                            value={form.logo_url}
                            onChange={(event) => setForm({ ...form, logo_url: event.target.value })}
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-[#1f2937]">ETA min</span>
                          <input
                            type="number"
                            value={form.delivery_eta_min_minutes}
                            onChange={(event) =>
                              setForm({ ...form, delivery_eta_min_minutes: event.target.value })
                            }
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-[#1f2937]">ETA max</span>
                          <input
                            type="number"
                            value={form.delivery_eta_max_minutes}
                            onChange={(event) =>
                              setForm({ ...form, delivery_eta_max_minutes: event.target.value })
                            }
                            className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex items-center gap-3 rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4 text-sm text-[#1f2937]">
                          <input
                            type="checkbox"
                            checked={form.supports_delivery}
                            onChange={(event) =>
                              setForm({ ...form, supports_delivery: event.target.checked })
                            }
                          />
                          Supports delivery
                        </label>
                        <label className="flex items-center gap-3 rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4 text-sm text-[#1f2937]">
                          <input
                            type="checkbox"
                            checked={form.has_free_delivery}
                            onChange={(event) =>
                              setForm({ ...form, has_free_delivery: event.target.checked })
                            }
                          />
                          Free delivery
                        </label>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Restaurants</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse restaurants available to the current customer feed.
              </p>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading restaurants...</div>
            ) : error ? (
              <div className="rounded-2xl border border-[#ffd8cc] bg-[#fff4ef] px-5 py-4 text-sm text-[#9a3412]">
                {error}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {restaurants.map((restaurant) => {
                  const coverUrl = isUsableImageUrl(restaurant.cover_image_url)
                    ? restaurant.cover_image_url
                    : FALLBACK_RESTAURANT_COVER;
                  const logoUrl = isUsableImageUrl(restaurant.logo_url) ? restaurant.logo_url : null;

                  return (
                    <Link key={restaurant.slug} href={`/restaurants/${restaurant.slug}`} className="block">
                      <Card className="overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl">
                        <div
                          className="h-32 w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${coverUrl})` }}
                        />
                        <CardContent className="p-5">
                          <div className="flex items-center gap-4">
                            {logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={logoUrl}
                                alt={restaurant.name}
                                className="h-12 w-12 rounded-full border shadow-sm"
                              />
                            ) : null}
                            <div>
                              <h3 className="font-semibold text-lg">{restaurant.name}</h3>
                              <p className="text-xs text-muted-foreground">
                                {restaurant.primary_cuisine_label} • {restaurant.city}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                              ★ {restaurant.rating_average} ({restaurant.review_count})
                            </span>
                            {restaurant.has_free_delivery ? (
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                                Free Delivery
                              </span>
                            ) : null}
                            {restaurant.is_featured ? (
                              <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                                Featured
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-5 text-sm font-medium text-primary">Open restaurant</div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
                {restaurants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No restaurants found.</p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
