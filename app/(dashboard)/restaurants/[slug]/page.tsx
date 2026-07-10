"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Flame,
  Heart,
  ImageIcon,
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
import { SiteFooter } from "@/components/layout/site-footer";
import { AddToCartButton } from "@/components/customer/add-to-cart-button";
import { FavoriteToggleButton } from "@/components/customer/favorite-toggle-button";
import {
  ReviewEditor,
  type ReviewPayload,
} from "@/components/customer/review-editor";
import { apiFetch } from "@/lib/http";
import {
  extractApiErrorMessage,
  readJsonSafely,
  unwrapApiData,
} from "@/lib/api-utils";
import {
  FALLBACK_MENU_ITEM_IMAGE,
  FALLBACK_RESTAURANT_COVER,
  isUsableImageUrl,
} from "@/lib/restaurant-media";
import { CustomerBookingPanel } from "@/components/reservations/customer-booking-panel";
import { Card, CardContent } from "@/components/ui/card";
import { MenuCard } from "@/components/customer/menu-card";
import { MenuItemModal } from "@/components/customer/menu-item-modal";
import { OrderSummaryPanel } from "@/components/customer/order-summary-panel";
import { useAuth } from "@/hooks/use-auth";

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
  modifier_groups?: any[];
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
    image_urls: string[];
  }>;
  viewer_review: ReviewPayload | null;
  review_eligibility: {
    can_create_review: boolean;
    requires_delivered_order: boolean;
    existing_review_id: number | null;
    reason: string | null;
  } | null;
  gallery_images: Array<{
    id: number;
    image_url: string;
    caption: string | null;
    sort_order: number;
  }>;
};

type ActiveCartItem = {
  id: number;
  menu_item_id: number;
  quantity: number;
  name: string;
  price: number;
  image_url: string | null;
};

type ActiveCartPricing = {
  items_total: number;
  delivery_fee: number;
  coupon_discount: number;
  subtotal_amount: number;
  total_amount: number;
};

type ActiveCart = {
  id: number;
  restaurant_id: number;
  items: ActiveCartItem[];
  items_count: number;
  pricing: ActiveCartPricing;
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
  return (
    [restaurant.area, restaurant.city].filter(Boolean).join(", ") ||
    "Location not set"
  );
}

function collectGalleryImages(detail: RestaurantDetail) {
  const images = [
    detail.restaurant.cover_image_url,
    detail.restaurant.logo_url,
    ...(detail.gallery_images?.map((g) => g.image_url) || []),
    ...detail.featured_items.map((item) => item.image_url),
    ...detail.popular_items.map((item) => item.image_url),
    ...detail.menu_sections.flatMap((section) =>
      section.items.map((item) => item.image_url),
    ),
  ].filter((value): value is string =>
    Boolean(value && isUsableImageUrl(value)),
  );

  return Array.from(new Set(images));
}

