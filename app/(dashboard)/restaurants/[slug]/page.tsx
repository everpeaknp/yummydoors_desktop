"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Flame,
  ImageIcon,
  MapPin,
  MessageSquareText,
  Sparkles,
  Star,
  Store,
  Truck,
  UtensilsCrossed,
} from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { apiFetch } from "@/lib/http";
import {
  FALLBACK_MENU_ITEM_IMAGE,
  FALLBACK_RESTAURANT_COVER,
  isUsableImageUrl,
} from "@/lib/restaurant-media";
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
  offer_text: string | null;
  delivery_eta_min_minutes: number | null;
  delivery_eta_max_minutes: number | null;
  is_featured: boolean;
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
};

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

function extractErrorMessage(payload: any) {
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return "Failed to load restaurant.";
}

export default function RestaurantDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function loadRestaurant() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/restaurants/${slug}`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(extractErrorMessage(payload));
        }
        if (!cancelled) {
          setDetail(payload.data);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load restaurant.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRestaurant();

    return () => {
      cancelled = true;
    };
  }, [slug]);

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
                      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                        {restaurant.name}
                      </h1>
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
                          Cuisine
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {restaurant.primary_cuisine_label ?? "Not set"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Offer
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {restaurant.offer_text ?? "No current offer"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Free delivery
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {restaurant.has_free_delivery ? "Available" : "Not available"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Menu sections
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {detail.menu_sections.length}
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
                                        <span className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                          {item.food_type ?? "standard"}
                                        </span>
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
                      {restaurant.short_description ??
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
                            {restaurant.rating_average.toFixed(1)} overall rating
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {restaurant.review_count > 0
                              ? `${restaurant.review_count} customer reviews recorded so far.`
                              : "This restaurant is still waiting for its first public reviews."}
                          </p>
                        </div>
                      </div>
                    </div>
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
