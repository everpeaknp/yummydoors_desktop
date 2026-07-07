"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Flame,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Truck,
  UtensilsCrossed,
} from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { AddToCartButton } from "@/components/customer/add-to-cart-button";
import { FavoriteToggleButton } from "@/components/customer/favorite-toggle-button";
import { ReviewEditor, type ReviewPayload } from "@/components/customer/review-editor";
import { apiFetch } from "@/lib/http";
import { extractApiErrorMessage, readJsonSafely, unwrapApiData } from "@/lib/api-utils";
import {
  FALLBACK_MENU_ITEM_IMAGE,
  FALLBACK_RESTAURANT_COVER,
  isUsableImageUrl,
} from "@/lib/restaurant-media";
import { CustomerBookingPanel } from "@/components/reservations/customer-booking-panel";
import { Card, CardContent } from "@/components/ui/card";

type CategorySummary = {
  id: number;
  slug: string;
  name: string;
};

type RestaurantCardSummary = {
  id: number;
  slug: string;
  name: string;
  cover_image_url: string | null;
  logo_url: string | null;
  short_description: string | null;
  primary_cuisine_label: string | null;
  city: string | null;
  area: string | null;
  rating_average: number;
  review_count: number;
  supports_delivery: boolean;
  has_free_delivery: boolean;
  supports_pickup: boolean;
  supports_table_booking: boolean;
  offer_text: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  delivery_eta_min_minutes: number | null;
  delivery_eta_max_minutes: number | null;
  opening_time: string | null;
  closing_time: string | null;
  is_open_now: boolean | null;
  distance_km: number | null;
  is_featured: boolean;
  is_favorited: boolean;
  categories: CategorySummary[];
};

type MenuItemSummary = {
  id: number;
  restaurant_id: number;
  category_id: number | null;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  currency_code: string;
  is_available: boolean;
  food_type: string | null;
  is_spicy: boolean;
  is_featured: boolean;
  is_popular: boolean;
  popularity_score: number;
  rating_average: number;
  rating_count: number;
  is_favorited: boolean;
};

type RestaurantMenuSection = {
  category_id: number | null;
  category_slug: string | null;
  category_name: string;
  items: MenuItemSummary[];
};

type RestaurantDetail = {
  restaurant: RestaurantCardSummary;
  menu_sections: RestaurantMenuSection[];
  featured_items: MenuItemSummary[];
  popular_items: MenuItemSummary[];
  related_restaurants: RestaurantCardSummary[];
  about_text: string | null;
  facilities: string[];
  reviews_summary: {
    average_rating: number;
    total_reviews: number;
    highlights: string[];
  } | null;
  reviews: Array<{
    id: number;
    user_id: number | null;
    author_name: string;
    rating: number;
    comment: string | null;
    source: string;
    created_at: string;
    is_mine: boolean;
    can_edit: boolean;
  }>;
  viewer_review: ReviewPayload | null;
  review_eligibility: {
    can_create_review: boolean;
    requires_delivered_order: boolean;
    existing_review_id: number | null;
    reason: string | null;
  } | null;
};

const LOCATION_STORAGE_KEY = "yummydoors.selectedLocation";

function formatPrice(item: MenuItemSummary) {
  return `${item.currency_code} ${item.price}`;
}

function formatEta(restaurant: RestaurantCardSummary) {
  const min = restaurant.delivery_eta_min_minutes;
  const max = restaurant.delivery_eta_max_minutes;
  if (min && max) return `${min}-${max} min`;
  if (min) return `${min} min`;
  if (max) return `${max} min`;
  return "ETA unavailable";
}

function formatLocation(restaurant: RestaurantCardSummary) {
  return [restaurant.area, restaurant.city].filter(Boolean).join(", ") || "Location not set";
}

function collectGalleryImages(detail: RestaurantDetail) {
  const images = [
    detail.restaurant.cover_image_url,
    detail.restaurant.logo_url,
    ...detail.featured_items.map((item) => item.image_url),
    ...detail.popular_items.map((item) => item.image_url),
    ...detail.menu_sections.flatMap((section) => section.items.map((item) => item.image_url)),
  ].filter((value): value is string => Boolean(value && isUsableImageUrl(value)));

  return Array.from(new Set(images)).slice(0, 5);
}

