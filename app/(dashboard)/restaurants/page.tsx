"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, MarkerF, OverlayViewF } from "@react-google-maps/api";
import {
  ArrowUpDown,
  Clock3,
  Heart,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { FavoriteToggleButton } from "@/components/customer/favorite-toggle-button";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { apiFetch } from "@/lib/http";
import {
  FALLBACK_RESTAURANT_COVER,
  isUsableImageUrl,
} from "@/lib/restaurant-media";

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

type RestaurantResponse = {
  items: PublicRestaurant[];
  total: number;
};

type StoredLocationPreference = {
  coords: {
    lat: number;
    lng: number;
  };
  label: string;
};

const LOCATION_STORAGE_KEY = "yummydoors.selectedLocation";
const DEFAULT_COORDS = { lat: 28.2096, lng: 83.9856 };
const DEFAULT_LOCATION_LABEL = "Pokhara, Nepal";
const NAVBAR_HEIGHT_PX = 92;
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: true,
  clickableIcons: false,
  gestureHandling: "greedy",
  mapTypeControl: false,
  streetViewControl: false,
  minZoom: 10,
};

const sortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Top Rated" },
  { value: "delivery_time", label: "Fast Delivery" },
  { value: "highly_reordered", label: "Highly Reordered" },
];

const foodTypeOptions = [
  { value: "", label: "All food" },
  { value: "veg", label: "Veg" },
  { value: "non_veg", label: "Non Veg" },
  { value: "vegan", label: "Vegan" },
] as const;

const serviceModeOptions = [
  { value: "", label: "All modes" },
  { value: "delivery", label: "Delivery" },
  { value: "pickup", label: "Pickup" },
  { value: "table_booking", label: "Table booking" },
] as const;

function formatEta(restaurant: PublicRestaurant) {
  if (
    restaurant.delivery_eta_min_minutes === null ||
    restaurant.delivery_eta_max_minutes === null
  ) {
    return "ETA pending";
  }

  if (
    restaurant.delivery_eta_min_minutes === restaurant.delivery_eta_max_minutes
  ) {
    return `${restaurant.delivery_eta_min_minutes} mins`;
  }

  return `${restaurant.delivery_eta_min_minutes}-${restaurant.delivery_eta_max_minutes} mins`;
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return "Distance pending";
  }
  return `${distanceKm.toFixed(1)} km`;
}

function extractErrorMessage(payload: any) {
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return "Failed to load restaurants.";
}

