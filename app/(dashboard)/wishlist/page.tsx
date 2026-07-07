"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Star } from "lucide-react";

import { FavoriteToggleButton } from "@/components/customer/favorite-toggle-button";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/http";
import { extractApiErrorMessage, readJsonSafely, unwrapApiData } from "@/lib/api-utils";
import { FALLBACK_MENU_ITEM_IMAGE, FALLBACK_RESTAURANT_COVER, isUsableImageUrl } from "@/lib/restaurant-media";

type CategorySummary = {
  id: number;
  slug: string;
  name: string;
};

type RestaurantSummary = {
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
  is_favorited?: boolean;
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
  is_favorited?: boolean;
};

type FavoriteRestaurant = {
  id: number;
  created_at: string;
  restaurant: RestaurantSummary;
};

type FavoriteMenuItem = {
  id: number;
  created_at: string;
  menu_item: MenuItemSummary;
  restaurant: RestaurantSummary;
};

type FavoritesResponse = {
  restaurants: FavoriteRestaurant[];
  menu_items: FavoriteMenuItem[];
  restaurant_ids: number[];
  menu_item_ids: number[];
};

function formatLocation(restaurant: RestaurantSummary) {
  return [restaurant.area, restaurant.city].filter(Boolean).join(", ") || "Location not set";
}

export default function WishlistPage() {
  const [favorites, setFavorites] = useState<FavoritesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const response = await apiFetch("/favorites", { auth: true });
      const payload = await readJsonSafely<FavoritesResponse | { data: FavoritesResponse }>(response);
      if (!response.ok) {
        if (!cancelled) {
          setError(extractApiErrorMessage(payload, "Failed to load wishlist."));
          setLoading(false);
        }
        return;
      }

      const data = unwrapApiData<FavoritesResponse>(payload);
      if (!cancelled) {
        setFavorites(
          data ?? {
            restaurants: [],
            menu_items: [],
            restaurant_ids: [],
            menu_item_ids: [],
          },
        );
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRestaurantChange = (restaurantId: number, next: boolean) => {
    if (!next) {
      setFavorites((current) =>
        current
          ? {
              ...current,
              restaurants: current.restaurants.filter((item) => item.restaurant.id !== restaurantId),
              restaurant_ids: current.restaurant_ids.filter((id) => id !== restaurantId),
            }
          : current,
      );
    }
  };

  const handleMenuItemChange = (menuItemId: number, next: boolean) => {
    if (!next) {
      setFavorites((current) =>
        current
          ? {
              ...current,
              menu_items: current.menu_items.filter((item) => item.menu_item.id !== menuItemId),
              menu_item_ids: current.menu_item_ids.filter((id) => id !== menuItemId),
            }
          : current,
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />

      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Wishlist
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
            Saved restaurants and dishes
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Keep your go-to places here so reordering, reviewing, and jumping back into checkout takes one click.
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-border bg-white px-6 py-10 text-sm text-muted-foreground">
            Loading wishlist...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-[#fbcfe8] bg-[#fff1f2] px-6 py-5 text-sm text-[#be123c]">
            {error}
          </div>
        ) : (
          <div className="grid gap-8">
            <Card>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Restaurants
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-foreground">
                      Your saved places
                    </h2>
                  </div>
                  <span className="rounded-full bg-[#fff5ef] px-3 py-1 text-xs font-semibold text-primary">
                    {favorites?.restaurants.length ?? 0} saved
                  </span>
                </div>

                {favorites?.restaurants.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {favorites.restaurants.map((favorite) => {
                      const restaurant = favorite.restaurant;
                      const imageUrl = isUsableImageUrl(restaurant.cover_image_url)
                        ? restaurant.cover_image_url
                        : FALLBACK_RESTAURANT_COVER;

                      return (
                        <div key={favorite.id} className="overflow-hidden rounded-2xl border border-border bg-[#fcfcfd]">
                          <div
                            className="h-48 w-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${imageUrl})` }}
                          />
                          <div className="space-y-4 p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <Link href={`/restaurants/${restaurant.slug}`} className="text-lg font-semibold text-foreground hover:text-primary">
                                  {restaurant.name}
                                </Link>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {restaurant.primary_cuisine_label ?? "Restaurant"} • {formatLocation(restaurant)}
                                </p>
                              </div>
                              <FavoriteToggleButton
                                entityType="restaurant"
                                entityId={restaurant.id}
                                active
                                onChange={(next) => handleRestaurantChange(restaurant.id, next)}
                                className="h-10 rounded-full px-3"
                              />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Star className="h-4 w-4 fill-[#ffb648] text-[#ffb648]" />
                              {restaurant.rating_average.toFixed(1)} ({restaurant.review_count})
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No saved restaurants yet. Tap the heart on any restaurant to keep it here.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Menu items
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-foreground">
                      Dishes worth coming back for
                    </h2>
                  </div>
                  <span className="rounded-full bg-[#fff5ef] px-3 py-1 text-xs font-semibold text-primary">
                    {favorites?.menu_items.length ?? 0} saved
                  </span>
                </div>

                {favorites?.menu_items.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {favorites.menu_items.map((favorite) => {
                      const item = favorite.menu_item;
                      const imageUrl = isUsableImageUrl(item.image_url)
                        ? item.image_url
                        : FALLBACK_MENU_ITEM_IMAGE;

                      return (
                        <div key={favorite.id} className="grid gap-4 rounded-2xl border border-border bg-[#fcfcfd] p-4 md:grid-cols-[120px_1fr]">
                          <div
                            className="h-28 rounded-2xl bg-cover bg-center"
                            style={{ backgroundImage: `url(${imageUrl})` }}
                          />
                          <div className="flex flex-col justify-between gap-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-base font-semibold text-foreground">{item.name}</p>
                                <Link href={`/restaurants/${favorite.restaurant.slug}`} className="mt-1 block text-sm text-muted-foreground hover:text-primary">
                                  {favorite.restaurant.name}
                                </Link>
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {item.description ?? "Saved from your restaurant browsing flow."}
                                </p>
                              </div>
                              <FavoriteToggleButton
                                entityType="menu-item"
                                entityId={item.id}
                                active
                                onChange={(next) => handleMenuItemChange(item.id, next)}
                                className="h-10 rounded-full px-3"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <p className="text-sm font-semibold text-foreground">
                                {item.currency_code} {item.price}
                              </p>
                              <Link href={`/restaurants/${favorite.restaurant.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-[#dd451a]">
                                <Heart className="h-4 w-4 fill-current" />
                                Open restaurant
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No saved dishes yet. Save menu items from restaurant detail to build a quick reorder list.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