export default function RestaurantDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { coords?: { lat?: number; lng?: number } };
      if (
        parsed?.coords &&
        Number.isFinite(parsed.coords.lat) &&
        Number.isFinite(parsed.coords.lng)
      ) {
        setSelectedCoords({
          lat: Number(parsed.coords.lat),
          lng: Number(parsed.coords.lng),
        });
      }
    } catch {
      window.localStorage.removeItem(LOCATION_STORAGE_KEY);
    }
  }, []);

  const loadRestaurant = useCallback(async (signal?: AbortSignal) => {
    if (!slug) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (selectedCoords) {
        query.set("latitude", String(selectedCoords.lat));
        query.set("longitude", String(selectedCoords.lng));
      }
      const response = await apiFetch(
        `/restaurants/${slug}${query.size ? `?${query.toString()}` : ""}`,
        { signal },
      );
      const payload = await readJsonSafely<RestaurantDetail | { data: RestaurantDetail }>(response);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload, "Failed to load restaurant."));
      }

      const data = unwrapApiData<RestaurantDetail>(payload);
      if (data) {
        setDetail(data);
      }
    } catch (caught) {
      if (signal?.aborted) {
        return;
      }
      setError(caught instanceof Error ? caught.message : "Failed to load restaurant.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [selectedCoords, slug]);

  useEffect(() => {
    if (!slug) return;

    const controller = new AbortController();
    void loadRestaurant(controller.signal);
    return () => controller.abort();
  }, [loadRestaurant, slug]);

  const restaurant = detail?.restaurant ?? null;
  const coverUrl =
    restaurant && isUsableImageUrl(restaurant.cover_image_url)
      ? restaurant.cover_image_url
      : FALLBACK_RESTAURANT_COVER;
  const logoUrl =
    restaurant && isUsableImageUrl(restaurant.logo_url) ? restaurant.logo_url : null;
  const galleryImages = detail ? collectGalleryImages(detail) : [];
  const heroCategories = restaurant?.categories.length ? restaurant.categories : [];
  const aboutPoints = [
    restaurant?.primary_cuisine_label ? `${restaurant.primary_cuisine_label} kitchen` : null,
    restaurant?.supports_delivery ? `Delivery available in ${formatLocation(restaurant)}` : null,
    restaurant?.offer_text ? restaurant.offer_text : null,
    restaurant?.has_free_delivery ? "Free delivery on selected orders" : null,
  ].filter(Boolean) as string[];

  const handleRestaurantFavoriteChange = (next: boolean) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            restaurant: { ...current.restaurant, is_favorited: next },
            related_restaurants: current.related_restaurants.map((restaurantItem) =>
              restaurantItem.id === current.restaurant.id
                ? { ...restaurantItem, is_favorited: next }
                : restaurantItem,
            ),
          }
        : current,
    );
  };

  const handleMenuItemFavoriteChange = (menuItemId: number, next: boolean) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            featured_items: current.featured_items.map((item) =>
              item.id === menuItemId ? { ...item, is_favorited: next } : item,
            ),
            popular_items: current.popular_items.map((item) =>
              item.id === menuItemId ? { ...item, is_favorited: next } : item,
            ),
            menu_sections: current.menu_sections.map((section) => ({
              ...section,
              items: section.items.map((item) =>
                item.id === menuItemId ? { ...item, is_favorited: next } : item,
              ),
            })),
          }
        : current,
    );
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />

      {loading ? (
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-6 lg:px-10">
          <div className="text-sm text-muted-foreground">Loading restaurant...</div>
        </div>
      ) : error ? (
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-6 lg:px-10">
          <div className="rounded-3xl border border-[#ffd8cc] bg-[#fff4ef] px-6 py-5 text-sm text-[#9a3412]">
            {error}
          </div>
        </div>
      ) : detail && restaurant ? (
        <>
          <section className="relative isolate overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${coverUrl})` }}
            />
            <div className="absolute inset-0 bg-[#08101dd9]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,105,41,0.38),transparent_32%)]" />

            <div className="relative mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">
              <Link
                href="/restaurants"
                className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-white/80 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to restaurants
              </Link>

              <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr]">
                <div className="max-w-3xl">
                  <div className="mb-5 flex flex-wrap items-center gap-3">
                    {heroCategories.map((category) => (
                      <span
                        key={category.id}
                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/85"
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>

                  <div className="mb-6 flex items-center gap-4">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt={restaurant.name}
                        className="h-16 w-16 rounded-2xl border border-white/20 bg-white/90 object-cover shadow-lg"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white">
                        <Store className="h-7 w-7" />
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffb085]">
                        Restaurant
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                          {restaurant.name}
                        </h1>
                        <FavoriteToggleButton
                          entityType="restaurant"
                          entityId={restaurant.id}
                          active={restaurant.is_favorited}
                          onChange={handleRestaurantFavoriteChange}
                          className="h-11 rounded-full border-white/20 bg-white/12 px-4 text-white hover:bg-white/18"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="max-w-2xl text-base leading-8 text-white/78 md:text-lg">
                    {restaurant.short_description ??
                      `${restaurant.name} is now live on YummyDoors with menu sections, featured dishes, and nearby recommendations ready for browsing.`}
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#111827]">
                      <Star className="h-4 w-4 fill-[#ffb648] text-[#ffb648]" />
                      {restaurant.rating_average.toFixed(1)} ({restaurant.review_count})
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                      <Clock3 className="h-4 w-4" />
                      {formatEta(restaurant)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                      <MapPin className="h-4 w-4" />
                      {formatLocation(restaurant)}
                    </span>
                    {restaurant.supports_delivery ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                        <Truck className="h-4 w-4" />
                        Delivery enabled
                      </span>
                    ) : null}
                    {restaurant.supports_table_booking ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                        <BadgeCheck className="h-4 w-4" />
                        Table booking
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <a
                      href="#menu"
                      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-white/90"
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                      Browse menu
                    </a>
                    <a
                      href="/cart"
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Open cart
                    </a>
                    <a
                      href="#about"
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                      <BadgeCheck className="h-4 w-4" />
                      About restaurant
                    </a>
                    <a
                      href="#reviews"
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                      <MessageSquareText className="h-4 w-4" />
                      Reviews
                    </a>
                  </div>
                </div>

                <Card className="border-white/12 bg-white/95 shadow-[0_30px_100px_rgba(3,7,18,0.24)]">
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        At a glance
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">
                        Everything a customer needs before ordering
                      </h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Status
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {restaurant.is_open_now === null
                            ? "Hours not set"
                            : restaurant.is_open_now
                              ? "Open now"
                              : "Closed now"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Hours
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {restaurant.opening_time && restaurant.closing_time
                            ? `${restaurant.opening_time} - ${restaurant.closing_time}`
                            : "Not set"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Distance
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {restaurant.distance_km !== null
                            ? `${restaurant.distance_km.toFixed(1)} km away`
                            : "Select a location to measure"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <main className="mx-auto max-w-7xl space-y-8 px-6 py-10 lg:px-10">
            <div className="flex flex-wrap gap-3">
              {["menu", "about", "gallery", "reviews"].map((section) => (
                <a
                  key={section}
                  href={`#${section}`}
                  className="rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                >
                  {section}
                </a>
              ))}
            </div>

            <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-8">
                <Card>
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Recommended
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">
                        Good first picks from this restaurant
                      </h2>
                    </div>
                    {detail.featured_items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Featured dishes will appear here once this restaurant highlights them.
                      </p>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {detail.featured_items.map((item) => {
                          const itemImage = isUsableImageUrl(item.image_url)
                            ? item.image_url
                            : FALLBACK_MENU_ITEM_IMAGE;

                          return (
                            <div
                              key={item.id}
                              className="overflow-hidden rounded-2xl border border-border bg-[#fcfcfd]"
                            >
                              <div
                                className="h-40 w-full bg-cover bg-center"
                                style={{ backgroundImage: `url(${itemImage})` }}
                              />
                              <div className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                      {item.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {item.description ?? "Freshly prepared and ready to order."}
                                    </p>
                                  </div>
                                  {item.is_popular ? (
                                    <span className="rounded-full bg-[#eefbf2] px-2.5 py-1 text-[11px] font-semibold text-[#17803d]">
                                      Popular
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <p className="text-sm font-semibold text-foreground">{formatPrice(item)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.rating_count > 0
                                      ? `${item.rating_average.toFixed(1)} from ${item.rating_count} reviews`
                                      : "New on the menu"}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <FavoriteToggleButton
                                    entityType="menu-item"
                                    entityId={item.id}
                                    active={item.is_favorited}
                                    onChange={(next) => handleMenuItemFavoriteChange(item.id, next)}
                                    className="h-10 rounded-full px-3"
                                  />
                                  <AddToCartButton restaurantId={restaurant.id} menuItemId={item.id} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card id="menu">
                  <CardContent className="space-y-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Menu
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">
                        Explore dishes by section
                      </h2>
                    </div>

                    {detail.menu_sections.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No menu sections are available for this restaurant yet.
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {detail.menu_sections.map((section) => (
                          <div key={`${section.category_slug ?? "misc"}-${section.category_id ?? "none"}`}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <h3 className="text-lg font-semibold text-foreground">
                                  {section.category_name}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {section.items.length} item{section.items.length === 1 ? "" : "s"}
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-4">
                              {section.items.map((item) => {
                                const itemImage = isUsableImageUrl(item.image_url)
                                  ? item.image_url
                                  : FALLBACK_MENU_ITEM_IMAGE;

                                return (
                                  <div
                                    key={item.id}
                                    className="grid gap-4 rounded-2xl border border-border bg-[#fcfcfd] p-4 md:grid-cols-[120px_1fr]"
                                  >
                                    <div
                                      className="h-28 rounded-2xl bg-cover bg-center"
                                      style={{ backgroundImage: `url(${itemImage})` }}
                                    />
                                    <div className="flex flex-col justify-between gap-4">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <h4 className="text-base font-semibold text-foreground">{item.name}</h4>
                                          {item.is_spicy ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1eb] px-2.5 py-1 text-[11px] font-semibold text-primary">
                                              <Flame className="h-3.5 w-3.5" />
                                              Spicy
                                            </span>
                                          ) : null}
                                          {item.is_popular ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-[#eefbf2] px-2.5 py-1 text-[11px] font-semibold text-[#17803d]">
                                              <Sparkles className="h-3.5 w-3.5" />
                                              Popular
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="mt-2 text-sm leading-7 text-muted-foreground">
                                          {item.description ?? "No description available yet."}
                                        </p>
                                      </div>

                                      <div className="flex items-center justify-between gap-4">
                                        <div>
                                          <p className="text-sm font-semibold text-foreground">
                                            {formatPrice(item)}
                                          </p>
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {item.rating_count > 0
                                              ? `${item.rating_average.toFixed(1)} rating from ${item.rating_count} reviews`
                                              : "Fresh item with no reviews yet"}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                            {item.food_type ?? "standard"}
                                          </span>
                                          <FavoriteToggleButton
                                            entityType="menu-item"
                                            entityId={item.id}
                                            active={item.is_favorited}
                                            onChange={(next) => handleMenuItemFavoriteChange(item.id, next)}
                                            compact
                                            className="h-10 rounded-full px-3"
                                          />
                                          <AddToCartButton
                                            restaurantId={restaurant.id}
                                            menuItemId={item.id}
                                            className="h-10 rounded-full px-4"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <CustomerBookingPanel
                  restaurantSlug={restaurant.slug}
                  restaurantName={restaurant.name}
                  supportsTableBooking={restaurant.supports_table_booking}
                />

                <Card id="about">
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        About restaurant
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">
                        Delivery, cuisine, and local context
                      </h2>
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground">
                      {detail.about_text ??
                        restaurant.short_description ??
                        `${restaurant.name} serves ${restaurant.primary_cuisine_label ?? "fresh food"} around ${formatLocation(restaurant)} with a simple delivery-first experience.`}
                    </p>
                    <div className="grid gap-3">
                      {aboutPoints.length > 0 ? (
                        aboutPoints.map((point) => (
                          <div
                            key={point}
                            className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4 text-sm text-foreground"
                          >
                            {point}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4 text-sm text-muted-foreground">
                          More restaurant details will show here as merchant setup expands.
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Service modes
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {restaurant.supports_delivery ? (
                            <span className="rounded-full bg-[#fff4ec] px-3 py-1 text-xs font-semibold text-primary">
                              Delivery
                            </span>
                          ) : null}
                          {restaurant.supports_pickup ? (
                            <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-semibold text-[#2563eb]">
                              Pickup
                            </span>
                          ) : null}
                          {restaurant.supports_table_booking ? (
                            <span className="rounded-full bg-[#eefbf2] px-3 py-1 text-xs font-semibold text-[#15803d]">
                              Table booking
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Contact
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-foreground">
                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-primary" />
                            {restaurant.contact_phone ?? "Phone not listed"}
                          </p>
                          <p className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-primary" />
                            {restaurant.contact_email ?? "Email not listed"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Facilities
                      </p>
                      {detail.facilities.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {detail.facilities.map((facility) => (
                            <span
                              key={facility}
                              className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-foreground"
                            >
                              {facility}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Facilities have not been listed yet.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Popular
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">
                        Most ordered right now
                      </h2>
                    </div>
                    {detail.popular_items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No popular items yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {detail.popular_items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4"
                          >
                            <p className="text-sm font-semibold text-foreground">{item.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{formatPrice(item)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card id="gallery">
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Photos
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">
                        A quick visual feel for the restaurant
                      </h2>
                    </div>
                    {galleryImages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-[#fcfcfd] px-4 py-8 text-sm text-muted-foreground">
                        Photo assets have not been added yet.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {galleryImages.map((imageUrl, index) => (
                          <div
                            key={`${imageUrl}-${index}`}
                            className={`${index === 0 ? "sm:col-span-2" : ""} overflow-hidden rounded-2xl border border-border bg-[#fcfcfd]`}
                          >
                            <div
                              className={`${index === 0 ? "h-52" : "h-36"} w-full bg-cover bg-center`}
                              style={{ backgroundImage: `url(${imageUrl})` }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card id="reviews">
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Reviews
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">
                        Trust signals before checkout
                      </h2>
                    </div>
                    <div className="rounded-2xl border border-border bg-[#fcfcfd] p-5">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#fff5ef] text-primary">
                          <Star className="h-5 w-5 fill-current" />
                        </span>
                        <div>
                          <p className="text-lg font-semibold text-foreground">
                            {(detail.reviews_summary?.average_rating ?? restaurant.rating_average).toFixed(1)} overall rating
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(detail.reviews_summary?.total_reviews ?? restaurant.review_count) > 0
                              ? `${detail.reviews_summary?.total_reviews ?? restaurant.review_count} customer reviews recorded so far.`
                              : "This restaurant is still waiting for its first public reviews."}
                          </p>
                        </div>
                      </div>

                      {detail.reviews_summary?.highlights?.length ? (
                        <div className="mt-5 grid gap-3">
                          {detail.reviews_summary.highlights.map((highlight, index) => (
                            <div
                              key={`${highlight}-${index}`}
                              className="rounded-2xl border border-border bg-white px-4 py-4 text-sm leading-7 text-muted-foreground"
                            >
                              “{highlight}”
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <ReviewEditor
                      restaurantSlug={restaurant.slug}
                      viewerReview={detail.viewer_review}
                      eligibility={detail.review_eligibility}
                      onSaved={async () => {
                        await loadRestaurant();
                      }}
                    />

                    {detail.reviews.length > 0 ? (
                      <div className="grid gap-3">
                        {detail.reviews.map((review) => (
                          <div
                            key={review.id}
                            className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  {review.author_name}
                                </p>
                                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                  {review.source}{review.is_mine ? " • Your review" : ""}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-foreground">
                                  {review.rating.toFixed(1)} / 5
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {new Date(review.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-muted-foreground">
                              {review.comment ?? "No written note left for this review."}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Related
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">
                        Nearby picks
                      </h2>
                    </div>
                    {detail.related_restaurants.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No related restaurants yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {detail.related_restaurants.map((item) => (
                          <Link
                            key={item.id}
                            href={`/restaurants/${item.slug}`}
                            className="block rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4 transition hover:border-primary/30 hover:bg-white"
                          >
                            <p className="text-sm font-semibold text-foreground">{item.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.primary_cuisine_label ?? "Restaurant"} • {formatLocation(item)}
                            </p>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </>
      ) : null}
    </div>
  );
}