export default function RestaurantsPage() {
  const { isLoaded: mapLoaded, loadError: mapLoadError } = useGoogleMaps();
  const [hydrated, setHydrated] = useState(false);
  const [restaurants, setRestaurants] = useState<PublicRestaurant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [foodType, setFoodType] = useState("");
  const [serviceMode, setServiceMode] = useState("");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [freeDeliveryOnly, setFreeDeliveryOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedCoords, setSelectedCoords] = useState(DEFAULT_COORDS);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState(
    DEFAULT_LOCATION_LABEL,
  );
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("");

  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") {
      return;
    }

    const categoryFromUrl =
      new URLSearchParams(window.location.search).get("category")?.trim() ?? "";
    setSelectedCategorySlug(categoryFromUrl);

    try {
      const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as StoredLocationPreference;
      if (
        parsed?.coords &&
        Number.isFinite(parsed.coords.lat) &&
        Number.isFinite(parsed.coords.lng) &&
        typeof parsed.label === "string"
      ) {
        setSelectedCoords(parsed.coords);
        setSelectedLocationLabel(parsed.label || DEFAULT_LOCATION_LABEL);
      }
    } catch {
      window.localStorage.removeItem(LOCATION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    async function loadRestaurants() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) {
          params.set("q", searchQuery.trim());
        }
        if (selectedCategorySlug) {
          params.set("category_slug", selectedCategorySlug);
        }
        if (sortBy) {
          params.set("sort_by", sortBy);
        }
        if (foodType) {
          params.set("food_type", foodType);
        }
        if (serviceMode === "delivery") {
          params.set("supports_delivery", "true");
        }
        if (serviceMode === "pickup") {
          params.set("supports_pickup", "true");
        }
        if (openNowOnly) {
          params.set("open_now", "true");
        }
        if (freeDeliveryOnly) {
          params.set("has_free_delivery", "true");
        }
        params.set("latitude", String(selectedCoords.lat));
        params.set("longitude", String(selectedCoords.lng));

        const response = await apiFetch(`/restaurants?${params.toString()}`);
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(extractErrorMessage(payload));
        }

        if (!cancelled) {
          const data = (payload?.data ?? {
            items: [],
            total: 0,
          }) as RestaurantResponse;
          setRestaurants(data.items);
          setTotal(data.total);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Failed to load restaurants.",
          );
          setRestaurants([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRestaurants();

    return () => {
      cancelled = true;
    };
  }, [
    foodType,
    freeDeliveryOnly,
    hydrated,
    openNowOnly,
    searchQuery,
    selectedCoords.lat,
    selectedCoords.lng,
    selectedCategorySlug,
    serviceMode,
    sortBy,
  ]);

  const visibleRestaurants = useMemo(() => {
    if (serviceMode !== "table_booking") {
      return restaurants;
    }
    return restaurants.filter(
      (restaurant) => restaurant.supports_table_booking,
    );
  }, [restaurants, serviceMode]);

  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
  }, []);

  useEffect(() => {
    if (!mapInstance || typeof window === "undefined" || !window.google) return;

    const validRestaurants = visibleRestaurants.filter(
      (r) =>
        r.latitude !== null &&
        r.longitude !== null &&
        Number.isFinite(r.latitude) &&
        Number.isFinite(r.longitude),
    );

    if (validRestaurants.length === 0) {
      mapInstance.panTo(selectedCoords);
      mapInstance.setZoom(13);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(selectedCoords); // ensure the center point is included

    validRestaurants.forEach((restaurant) => {
      bounds.extend({ lat: restaurant.latitude!, lng: restaurant.longitude! });
    });

    mapInstance.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

    const listener = window.google.maps.event.addListener(
      mapInstance,
      "idle",
      () => {
        const currentZoom = mapInstance.getZoom();
        if (currentZoom !== undefined && currentZoom > 15) {
          mapInstance.setZoom(15);
        }
        window.google.maps.event.removeListener(listener);
      },
    );
  }, [mapInstance, visibleRestaurants, selectedCoords]);

  const handleRestaurantFavoriteChange = useCallback(
    (restaurantId: number, next: boolean) => {
      setRestaurants((current) =>
        current.map((restaurant) =>
          restaurant.id === restaurantId
            ? { ...restaurant, is_favorited: next }
            : restaurant,
        ),
      );
    },
    [],
  );

  return (
    <div className="h-screen w-full overflow-hidden bg-white">
      <SiteNavbar
        className="z-40 border-b border-[#e1e5eb] bg-white"
        variant="light"
      />

      <main className="flex h-full w-full pt-[77px]">
        {/* Left Sidebar (List) */}
        <section className="flex h-full w-full flex-col border-r border-[#eceff3] bg-white lg:w-[420px] lg:shrink-0">
          {/* Header Area */}
          <div className="flex shrink-0 flex-col gap-4 border-b border-[#eceff3] bg-[#f7f8fa] px-[18px] py-[16px]">
            <h1 className="text-[15px] font-semibold leading-none text-[#111827]">
              {loading
                ? "Searching..."
                : `${total} restaurants in ${selectedLocationLabel}`}
            </h1>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                setSearchQuery(draftQuery);
              }}
            >
              <div className="relative flex items-center rounded-[4px] border border-[#d7dbe2] bg-white">
                <input
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                  placeholder="Dishes, restaurants or cuisines"
                  className="h-[46px] w-full bg-transparent pl-4 pr-10 text-[13px] text-[#111827] outline-none placeholder:text-[#8b95a7]"
                />
                <button
                  type="submit"
                  className="absolute right-4 text-[#a2aab8] hover:text-[#111827]"
                >
                  <Search className="h-[17px] w-[17px]" />
                </button>
              </div>
            </form>

            <div className="flex items-center justify-between">
              <div className="relative flex h-[40px] items-center gap-1 rounded-[4px] border border-[#d7dbe2] bg-white px-3 hover:border-[#bcc4cf]">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-transparent pr-4 text-[13px] font-medium text-[#111827] outline-none"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Sort by {opt.label}
                    </option>
                  ))}
                </select>
                <ArrowUpDown className="pointer-events-none h-[14px] w-[14px] text-[#7d8694]" />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`flex h-[40px] w-[40px] items-center justify-center rounded-[4px] border transition-colors ${
                  showFilters
                    ? "border-[#ff8a3d] bg-[#fff4eb] text-[#c2410c]"
                    : "border-[#d7dbe2] bg-white text-[#6b7280] hover:border-[#bcc4cf] hover:bg-[#fafafa]"
                }`}
              >
                <SlidersHorizontal className="h-[16px] w-[16px]" />
              </button>
            </div>

            {showFilters && (
              <>
                <div className="flex flex-wrap gap-2">
                  {foodTypeOptions.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setFoodType(option.value)}
                      className={`rounded-[4px] border px-3 py-2 text-[12px] font-medium transition ${
                        foodType === option.value
                          ? "border-[#ff8a3d] bg-[#fff4eb] text-[#c2410c]"
                          : "border-[#d7dbe2] bg-white text-[#4b5563] hover:border-[#bcc4cf]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {serviceModeOptions.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setServiceMode(option.value)}
                      className={`rounded-[4px] border px-3 py-2 text-[12px] font-medium transition ${
                        serviceMode === option.value
                          ? "border-[#ff8a3d] bg-[#fff4eb] text-[#c2410c]"
                          : "border-[#d7dbe2] bg-white text-[#4b5563] hover:border-[#bcc4cf]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOpenNowOnly((current) => !current)}
                    className={`rounded-[4px] border px-3 py-2 text-[12px] font-medium transition ${
                      openNowOnly
                        ? "border-[#ff8a3d] bg-[#fff4eb] text-[#c2410c]"
                        : "border-[#d7dbe2] bg-white text-[#4b5563] hover:border-[#bcc4cf]"
                    }`}
                  >
                    Open now
                  </button>
                  <button
                    type="button"
                    onClick={() => setFreeDeliveryOnly((current) => !current)}
                    className={`rounded-[4px] border px-3 py-2 text-[12px] font-medium transition ${
                      freeDeliveryOnly
                        ? "border-[#ff8a3d] bg-[#fff4eb] text-[#c2410c]"
                        : "border-[#d7dbe2] bg-white text-[#4b5563] hover:border-[#bcc4cf]"
                    }`}
                  >
                    Free delivery
                  </button>
                </div>
              </>
            )}
          </div>

          {/* List Area */}
          <div className="no-scrollbar flex-1 overflow-y-auto bg-[#f8f9fa] px-[18px] py-[20px]">
            {error ? (
              <div className="mb-4 rounded-sm border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-5">
              {visibleRestaurants.map((restaurant) => {
                const coverUrl =
                  (isUsableImageUrl(restaurant.cover_image_url)
                    ? restaurant.cover_image_url
                    : FALLBACK_RESTAURANT_COVER) ?? "/Yummy_Doors-Png.png";

                return (
                  <article
                    key={restaurant.id}
                    className="group relative flex flex-col overflow-hidden rounded-[4px] border border-[#e8ebf0] bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    <Link
                      href={`/restaurants/${restaurant.slug}`}
                      className="absolute inset-0 z-10"
                    />

                    {/* Image Area */}
                    <div className="relative h-[180px] w-full overflow-hidden">
                      <Image
                        fill
                        src={coverUrl}
                        alt={restaurant.name}
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Top Badges */}
                      <div className="absolute left-3 top-3 z-20">
                        {restaurant.primary_cuisine_label ? (
                          <span className="rounded-[2px] bg-white px-[6px] py-[2px] text-[11px] font-semibold text-[#333] shadow-sm">
                            {restaurant.primary_cuisine_label}
                          </span>
                        ) : null}
                      </div>

                      <div className="absolute right-3 top-3 z-20">
                        <div className="flex items-center gap-2">
                          {restaurant.offer_text ? (
                            <span className="rounded-[2px] bg-[#e14b4b] px-[6px] py-[2px] text-[11px] font-semibold text-white shadow-sm">
                              {restaurant.offer_text}
                            </span>
                          ) : null}
                          <FavoriteToggleButton
                            entityType="restaurant"
                            entityId={restaurant.id}
                            active={restaurant.is_favorited}
                            onChange={(next) =>
                              handleRestaurantFavoriteChange(
                                restaurant.id,
                                next,
                              )
                            }
                            compact
                            className="relative z-30 !flex !h-[32px] !w-[32px] !min-h-[32px] !min-w-[32px] items-center justify-center !rounded-full border border-gray-300 !bg-white !p-0 shadow-sm transition hover:border-[#e8505b] hover:!bg-[#fff0f0] group/fav"
                          >
                            <Heart
                              className={`h-4 w-4 transition ${
                                restaurant.is_favorited
                                  ? "fill-[#e8505b] text-[#e8505b]"
                                  : "fill-transparent text-[#555] group-hover/fav:text-[#e8505b]"
                              }`}
                              strokeWidth={2}
                            />
                          </FavoriteToggleButton>
                        </div>
                      </div>

                      {/* Bottom Gradient and Info */}
                      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pt-12">
                        <h3 className="text-[16px] font-bold leading-tight text-white">
                          {restaurant.name}
                        </h3>
                        <p className="mt-0.5 text-[12px] text-white/90">
                          {[restaurant.area, restaurant.city]
                            .filter(Boolean)
                            .join(", ") || "Location not set"}
                        </p>
                      </div>
                    </div>

                    {/* Bottom White Bar */}
                    <div className="relative z-20 flex items-center justify-between bg-white px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          if (
                            mapInstance &&
                            restaurant.latitude &&
                            restaurant.longitude
                          ) {
                            mapInstance.panTo({
                              lat: restaurant.latitude,
                              lng: restaurant.longitude,
                            });
                            mapInstance.setZoom(16);
                          }
                        }}
                        className="flex items-center gap-1.5 text-[#6b7280] hover:text-[#111827] transition"
                      >
                        <MapPin className="h-[14px] w-[14px]" />
                        <span className="text-[13px]">View on Map</span>
                      </button>
                      <div className="flex items-center gap-1 text-[#111827]">
                        <Star className="h-[14px] w-[14px] fill-[#22c55e] text-[#22c55e]" />
                        <span className="text-[13px] font-bold">
                          {restaurant.rating_average.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}

              {!loading && !error && visibleRestaurants.length === 0 ? (
                <div className="py-10 text-center text-[14px] text-[#6b7280]">
                  No restaurants found matching your search.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Right Map */}
        <aside className="hidden h-full relative overflow-hidden lg:block lg:flex-1">
          {mapLoadError ? (
            <div className="flex h-full items-center justify-center bg-[#f7f8fa] text-sm text-[#b91c1c]">
              Failed to load map.
            </div>
          ) : mapLoaded ? (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={selectedCoords}
              zoom={13}
              onLoad={handleMapLoad}
              options={MAP_OPTIONS}
            >
              <MarkerF position={selectedCoords} />
              {visibleRestaurants.map((restaurant) => {
                if (
                  restaurant.latitude !== null &&
                  restaurant.longitude !== null &&
                  Number.isFinite(restaurant.latitude) &&
                  Number.isFinite(restaurant.longitude)
                ) {
                  return (
                    <OverlayViewF
                      key={`map-marker-${restaurant.id}`}
                      position={{
                        lat: restaurant.latitude,
                        lng: restaurant.longitude,
                      }}
                      mapPaneName="overlayMouseTarget"
                      getPixelPositionOffset={(width, height) => ({
                        x: -(width / 2),
                        y: -height,
                      })}
                    >
                      <Link
                        href={`/restaurants/${restaurant.slug}`}
                        className="group flex flex-col items-center gap-1 transition-transform hover:scale-105"
                      >
                        {/* Name Tooltip */}
                        <div className="rounded-md bg-white px-2.5 py-1 text-sm font-bold text-[#111827] shadow-md opacity-90 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                          {restaurant.name}
                        </div>
                        {/* Green Pin */}
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-[#22c55e] shadow-md">
                          <Store className="h-4 w-4 text-white" />
                        </div>
                      </Link>
                    </OverlayViewF>
                  );
                }
                return null;
              })}
            </GoogleMap>
          ) : (
            <div className="flex h-full items-center justify-center bg-[#f7f8fa] text-sm text-[#6b7280]">
              Loading map...
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