export default function RestaurantDetailPage() {
  const { accessToken, hydrated } = useAuth();
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const orderId = searchParams?.get("order_id") ? parseInt(searchParams.get("order_id")!, 10) : undefined;

  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cart & Modal State
  const [selectedItem, setSelectedItem] = useState<MenuItemSummary | null>(
    null,
  );
  const [activeCart, setActiveCart] = useState<ActiveCart | null>(null);
  const [cartSyncing, setCartSyncing] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"order" | "book">("order");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        coords?: { lat?: number; lng?: number };
      };
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

  const loadActiveCart = useCallback(async () => {
    const restaurantId = detail?.restaurant?.id;
    if (!restaurantId || !accessToken) {
      setActiveCart(null);
      setCartError(null);
      return;
    }

    setCartSyncing(true);
    setCartError(null);
    try {
      const response = await apiFetch(`/carts/${restaurantId}`, { auth: true });
      const payload = await readJsonSafely<ActiveCart>(response);
      if (response.status === 404) {
        setActiveCart(null);
        return;
      }
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload, "Failed to load cart."));
      }
      setActiveCart(payload);
    } catch (caught) {
      setCartError(
        caught instanceof Error ? caught.message : "Failed to load cart.",
      );
    } finally {
      setCartSyncing(false);
    }
  }, [accessToken, detail?.restaurant?.id]);

  useEffect(() => {
    void loadActiveCart();
  }, [loadActiveCart]);

  useEffect(() => {
    function handleCartUpdated() {
      void loadActiveCart();
    }

    window.addEventListener("yummydoors:cart-updated", handleCartUpdated);
    return () =>
      window.removeEventListener("yummydoors:cart-updated", handleCartUpdated);
  }, [loadActiveCart]);

  const handleAddToCart = useCallback(
    async (itemId: number, quantity: number, _modifierIds: number[]) => {
      const restaurantId = detail?.restaurant?.id;
      if (!restaurantId) return;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      setCartSyncing(true);
      setCartError(null);
      try {
        const response = await apiFetch(`/carts/${restaurantId}/items`, {
          method: "POST",
          auth: true,
          body: JSON.stringify({
            menu_item_id: itemId,
            quantity,
          }),
        });
        const payload = await readJsonSafely<ActiveCart>(response);
        if (!response.ok) {
          throw new Error(
            extractApiErrorMessage(payload, "Failed to add item to cart."),
          );
        }
        setActiveCart(payload);
        window.dispatchEvent(new CustomEvent("yummydoors:cart-updated"));
      } catch (caught) {
        setCartError(
          caught instanceof Error
            ? caught.message
            : "Failed to add item to cart.",
        );
      } finally {
        setCartSyncing(false);
      }
    },
    [accessToken, detail?.restaurant?.id],
  );

  const handleRemoveFromCart = useCallback(
    async (cartItemId: string) => {
      const restaurantId = detail?.restaurant?.id;
      if (!restaurantId) return;

      setCartSyncing(true);
      setCartError(null);
      try {
        const response = await apiFetch(`/carts/${restaurantId}/items/${cartItemId}`, {
          method: "DELETE",
          auth: true,
        });
        const payload = await readJsonSafely<ActiveCart>(response);
        if (!response.ok) {
          throw new Error(
            extractApiErrorMessage(payload, "Failed to update cart."),
          );
        }
        setActiveCart(payload);
        window.dispatchEvent(new CustomEvent("yummydoors:cart-updated"));
      } catch (caught) {
        setCartError(
          caught instanceof Error ? caught.message : "Failed to update cart.",
        );
      } finally {
        setCartSyncing(false);
      }
    },
    [detail?.restaurant?.id],
  );

  const loadRestaurant = useCallback(
    async (signal?: AbortSignal) => {
      if (!slug || !hydrated) {
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
          { signal, auth: Boolean(accessToken) },
        );
        const payload = (await readJsonSafely(response)) as
          RestaurantDetail | { data: RestaurantDetail };
        if (!response.ok) {
          throw new Error(
            extractApiErrorMessage(payload, "Failed to load restaurant."),
          );
        }

        const data = unwrapApiData<RestaurantDetail>(payload);
        if (data) {
          setDetail(data);
        }
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to load restaurant.",
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [accessToken, hydrated, selectedCoords, slug],
  );

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
    restaurant && isUsableImageUrl(restaurant.logo_url)
      ? restaurant.logo_url
      : null;
  const galleryImages = detail ? collectGalleryImages(detail) : [];
  const heroCategories = restaurant?.categories.length
    ? restaurant.categories
    : [];
  const aboutPoints = [
    restaurant?.primary_cuisine_label
      ? `${restaurant.primary_cuisine_label} kitchen`
      : null,
    restaurant?.supports_delivery
      ? `Delivery available in ${formatLocation(restaurant)}`
      : null,
    restaurant?.offer_text ? restaurant.offer_text : null,
    restaurant?.has_free_delivery ? "Free delivery on selected orders" : null,
  ].filter(Boolean) as string[];

  const handleRestaurantFavoriteChange = (next: boolean) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            restaurant: { ...current.restaurant, is_favorited: next },
            related_restaurants: current.related_restaurants.map(
              (restaurantItem) =>
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
          <div className="text-sm text-muted-foreground">
            Loading restaurant...
          </div>
        </div>
      ) : error ? (
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-6 lg:px-10">
          <div className="rounded-3xl border border-[#ffd8cc] bg-[#fff4ef] px-6 py-5 text-sm text-[#9a3412]">
            {error}
          </div>
        </div>
      ) : detail && restaurant ? (
        <>
          <section className="relative h-[400px] w-full overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${coverUrl})` }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Content Container positioned at the bottom */}
            <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-7xl px-6 pb-12 lg:px-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                {/* Left side: Rating, Title, Address */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex items-center justify-center rounded-[3px] bg-[#66cc66] text-white p-[8px] shadow-sm"
                      style={{
                        fontFamily: "Poppins, Helvetica, sans-serif",
                        fontSize: "15px",
                        fontWeight: 500,
                        lineHeight: "16.5px",
                        width: "56.7px",
                        height: "33.8px",
                      }}
                    >
                      <Star className="mr-1 h-3.5 w-3.5 fill-current" />
                      {restaurant.rating_average.toFixed(1)}
                    </div>
                    <div
                      className="flex flex-col text-white"
                      style={{ fontFamily: "Poppins, Helvetica, sans-serif" }}
                    >
                      <span className="text-[14px] font-medium leading-tight mb-0.5">
                        Superb
                      </span>
                      <span className="text-[11px] opacity-90 leading-tight">
                        {restaurant.review_count} Reviews
                      </span>
                    </div>
                  </div>

                  <h1
                    className="text-[36px] font-semibold text-white m-0 p-0"
                    style={{
                      fontFamily: "Poppins, Helvetica, sans-serif",
                      lineHeight: "43.2px",
                    }}
                  >
                    {restaurant.name}
                  </h1>

                  <div className="flex items-center gap-2 text-white mt-1.5 flex-wrap">
                    <span
                      className="text-[14px] font-medium uppercase tracking-wide"
                      style={{
                        fontFamily: "Poppins, Helvetica, sans-serif",
                        lineHeight: "21px",
                        color: "rgb(255, 255, 255)",
                      }}
                    >
                      {restaurant.primary_cuisine_label ?? "Restaurant"}
                    </span>
                    <span
                      className="text-[14px] opacity-80"
                      style={{
                        fontFamily: "Poppins, Helvetica, sans-serif",
                        lineHeight: "21px",
                      }}
                    >
                      -
                    </span>
                    <span
                      className="flex items-center gap-1 text-[14px] font-medium"
                      style={{
                        fontFamily: "Poppins, Helvetica, sans-serif",
                        lineHeight: "21px",
                        color: "rgb(255, 255, 255)",
                      }}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {formatLocation(restaurant)}
                    </span>
                    <span
                      className="text-[14px] opacity-80"
                      style={{
                        fontFamily: "Poppins, Helvetica, sans-serif",
                        lineHeight: "21px",
                      }}
                    >
                      -
                    </span>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatLocation(restaurant))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[14px] font-medium underline decoration-white/70 hover:decoration-white transition"
                      style={{
                        fontFamily: "Poppins, Helvetica, sans-serif",
                        lineHeight: "21px",
                        color: "rgb(255, 255, 255)",
                      }}
                    >
                      Get directions
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  <a
                    href="#gallery"
                    className="inline-flex items-center gap-2 rounded-[4px] border border-white/30 bg-white px-4 py-2 text-[13px] font-medium text-[#333] shadow-sm transition hover:bg-gray-50"
                  >
                    <ImageIcon
                      className="h-[15px] w-[15px] text-[#555]"
                      strokeWidth={1.5}
                    />
                    View photos
                  </a>
                  <Link
                    href="/messages"
                    className="inline-flex items-center gap-2 rounded-[4px] border border-white/30 bg-white px-4 py-2 text-[13px] font-medium text-[#333] shadow-sm transition hover:bg-gray-50"
                  >
                    <MessageSquareText
                      className="h-[15px] w-[15px] text-[#555]"
                      strokeWidth={1.5}
                    />
                    Message Restaurant
                  </Link>
                  <FavoriteToggleButton
                    entityType="restaurant"
                    entityId={restaurant.id}
                    active={restaurant.is_favorited ?? false}
                    onChange={handleRestaurantFavoriteChange}
                    compact={false}
                    className="inline-flex items-center gap-2 !h-auto !w-auto !rounded-[4px] !border !border-white/30 !bg-white !px-4 !py-2 !text-[13px] !font-medium !text-[#333] !shadow-sm !transition hover:!bg-gray-50"
                  >
                    <Heart
                      className={`h-[15px] w-[15px] ${
                        restaurant.is_favorited
                          ? "fill-[#e8505b] text-[#e8505b]"
                          : "text-[#555]"
                      }`}
                      strokeWidth={2}
                    />
                    <span>
                      {restaurant.is_favorited ? "Saved" : "Save to wishlist"}
                    </span>
                  </FavoriteToggleButton>
                </div>
              </div>
            </div>
          </section>

          {/* Sticky Category Navigation */}
          <nav className="sticky top-[77px] z-30 bg-white border-b border-gray-200 shadow-sm">
            <div className="mx-auto max-w-7xl px-6 lg:px-10">
              <ul className="flex items-center gap-8 overflow-x-auto py-4 no-scrollbar m-0 p-0 list-none">
                {detail.menu_sections.map((section) => (
                  <li key={`nav-${section.category_slug}`}>
                    <a
                      href={`#cat-${section.category_slug}`}
                      className="whitespace-nowrap rounded-full px-[15px] py-[5px] text-[14px] font-normal text-[#444] transition hover:bg-black/10"
                      style={{
                        fontFamily: "Poppins, Helvetica, sans-serif",
                        lineHeight: "21px",
                        backgroundColor: "rgba(0, 0, 0, 0.05)",
                      }}
                    >
                      {section.category_name}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="#reviews"
                    className="whitespace-nowrap flex items-center gap-2 text-[15px] font-semibold text-[#444] transition hover:text-[#e8505b]"
                  >
                    <MessageSquareText className="h-4 w-4" /> Reviews
                  </a>
                </li>
              </ul>
            </div>
          </nav>

          <main className="bg-[#f8f9fa] py-10">
            <div className="mx-auto max-w-7xl px-6 lg:px-10">
              <div className="grid gap-10 xl:grid-cols-[1fr_340px]">
                {/* Left Column: Menu & Reviews */}
                <div className="space-y-12">
                  <section id="recommended" className="space-y-4">
                    <h4 className="text-[21px] font-semibold text-[#444]">
                      Recommended
                    </h4>
                    {detail.featured_items.length === 0 ? (
                      <p className="text-[15px] text-muted-foreground">
                        Featured dishes will appear here.
                      </p>
                    ) : (
                      <div className="grid gap-6 md:grid-cols-2">
                        {detail.featured_items.map((item, index) => (
                          <MenuCard
                            key={item.id}
                            item={item}
                            restaurantId={restaurant.id}
                            index={index}
                            onClick={() => setSelectedItem(item)}
                            onFavoriteChange={handleMenuItemFavoriteChange}
                          />
                        ))}
                      </div>
                    )}
                  </section>

                  <div id="menu" className="space-y-10">
                    {detail.menu_sections.length === 0 ? (
                      <p className="text-[15px] text-muted-foreground">
                        No menu sections are available for this restaurant yet.
                      </p>
                    ) : (
                      detail.menu_sections.map((section) => (
                        <section
                          id={`cat-${section.category_slug}`}
                          key={`${section.category_slug ?? "misc"}-${section.category_id ?? "none"}`}
                          className="space-y-4"
                        >
                          <h4 className="text-[21px] font-semibold text-[#444]">
                            {section.category_name}
                          </h4>

                          <div className="grid gap-6 md:grid-cols-2">
                            {section.items.map((item, index) => (
                              <MenuCard
                                key={item.id}
                                item={item}
                                restaurantId={restaurant.id}
                                index={index}
                                onClick={() => setSelectedItem(item)}
                                onFavoriteChange={handleMenuItemFavoriteChange}
                              />
                            ))}
                          </div>
                        </section>
                      ))
                    )}
                  </div>

                  <div id="reviews" className="space-y-6 pt-4">
                    <h2 className="text-[21px] font-semibold text-[#111]">
                      Reviews
                    </h2>

                    {/* Reviews Summary Block */}
                    <div className="flex flex-col md:flex-row items-center gap-8 bg-white mb-6">
                      <div className="flex w-[160px] h-[160px] shrink-0 flex-col items-center justify-center rounded-[3px] bg-[#32a067] text-white text-center">
                        <span className="text-[42px] font-bold leading-none mb-1">
                          {(
                            detail.reviews_summary?.average_rating ??
                            restaurant.rating_average
                          ).toFixed(1)}
                        </span>
                        <span className="text-[14px] font-bold italic mb-1">
                          Superb
                        </span>
                        <span className="text-[12px]">
                          Based on{" "}
                          {detail.reviews_summary?.total_reviews ??
                            restaurant.review_count}{" "}
                          reviews
                        </span>
                      </div>

                      <div className="flex-1 grid gap-x-8 gap-y-4 md:grid-cols-2 w-full">
                        {(
                          (detail.reviews_summary as any)?.category_scores || []
                        ).map((stat: any) => (
                          <div key={stat.label}>
                            <div className="text-[13px] font-bold text-[#111] mb-1">
                              {stat.label}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                                <div
                                  className="h-full bg-[#32a067]"
                                  style={{
                                    width: `${(stat.score / 10) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[13px] font-bold text-[#111]">
                                {stat.score.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <ReviewEditor
                      restaurantSlug={restaurant.slug}
                      viewerReview={detail.viewer_review}
                      eligibility={detail.review_eligibility}
                      orderId={orderId}
                      onSaved={async () => {
                        await loadRestaurant();
                      }}
                    />

                    {/* Review List */}
                    {detail.reviews.length > 0 ? (
                      <div className="space-y-6 pt-4 rounded-[4px] border border-gray-100 bg-white p-6 shadow-sm">
                        {detail.reviews.map((review) => (
                          <div
                            key={review.id}
                            className="flex gap-4 border-b border-gray-100 py-6 first:pt-0 last:border-0 last:pb-0"
                          >
                            {/* Avatar */}
                            <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-[#111] font-bold">
                              {review.author_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-col gap-1 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[18px] font-bold text-[#32a067]">
                                    {review.rating.toFixed(1)}
                                  </span>
                                  <span className="text-[13px] text-gray-500 italic">
                                    {review.author_name} -{" "}
                                    {new Date(
                                      review.created_at,
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[14px] leading-relaxed text-gray-600 mb-4">
                                {review.comment ??
                                  "No written note left for this review."}
                              </p>
                              {review.image_urls.length > 0 ? (
                                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {review.image_urls.map((url, index) => (
                                    <div
                                      key={`${review.id}-${index}`}
                                      className="aspect-square overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={url}
                                        alt={`${review.author_name} review photo ${index + 1}`}
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              <div className="flex gap-2">
                                <button className="rounded-[3px] border border-gray-200 bg-[#f8f8f8] px-3 py-1.5 text-[12px] font-bold text-gray-600 transition hover:bg-gray-100">
                                  Helpful
                                </button>
                                <button className="rounded-[3px] border border-gray-200 bg-[#f8f8f8] px-3 py-1.5 text-[12px] font-bold text-gray-600 transition hover:bg-gray-100">
                                  Not Helpful
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex w-full rounded-[3px] border border-gray-200 p-1 bg-gray-50 shadow-sm">
                    <button
                      className={`flex-1 rounded-[3px] py-2.5 text-[14px] font-bold transition ${sidebarTab === "order" ? "bg-white text-[#e8505b] shadow-sm" : "text-gray-500 hover:text-[#111]"}`}
                      onClick={() => setSidebarTab("order")}
                    >
                      Order Summary
                    </button>
                    <button
                      className={`flex-1 rounded-[3px] py-2.5 text-[14px] font-bold transition ${sidebarTab === "book" ? "bg-white text-[#e8505b] shadow-sm" : "text-gray-500 hover:text-[#111]"}`}
                      onClick={() => setSidebarTab("book")}
                    >
                      Book a Table
                    </button>
                  </div>

                  {sidebarTab === "order" ? (
                    <div className="space-y-3">
                      {cartError ? (
                        <div className="rounded-[3px] border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-[13px] text-[#be123c]">
                          {cartError}
                        </div>
                      ) : null}
                      <OrderSummaryPanel
                        restaurantId={restaurant.id}
                        items={(activeCart?.items ?? []).map((item) => ({
                          cartItemId: String(item.id),
                          menu_item_id: item.menu_item_id,
                          name: item.name,
                          price: item.price,
                          quantity: item.quantity,
                          modifier_ids: [],
                        }))}
                        pricing={activeCart?.pricing ?? null}
                        isCalculating={cartSyncing}
                        onRemoveItem={handleRemoveFromCart}
                        onCheckout={() => {
                          window.location.href = `/checkout/${restaurant.id}`;
                        }}
                      />
                    </div>
                  ) : (
                    <CustomerBookingPanel
                      restaurantSlug={restaurant.slug}
                      restaurantName={restaurant.name}
                      supportsTableBooking={restaurant.supports_table_booking}
                    />
                  )}

                  {/* About Widget */}
                  <div
                    id="about"
                    className="rounded-[4px] border border-gray-100 bg-white p-6 shadow-sm"
                  >
                    <h3 className="mb-4 text-[16px] font-bold text-[#111]">
                      About
                    </h3>
                    <p className="text-[14px] leading-relaxed text-gray-600">
                      {detail.about_text ??
                        restaurant.short_description ??
                        `${restaurant.name} serves ${restaurant.primary_cuisine_label ?? "fresh food"} around ${formatLocation(restaurant)} with a simple delivery-first experience.`}
                    </p>

                    <div className="mt-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-[14px] text-gray-600">
                          {restaurant.contact_phone ?? "Phone not listed"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-[14px] text-gray-600">
                          {restaurant.contact_email ?? "Email not listed"}
                        </span>
                      </div>
                    </div>

                    {detail.facilities.length > 0 && (
                      <div className="mt-6 border-t border-gray-100 pt-6">
                        <h4 className="mb-3 text-[14px] font-bold text-[#111]">
                          Facilities
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {detail.facilities.map((facility) => (
                            <span
                              key={facility}
                              className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[12px] font-semibold text-gray-600"
                            >
                              {facility}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Popular Widget */}
                  {detail.popular_items.length > 0 && (
                    <div className="rounded-[4px] border border-gray-100 bg-white p-6 shadow-sm">
                      <h3 className="mb-4 text-[16px] font-bold text-[#111]">
                        Popular Now
                      </h3>
                      <div className="space-y-4">
                        {detail.popular_items.map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-600">
                                {idx + 1}
                              </span>
                              <span className="text-[14px] font-semibold text-[#111]">
                                {item.name}
                              </span>
                            </div>
                            <span className="text-[14px] font-bold text-[#111]">
                              {formatPrice(item)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Photos Widget */}
                  {galleryImages.length > 0 && (
                    <div
                      id="gallery"
                      className="rounded-[4px] border border-gray-100 bg-white p-6 shadow-sm"
                    >
                      <h3 className="mb-4 text-[16px] font-bold text-[#111]">
                        Photos
                      </h3>
                      <div className="grid gap-2 grid-cols-2">
                        {galleryImages.slice(0, 4).map((imageUrl, index) => (
                          <div
                            key={`${imageUrl}-${index}`}
                            className="h-24 w-full overflow-hidden rounded-[4px] bg-gray-100"
                          >
                            <div
                              className="h-full w-full bg-cover bg-center transition hover:scale-110"
                              style={{ backgroundImage: `url(${imageUrl})` }}
                            />
                          </div>
                        ))}
                      </div>
                      <Link
                        href={`/restaurants/${slug}/gallery`}
                        className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-[#32a067] hover:underline"
                      >
                        <ImageIcon className="h-4 w-4" />
                        View full gallery
                      </Link>
                    </div>
                  )}

                  {/* Related Widget */}
                  {detail.related_restaurants.length > 0 && (
                    <div className="rounded-[4px] border border-gray-100 bg-white p-6 shadow-sm">
                      <h3 className="mb-4 text-[16px] font-bold text-[#111]">
                        Nearby Places
                      </h3>
                      <div className="space-y-4">
                        {detail.related_restaurants.map((item) => (
                          <Link
                            key={item.id}
                            href={`/restaurants/${item.slug}`}
                            className="group flex flex-col gap-1 border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                          >
                            <span className="text-[14px] font-semibold text-[#111] group-hover:text-primary transition">
                              {item.name}
                            </span>
                            <span className="text-[12px] text-gray-500">
                              {item.primary_cuisine_label ?? "Restaurant"} •{" "}
                              {formatLocation(item)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
          <SiteFooter />
          <MenuItemModal
            isOpen={!!selectedItem}
            onClose={() => setSelectedItem(null)}
            item={selectedItem}
            onAddToCart={handleAddToCart}
          />
        </>
      ) : null}
    </div>
  );
}
