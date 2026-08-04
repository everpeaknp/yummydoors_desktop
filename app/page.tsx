"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  Star,
  ArrowRight,
  Instagram,
  Twitter,
  Facebook,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
} from "lucide-react";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/utils";
import { readJsonSafely, extractApiErrorMessage } from "@/lib/api-utils";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { SiteFooter } from "@/components/layout/site-footer";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import {
  mapStoredAddress,
  mergeStoredUserWithProfile,
} from "@/lib/auth-mappers";
import {
  loadStoredAuth,
  saveStoredAuth,
  type StoredCustomerAddress,
  type StoredUser,
} from "@/lib/auth-storage";
import {
  FALLBACK_MENU_ITEM_IMAGE,
  FALLBACK_RESTAURANT_COVER,
  isUsableImageUrl,
} from "@/lib/restaurant-media";

const MapPicker = dynamic(() => import("@/components/ui/map-picker"), {
  ssr: false,
});

function useDraggableScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!ref.current) return;
    setIsDown(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };
  const onMouseLeave = () => setIsDown(false);
  const onMouseUp = () => setIsDown(false);
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 2;
    ref.current.scrollLeft = scrollLeft - walk;
  };

  const scrollRight = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (ref.current) {
      ref.current.scrollBy({ left: 350, behavior: "smooth" });
    }
  };

  const scrollPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (ref.current) {
      ref.current.scrollBy({ left: -350, behavior: "smooth" });
    }
  };

  return {
    ref,
    events: { onMouseDown, onMouseLeave, onMouseUp, onMouseMove },
    scrollRight,
    scrollPrev,
    isDragging: isDown,
  };
}

function useAutoPager(length: number, delay = 3000) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (length <= 1) {
      setIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % length);
    }, delay);

    return () => window.clearInterval(timer);
  }, [length, delay]);

  useEffect(() => {
    if (index >= length) {
      setIndex(0);
    }
  }, [index, length]);

  return { index, setIndex };
}

type HomeCategory = {
  id: number;
  slug: string;
  name: string;
  icon_url?: string | null;
  web_image_url?: string | null;
  sort_order: number;
  is_featured: boolean;
};

type HomeRestaurant = {
  id: number;
  slug: string;
  name: string;
  cover_image_url?: string | null;
  logo_url?: string | null;
  short_description?: string | null;
  primary_cuisine_label?: string | null;
  city?: string | null;
  area?: string | null;
  rating_average: number;
  review_count: number;
  supports_delivery: boolean;
  has_free_delivery: boolean;
  offer_text?: string | null;
  delivery_eta_min_minutes?: number | null;
  delivery_eta_max_minutes?: number | null;
  is_featured: boolean;
  categories: HomeCategory[];
};

type HomePromo = {
  id: number;
  title: string;
  subtitle?: string | null;
  image_url: string;
  image_url_mobile?: string | null;
  cta_text?: string | null;
};

type HomeMenuItem = {
  id: number;
  restaurant_id: number;
  category_id?: number | null;
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  price: number;
  currency_code: string;
  is_featured: boolean;
  is_popular: boolean;
  is_spicy?: boolean;
  popularity_score: number;
};

type HomeLocationContext = {
  location_title: string;
  location_subtitle: string;
  selected_address_id?: number | null;
  saved_addresses_count: number;
  selected_address_label?: string | null;
};

type FeaturedVideo = {
  id: number;
  title: string;
  subtitle: string | null;
  thumbnail_url: string | null;
  video_url: string;
  sort_order: number;
};

type HomeFeed = {
  location_context: HomeLocationContext;
  categories: HomeCategory[];
  restaurants: HomeRestaurant[];
  explore_restaurants: HomeRestaurant[];
  promos: HomePromo[];
  hero_promos?: HomePromo[];
  banner_promos?: HomePromo[];
  cookie_promos?: HomePromo[];
  recommended_items: HomeMenuItem[];
  popular_foods: HomeMenuItem[];
  featured_videos: FeaturedVideo[];
};

function HomeSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-white text-gray-800">
      <div className="h-[600px] bg-gray-200 lg:h-[700px]">
        <div className="mx-auto flex h-full max-w-6xl flex-col justify-center px-6 pt-24">
          <div className="h-10 w-3/4 max-w-xl rounded bg-white/50" />
          <div className="mt-4 h-7 w-1/2 max-w-md rounded bg-white/40" />
          <div className="mt-12 h-14 w-full max-w-3xl rounded bg-white/60" />
        </div>
      </div>
      <main className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        <section>
          <div className="mb-6 h-8 w-52 rounded bg-gray-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 rounded-2xl bg-gray-200" />)}
          </div>
        </section>
        <section>
          <div className="mb-6 h-8 w-64 rounded bg-gray-200" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-72 rounded-2xl bg-gray-200" />)}
          </div>
        </section>
      </main>
    </div>
  );
}

const LOCATION_STORAGE_KEY = "yummydoors.selectedLocation";

type StoredLocationPreference = {
  coords: {
    lat: number;
    lng: number;
  };
  label: string;
};

type ResolvedAddressDetails = {
  label: string;
  addressLine1: string;
  streetNumber: string | null;
  city: string | null;
  area: string | null;
  stateOrProvince: string | null;
};

const LOCATION_PLACEHOLDER_LABELS = new Set([
  "set delivery location",
  "loading",
  "locating you...",
  "choose location",
  "current location",
  "resolving current location...",
  "unable to use current location",
]);

function formatPrice(price: number, currencyCode = "NPR") {
  const rounded = Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2);
  return currencyCode === "NPR"
    ? `Rs. ${rounded}`
    : `${currencyCode} ${rounded}`;
}

function isMeaningfulLocationLabel(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return false;
  }

  return !LOCATION_PLACEHOLDER_LABELS.has(normalized);
}

const heroSlides = [
  {
    id: "sushi",
    titleLines: ["Start to Enjoy", "unique food"],
    subtitle: "The best restaurants at the best price",
    titleMaxWidth: "max-w-[650px]",
    subtitleMaxWidth: "max-w-[640px]",
    stackShift: "-translate-y-[26px]",
    image:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=2200&auto=format&fit=crop",
  },
  {
    id: "burger",
    titleLines: ["Discover", "and Reserve"],
    subtitle: "The best restaurants at the best price",
    titleMaxWidth: "max-w-[660px]",
    subtitleMaxWidth: "max-w-[640px]",
    stackShift: "-translate-y-[18px]",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=2200&auto=format&fit=crop",
  },
  {
    id: "pizza",
    titleLines: ["Finally...", "it's time to relax"],
    subtitle: "The best restaurants at the best price",
    titleMaxWidth: "max-w-[760px]",
    subtitleMaxWidth: "max-w-[640px]",
    stackShift: "-translate-y-[8px]",
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=2200&auto=format&fit=crop",
  },
];

export default function LandingPage() {
  const { isLoaded: googleMapsReady } = useGoogleMaps();
  const [hydrated, setHydrated] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<StoredUser | null>(null);
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const lastLoadKeyRef = useRef<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 28.2096,
    lng: 83.9856,
  });
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState<string>(
    "Set delivery location",
  );
  const [locationSelectionLocked, setLocationSelectionLocked] = useState(false);
  const [locationPreferenceReady, setLocationPreferenceReady] = useState(false);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<StoredCustomerAddress[]>(
    [],
  );
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [savingSelectedAddress, setSavingSelectedAddress] = useState(false);
  const [locationSaveMessage, setLocationSaveMessage] = useState<string | null>(
    null,
  );
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [cookiePromoIndex, setCookiePromoIndex] = useState(0);
  const [foodSearch, setFoodSearch] = useState("");
  const locationDropdownRef = useRef<HTMLDivElement | null>(null);
  const heroSlider = useAutoPager(heroSlides.length, 5000);

  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem("yummydoors.auth");
      if (stored) {
        const parsed = JSON.parse(stored);
        setAccessToken(parsed?.accessToken ?? null);
        setSessionUser(parsed?.user ?? null);
      }
    } catch {
      setAccessToken(null);
      setSessionUser(null);
    }

    try {
      const storedLocation = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!storedLocation) {
        return;
      }

      const parsed = JSON.parse(storedLocation) as StoredLocationPreference;
      if (
        parsed?.coords &&
        Number.isFinite(parsed.coords.lat) &&
        Number.isFinite(parsed.coords.lng) &&
        typeof parsed.label === "string"
      ) {
        setSelectedCoords(parsed.coords);
        setSelectedLocationLabel(
          isMeaningfulLocationLabel(parsed.label)
            ? parsed.label
            : `${parsed.coords.lat.toFixed(5)}, ${parsed.coords.lng.toFixed(5)}`,
        );
        setLocationSelectionLocked(true);
      }
    } catch {
      window.localStorage.removeItem(LOCATION_STORAGE_KEY);
    } finally {
      setLocationPreferenceReady(true);
    }
  }, []);

  useEffect(() => {
    setCoords({ lat: 28.2096, lng: 83.9856 });
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (err) => {
          console.warn("Geolocation error or denied:", err);
        },
        { timeout: 10000 },
      );
    } else {
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncViewport = () => {
      setIsCompactViewport(window.innerWidth < 768);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!locationDropdownRef.current?.contains(event.target as Node)) {
        setLocationModalOpen(false);
      }
    }

    if (locationModalOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [locationModalOpen]);

  const catScroll = useDraggableScroll();
  const restScroll = useDraggableScroll();
  const exploreScroll = useDraggableScroll();
  const activeCoords = locationSelectionLocked
    ? (selectedCoords ?? coords)
    : (coords ?? selectedCoords);

  useEffect(() => {
    if (!hydrated || !accessToken) {
      setSavedAddresses([]);
      return;
    }

    let cancelled = false;

    async function loadSavedAddresses() {
      setAddressesLoading(true);
      try {
        const response = await apiFetch("/me/addresses", { auth: true });
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        if (!cancelled && Array.isArray(payload)) {
          const nextAddresses = payload.map(mapStoredAddress);
          setSavedAddresses(nextAddresses);
          const defaultAddress = nextAddresses.find(
            (address) =>
              address.isDefault &&
              address.latitude != null &&
              address.longitude != null,
          );
          if (defaultAddress) {
            const nextCoords = {
              lat: defaultAddress.latitude!,
              lng: defaultAddress.longitude!,
            };
            setSelectedCoords(nextCoords);
            setSelectedLocationLabel(
              defaultAddress.addressSummary || defaultAddress.locationTitle,
            );
            setLocationSelectionLocked(true);
            window.localStorage.setItem(
              LOCATION_STORAGE_KEY,
              JSON.stringify({
                coords: nextCoords,
                label: defaultAddress.addressSummary || defaultAddress.locationTitle,
              }),
            );
          }
        }
      } catch {
        // Keep the location picker usable even if addresses fail to load.
      } finally {
        if (!cancelled) {
          setAddressesLoading(false);
        }
      }
    }

    void loadSavedAddresses();

    return () => {
      cancelled = true;
    };
  // These functions intentionally use the latest auth state while the timer is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, accessToken]);

  useEffect(() => {
    if (!hydrated || !locationPreferenceReady || !activeCoords) {
      return;
    }

    const currentCoords = activeCoords;
    const loadKey = accessToken
      ? `auth-${currentCoords.lat}-${currentCoords.lng}`
      : `guest-${currentCoords.lat}-${currentCoords.lng}`;
    if (lastLoadKeyRef.current === loadKey) {
      return;
    }
    lastLoadKeyRef.current = loadKey;

    let cancelled = false;

    async function loadData() {
      try {
        const feedRes = await apiFetch(
          `/home/feed?latitude=${currentCoords.lat}&longitude=${currentCoords.lng}`,
          {
            auth: Boolean(accessToken),
          },
        );
        if (feedRes.ok) {
          const feedPayload = await feedRes.json();
          if (!cancelled) {
            setFeed(feedPayload.data);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadData();

    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken, activeCoords, locationPreferenceReady]);

  const fallbackCategories: HomeCategory[] = [
    {
      id: 1,
      slug: "momo",
      name: "Momo",
      icon_url:
        "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop",
      sort_order: 10,
      is_featured: true,
    },
    {
      id: 2,
      slug: "coffee",
      name: "Coffee",
      icon_url:
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop",
      sort_order: 20,
      is_featured: true,
    },
    {
      id: 3,
      slug: "pizza",
      name: "Pizza",
      icon_url:
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800&auto=format&fit=crop",
      sort_order: 30,
      is_featured: true,
    },
    {
      id: 4,
      slug: "burger",
      name: "Burger",
      icon_url:
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop",
      sort_order: 40,
      is_featured: true,
    },
  ];
  const fallbackRestaurants: HomeRestaurant[] = [
    {
      id: 1,
      slug: "yummy-momo-house",
      name: "Yummy Momo House",
      cover_image_url:
        "https://images.unsplash.com/photo-1562967914-608f82629710?q=80&w=1600&auto=format&fit=crop",
      short_description:
        "Steamed momo, jhol momo, and late-night comfort bowls.",
      primary_cuisine_label: "Nepali",
      city: "Pokhara",
      area: "Ratnachowk",
      rating_average: 4.6,
      review_count: 388,
      supports_delivery: true,
      has_free_delivery: true,
      offer_text: "Free delivery on first order",
      delivery_eta_min_minutes: 20,
      delivery_eta_max_minutes: 33,
      is_featured: true,
      categories: [],
    },
    {
      id: 2,
      slug: "coffee-break-pokhara",
      name: "Coffee Break Pokhara",
      cover_image_url:
        "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1600&auto=format&fit=crop",
      short_description:
        "Breakfast plates, espresso, pastries, and quick cafe delivery.",
      primary_cuisine_label: "Cafe",
      city: "Pokhara",
      area: "Lakeside",
      rating_average: 4.3,
      review_count: 214,
      supports_delivery: true,
      has_free_delivery: false,
      offer_text: "20% off above Rs.500",
      delivery_eta_min_minutes: 18,
      delivery_eta_max_minutes: 28,
      is_featured: true,
      categories: [],
    },
  ];
  const fallbackPromos: HomePromo[] = [
    {
      id: 1,
      title: "Free delivery week",
      subtitle: "Across selected Pokhara favorites",
      image_url: FALLBACK_RESTAURANT_COVER,
      cta_text: "Explore now",
    },
  ];
  const fallbackRecommendedItems: HomeMenuItem[] = [
    {
      id: 1,
      restaurant_id: 1,
      category_id: 1,
      slug: "buff-jhol-momo",
      name: "Buff Jhol Momo",
      description: "Steamed momo in a spicy sesame-tomato broth.",
      image_url:
        "https://images.unsplash.com/photo-1626776876729-bab4369a5a5d?q=80&w=1200&auto=format&fit=crop",
      price: 240,
      currency_code: "NPR",
      is_featured: true,
      is_popular: true,
      popularity_score: 98,
    },
    {
      id: 2,
      restaurant_id: 3,
      category_id: 3,
      slug: "pepperoni-supreme",
      name: "Pepperoni Supreme",
      description: "Wood-fired pizza with pepperoni and mozzarella.",
      image_url:
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1200&auto=format&fit=crop",
      price: 680,
      currency_code: "NPR",
      is_featured: true,
      is_popular: true,
      popularity_score: 99,
    },
  ];
  const fallbackLocationContext = {
    location_title: "Choose location",
    location_subtitle: "Finding the best food near your coordinates...",
    selected_address_label: null,
    saved_addresses_count: 0,
  };

  const categories = (
    feed?.categories?.filter((item) => item.slug !== "all") ?? []
  ).length
    ? (feed?.categories.filter((item) => item.slug !== "all") as HomeCategory[])
    : fallbackCategories;
  const restaurants = feed?.restaurants?.length
    ? feed.restaurants
    : fallbackRestaurants;
  const promos = feed?.promos?.length ? feed.promos : fallbackPromos;
  const cookiePromos = feed?.cookie_promos?.length
    ? feed.cookie_promos
    : [
        {
          id: -1,
          title: "Delivery Service",
          subtitle: "Free delivery on your first order",
          image_url:
            "https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=1200&auto=format&fit=crop",
          cta_text: "Order Now",
        },
      ];
  const heroPromos = feed?.hero_promos ?? [];
  const bannerPromos = feed?.banner_promos ?? [];
  const recommendedItems = feed?.recommended_items ?? [];
  const popularFoods = feed?.popular_foods ?? [];
  const featuredVideos = feed?.featured_videos ?? [];
  const locationContext = feed?.location_context ?? fallbackLocationContext;
  const safeCategories = categories;
  const safeRestaurants = restaurants;
  const exploreRestaurants = feed?.explore_restaurants?.length
    ? (feed.explore_restaurants as HomeRestaurant[])
    : safeRestaurants;
  const activeHeroPromos = heroPromos.length ? heroPromos : fallbackPromos;
  const activeBannerPromos = bannerPromos;

  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    if (window.sessionStorage.getItem("yummydoors.cookie-modal-seen") === "1") {
      return;
    }
    window.sessionStorage.setItem("yummydoors.cookie-modal-seen", "1");
    setCookieModalOpen(true);
  }, [loading]);

  useEffect(() => {
    if (!cookieModalOpen || cookiePromos.length < 2) return;
    const timer = window.setInterval(() => {
      setCookiePromoIndex((current) => (current + 1) % cookiePromos.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [cookieModalOpen, cookiePromos.length]);
  const trendingTerms = [...recommendedItems, ...popularFoods]
    .map((item) => item.name)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 4);
  const heroPager = useAutoPager(activeHeroPromos.length, 3000);
  const bannerPager = useAutoPager(activeBannerPromos.length, 3000);
  const heroSwipeStartX = useRef<number | null>(null);
  const heroWasDragged = useRef(false);
  const [heroDragOffset, setHeroDragOffset] = useState(0);
  const [heroIsDragging, setHeroIsDragging] = useState(false);
  const handleHeroPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    heroSwipeStartX.current = event.clientX;
    heroWasDragged.current = false;
    setHeroIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleHeroPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (heroSwipeStartX.current === null) return;
    setHeroDragOffset(event.clientX - heroSwipeStartX.current);
  };
  const endHeroDrag = () => {
    setHeroIsDragging(false);
    setHeroDragOffset(0);
    heroSwipeStartX.current = null;
  };
  const handleHeroPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (heroSwipeStartX.current === null) return;
    const distance = event.clientX - heroSwipeStartX.current;
    if (Math.abs(distance) > 40 && activeHeroPromos.length > 1) {
      heroWasDragged.current = true;
      heroPager.setIndex(
        (heroPager.index + (distance < 0 ? 1 : activeHeroPromos.length - 1)) %
          activeHeroPromos.length,
      );
    }
    endHeroDrag();
  };
  const bannerSwipeStartX = useRef<number | null>(null);
  const bannerWasDragged = useRef(false);
  const [bannerDragOffset, setBannerDragOffset] = useState(0);
  const [bannerIsDragging, setBannerIsDragging] = useState(false);
  const handleBannerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    bannerSwipeStartX.current = event.clientX;
    bannerWasDragged.current = false;
    setBannerIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleBannerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (bannerSwipeStartX.current === null) return;
    setBannerDragOffset(event.clientX - bannerSwipeStartX.current);
  };
  const endBannerDrag = () => {
    setBannerIsDragging(false);
    setBannerDragOffset(0);
    bannerSwipeStartX.current = null;
  };
  const handleBannerPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (bannerSwipeStartX.current === null) return;
    const distance = event.clientX - bannerSwipeStartX.current;
    if (Math.abs(distance) > 40 && activeBannerPromos.length > 1) {
      bannerWasDragged.current = true;
      bannerPager.setIndex(
        (bannerPager.index + (distance < 0 ? 1 : activeBannerPromos.length - 1)) %
          activeBannerPromos.length,
      );
    }
    endBannerDrag();
  };
  const currentHeroPromo =
    activeHeroPromos[heroPager.index] ?? fallbackPromos[0];
  const currentHeroPromoImage = isUsableImageUrl(
    currentHeroPromo.image_url_mobile ?? undefined,
  )
    ? currentHeroPromo.image_url_mobile!
    : getPromoImage(currentHeroPromo);
  const currentBannerPromo =
    activeBannerPromos[bannerPager.index] ?? currentHeroPromo;
  const currentHeroSlide = heroSlides[heroSlider.index];

  useEffect(() => {
    if (coords && !selectedCoords) {
      setSelectedCoords(coords);
    }
  }, [coords, selectedCoords]);

  useEffect(() => {
    if (locationSelectionLocked) {
      return;
    }

    const selectedAddressLabel = locationContext.selected_address_label;
    const locationTitle = locationContext.location_title;

    if (isMeaningfulLocationLabel(selectedAddressLabel)) {
      setSelectedLocationLabel(selectedAddressLabel ?? "Set delivery location");
      return;
    }
    if (isMeaningfulLocationLabel(locationTitle)) {
      setSelectedLocationLabel(locationTitle ?? "Set delivery location");
    }
  }, [
    locationContext.location_title,
    locationContext.selected_address_label,
    locationSelectionLocked,
  ]);

  useEffect(() => {
    if (
      !locationSelectionLocked ||
      !selectedCoords ||
      isMeaningfulLocationLabel(selectedLocationLabel)
    ) {
      return;
    }

    const coordsToResolve = selectedCoords;
    let cancelled = false;

    async function hydrateSelectedLocationLabel() {
      const label = await resolveAddressLabel(
        coordsToResolve.lat,
        coordsToResolve.lng,
      );
      if (!cancelled && isMeaningfulLocationLabel(label)) {
        setSelectedLocationLabel(label);
      }
    }

    void hydrateSelectedLocationLabel();

    return () => {
      cancelled = true;
    };
  }, [locationSelectionLocked, selectedCoords, selectedLocationLabel]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !locationPreferenceReady ||
      !locationSelectionLocked ||
      !selectedCoords
    ) {
      return;
    }

    const payload: StoredLocationPreference = {
      coords: selectedCoords,
      label: isMeaningfulLocationLabel(selectedLocationLabel)
        ? selectedLocationLabel
        : `${selectedCoords.lat.toFixed(5)}, ${selectedCoords.lng.toFixed(5)}`,
    };

    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(payload));
  }, [
    locationPreferenceReady,
    locationSelectionLocked,
    selectedCoords,
    selectedLocationLabel,
  ]);

  function getPromoImage(promo: HomePromo | undefined) {
    if (!promo) {
      return FALLBACK_RESTAURANT_COVER;
    }

    if (
      isCompactViewport &&
      isUsableImageUrl(promo.image_url_mobile ?? undefined)
    ) {
      return promo.image_url_mobile!;
    }

    if (isUsableImageUrl(promo.image_url)) {
      return promo.image_url;
    }

    return FALLBACK_RESTAURANT_COVER;
  }

  async function resolveAddressLabel(lat: number, lng: number) {
    if (
      typeof window === "undefined" ||
      typeof google === "undefined" ||
      !google.maps
    ) {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    try {
      const geocoder = new google.maps.Geocoder();
      return new Promise<string>((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results?.[0]?.formatted_address) {
            resolve(results[0].formatted_address);
            return;
          }
          resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        });
      });
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }

  async function resolveAddressDetails(
    lat: number,
    lng: number,
  ): Promise<ResolvedAddressDetails> {
    const fallbackLabel =
      selectedLocationLabel && selectedLocationLabel !== "Set delivery location"
        ? selectedLocationLabel
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    const fallback: ResolvedAddressDetails = {
      label: fallbackLabel,
      addressLine1: fallbackLabel,
      streetNumber: null,
      city: null,
      area: null,
      stateOrProvince: null,
    };

    if (
      typeof window === "undefined" ||
      typeof google === "undefined" ||
      !google.maps
    ) {
      return fallback;
    }

    let geocoder: google.maps.Geocoder;
    try {
      geocoder = new google.maps.Geocoder();
    } catch {
      return fallback;
    }

    return new Promise<ResolvedAddressDetails>((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        const first = status === "OK" ? results?.[0] : null;
        const components = first?.address_components ?? [];
        const pick = (type: string) =>
          components.find((component) => component.types.includes(type))
            ?.long_name ?? null;

        const streetNumber = pick("street_number");
        const route = pick("route");
        const area =
          pick("sublocality_level_1") ??
          pick("sublocality") ??
          pick("neighborhood") ??
          pick("administrative_area_level_2");
        const city =
          pick("locality") ??
          pick("postal_town") ??
          pick("administrative_area_level_2");
        const stateOrProvince = pick("administrative_area_level_1");
        const label = first?.formatted_address ?? fallbackLabel;
        const addressLine1 =
          [streetNumber, route].filter(Boolean).join(" ").trim() ||
          route ||
          area ||
          city ||
          label;

        resolve({
          label,
          addressLine1,
          streetNumber,
          city,
          area,
          stateOrProvince,
        });
      });
    });
  }

  async function syncStoredProfile() {
    if (!accessToken) {
      return;
    }

    try {
      const response = await apiFetch("/me/profile", { auth: true });
      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const stored = loadStoredAuth();
      if (stored) {
        const nextUser = mergeStoredUserWithProfile(stored.user, payload);
        saveStoredAuth({ ...stored, user: nextUser });
        setSessionUser(nextUser);
      }
    } catch {
      // Do not block the homepage if profile refresh fails.
    }
  }

  function splitPhoneNumber(phone: string | null | undefined) {
    const trimmed = phone?.trim() ?? "";
    const matched = trimmed.match(/^(\+\d{1,4})(\d+)$/);
    if (matched) {
      return {
        phoneCountryCode: matched[1],
        phoneNumber: matched[2],
      };
    }

    return {
      phoneCountryCode: null,
      phoneNumber: trimmed,
    };
  }

  async function loadSavedAddressesNow() {
    if (!accessToken) {
      return [];
    }

    const response = await apiFetch("/me/addresses", { auth: true });
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const nextAddresses = Array.isArray(payload)
      ? payload.map(mapStoredAddress)
      : [];
    setSavedAddresses(nextAddresses);
    const defaultAddress = nextAddresses.find(
      (address) =>
        address.isDefault &&
        address.latitude != null &&
        address.longitude != null,
    );
    if (defaultAddress && !locationModalOpen && !savingSelectedAddress) {
      const nextCoords = {
        lat: defaultAddress.latitude!,
        lng: defaultAddress.longitude!,
      };
      const nextLabel =
        defaultAddress.addressSummary || defaultAddress.locationTitle;
      setSelectedCoords((current) =>
        current?.lat === nextCoords.lat && current.lng === nextCoords.lng
          ? current
          : nextCoords,
      );
      setSelectedLocationLabel((current) =>
        current === nextLabel ? current : nextLabel,
      );
      setLocationSelectionLocked(true);
    }
    return nextAddresses;
  }

  useEffect(() => {
    if (!hydrated || !accessToken) return;

    const refreshLocation = () => {
      void loadSavedAddressesNow();
    };
    window.addEventListener("focus", refreshLocation);
    const timer = window.setInterval(refreshLocation, 15000);
    return () => {
      window.removeEventListener("focus", refreshLocation);
      window.clearInterval(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, accessToken, locationModalOpen, savingSelectedAddress]);

  async function handleSelectSavedAddress(address: StoredCustomerAddress) {
    if (address.latitude == null || address.longitude == null) {
      return;
    }

    setSelectedCoords({ lat: address.latitude, lng: address.longitude });
    setSelectedLocationLabel(address.addressSummary || address.locationTitle);
    setLocationSelectionLocked(true);
    setLocationSaveMessage(null);

    if (accessToken && !address.isDefault) {
      const response = await apiFetch(`/me/addresses/${address.id}/default`, {
        method: "POST",
        auth: true,
      });
      if (response.ok) {
        await loadSavedAddressesNow();
        await syncStoredProfile();
      }
    }

    window.localStorage.setItem(
      LOCATION_STORAGE_KEY,
      JSON.stringify({
        coords: { lat: address.latitude, lng: address.longitude },
        label: address.addressSummary || address.locationTitle,
      }),
    );

    setLocationModalOpen(false);
  }

  async function handleConfirmSelectedLocation(
    coordinates = selectedCoords,
  ) {
    if (!coordinates) {
      return;
    }

    setLocationSaveMessage(null);
    setLocationSelectionLocked(true);

    if (!accessToken) {
      setCoords(coordinates);
      if (selectedLocationLabel) {
        localStorage.setItem(
          LOCATION_STORAGE_KEY,
          JSON.stringify({
            coords: coordinates,
            label: selectedLocationLabel,
          })
        );
      }
      setLocationModalOpen(false);
      return;
    }

    if (!sessionUser?.phone?.trim()) {
      setLocationSaveMessage(
        "Location was saved in this browser. Add a phone number to your profile to sync addresses.",
      );
      setCoords(coordinates);
      if (selectedLocationLabel) {
        localStorage.setItem(
          LOCATION_STORAGE_KEY,
          JSON.stringify({
            coords: coordinates,
            label: selectedLocationLabel,
          })
        );
      }
      setLocationModalOpen(false);
      return;
    }

    setSavingSelectedAddress(true);

    try {
      // Geocoding is best-effort — if Maps isn't ready yet, we still save with coordinates.
      let details: ResolvedAddressDetails;
      try {
        details = await resolveAddressDetails(
          coordinates.lat,
          coordinates.lng,
        );
      } catch {
        details = {
          label:
            selectedLocationLabel ||
            `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`,
          addressLine1: selectedLocationLabel || "Selected location",
          streetNumber: null,
          city: null,
          area: null,
          stateOrProvince: null,
        };
      }
      setSelectedLocationLabel(details.label);

      const existingAddress = savedAddresses.find((address) => {
        const sameCoords =
          address.latitude != null &&
          address.longitude != null &&
          Math.abs(address.latitude - coordinates.lat) < 0.0001 &&
          Math.abs(address.longitude - coordinates.lng) < 0.0001;

        return sameCoords;
      });

      if (existingAddress) {
        setSelectedLocationLabel(existingAddress.addressSummary || details.label);
        if (accessToken && !existingAddress.isDefault) {
          const defaultResponse = await apiFetch(
            `/me/addresses/${existingAddress.id}/default`,
            { method: "POST", auth: true },
          );
          if (!defaultResponse.ok) {
            throw new Error("Failed to set selected address as default.");
          }
        }
      } else {
        const phoneParts = splitPhoneNumber(sessionUser.phone);
        const phoneNumber =
          phoneParts.phoneNumber ||
          sessionUser.phone?.replace(/\D/g, "") ||
          "0000000000";
        const createRes = await apiFetch("/me/addresses", {
          method: "POST",
          auth: true,
          body: JSON.stringify({
            label: details.area ?? details.city ?? "Saved place",
            recipient_name: sessionUser.fullName || "YummyDoors user",
            phone_country_code: phoneParts.phoneCountryCode,
            phone_number: phoneNumber,
            email: sessionUser.email,
            address_line_1: details.addressLine1 || "Selected location",
            address_line_2: null,
            street_number: details.streetNumber,
            city: details.city,
            area: details.area,
            state_or_province: details.stateOrProvince,
            latitude: coordinates.lat,
            longitude: coordinates.lng,
            delivery_notes: null,
            is_default: true,
          }),
        });
        if (!createRes.ok) {
          const payload = await readJsonSafely(createRes);
          throw new Error(
            extractApiErrorMessage(payload, "Failed to save address."),
          );
        }
      }

      await Promise.all([loadSavedAddressesNow(), syncStoredProfile()]);
      setCoords(coordinates);
      setLocationModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : null;
      setLocationSaveMessage(
        message && message !== "Failed to fetch"
          ? message
          : "Could not save address. Check your connection and try again.",
      );
    } finally {
      setSavingSelectedAddress(false);
    }
  }

  async function handleUseCurrentLocation() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return;
    }

    setUsingCurrentLocation(true);
    setLocationSelectionLocked(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setCoords(next);
        setSelectedCoords(next);
        setSelectedLocationLabel("Resolving current location...");

        const label = await resolveAddressLabel(next.lat, next.lng);
        setSelectedLocationLabel(label);
        setUsingCurrentLocation(false);
      },
      () => {
        setSelectedLocationLabel("Unable to use current location");
        setUsingCurrentLocation(false);
      },
      { timeout: 10000 },
    );
  }

  if (loading) {
    return <HomeSkeleton />;
  }

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans antialiased overflow-x-hidden selection:bg-primary selection:text-white">
      <section className="relative z-30 flex min-h-[600px] flex-col items-center justify-center overflow-visible lg:min-h-[700px]">
        <div className="absolute inset-0 z-0">
          <Image
            fill
            src="https://images.unsplash.com/photo-1543353071-10c8ba85a904?q=80&w=2000&auto=format&fit=crop"
            alt="Friends eating"
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gray-900/50" />
        </div>

        <SiteNavbar variant="transparent" className="!border-b-0" />

        <div className="relative z-20 mt-10 flex w-full max-w-3xl flex-col px-6 md:mt-20">
          <h1
            className="mb-2 text-white"
            style={{ fontSize: "42px", fontWeight: 600, lineHeight: "42px" }}
          >
            Delivery or Takeaway Food
          </h1>
          <p
            className="mb-10 text-white"
            style={{ fontSize: "28px", fontWeight: 300, lineHeight: "42px" }}
          >
            The best restaurants at the best price
          </p>

          <div className="relative z-[95]" ref={locationDropdownRef}>
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity text-left"
            >
              <MapPin className="h-6 w-6 text-[#ef4444]" fill="currentColor" strokeWidth={1.5} />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-medium leading-tight">
                    {selectedLocationLabel === "Set delivery location"
                      ? "Set delivery location"
                      : selectedLocationLabel.split(',')[0]}
                  </span>
                  <ChevronDown className="h-5 w-5" />
                </div>
                {selectedLocationLabel !== "Set delivery location" && selectedLocationLabel.includes(",") && (
                  <span className="text-sm font-light text-white/80 leading-tight mt-0.5">
                    {selectedLocationLabel.split(',').slice(1).join(',').trim()}
                  </span>
                )}
              </div>
            </button>

            <div className="mt-3 flex w-full overflow-hidden rounded-[2px] bg-white/10 border border-white/20 backdrop-blur-sm">
              <input
                type="text"
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && foodSearch.trim()) {
                    window.location.href = `/restaurants?q=${encodeURIComponent(foodSearch.trim())}`;
                  }
                }}
                placeholder="Search for food or restaurant..."
                className="min-h-[52px] flex-1 border-0 bg-transparent px-5 text-[15px] text-white outline-none placeholder:text-white/60"
              />
              <button
                type="button"
                onClick={() => {
                  if (foodSearch.trim()) {
                    window.location.href = `/restaurants?q=${encodeURIComponent(foodSearch.trim())}`;
                  }
                }}
                className="min-h-[52px] whitespace-nowrap bg-white/20 px-8 text-[15px] font-medium text-white transition-colors hover:bg-white/30"
              >
                Find food
              </button>
            </div>

            {locationModalOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+14px)] z-[120] overflow-hidden rounded-[8px] border border-black/8 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.24)]">
                <div className="border-b border-black/6 bg-[#fcfcfa] px-5 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                        Selected location
                      </p>
                      <p className="mt-1 truncate text-[14px] font-medium text-[#20242b]">
                        {selectedLocationLabel}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleUseCurrentLocation()}
                        className="inline-flex h-9 items-center justify-center rounded-[4px] border border-black/10 bg-white px-4 text-[13px] font-medium text-[#20242b] transition hover:border-black/20 hover:bg-black/[0.02]"
                        disabled={usingCurrentLocation}
                      >
                        {usingCurrentLocation
                          ? "Locating..."
                          : "Use current location"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleConfirmSelectedLocation()}
                        disabled={savingSelectedAddress}
                        className="inline-flex h-9 items-center justify-center rounded-[4px] bg-primary px-4 text-[13px] font-semibold text-white transition hover:bg-primary/90"
                      >
                        {savingSelectedAddress
                          ? "Saving..."
                          : "Use this location"}
                      </button>
                    </div>
                  </div>
                </div>

                {locationSaveMessage ? (
                  <div className="border-b border-black/6 bg-[#fff8f2] px-5 py-2.5 text-[13px] text-[#9a3412]">
                    {locationSaveMessage}
                  </div>
                ) : null}

                {accessToken ? (
                  <div className="border-b border-black/6 bg-white px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                        Saved places
                      </p>
                      {addressesLoading ? (
                        <span className="text-[12px] text-[#6b7280]">
                          Loading...
                        </span>
                      ) : null}
                    </div>
                    {savedAddresses.length ? (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {savedAddresses.map((address) => (
                          <button
                            key={address.id}
                            type="button"
                            onClick={() =>
                              void handleSelectSavedAddress(address)
                            }
                            className={`min-w-[210px] rounded-[6px] border px-3 py-2.5 text-left transition ${
                              address.isDefault
                                ? "border-primary/20 bg-[#fff6f1]"
                                : "border-black/8 bg-[#fcfcfd] hover:border-black/15"
                            }`}
                          >
                            <p className="truncate text-[13px] font-medium text-[#20242b]">
                              {address.label ?? address.locationTitle}
                            </p>
                            <p className="mt-1 truncate text-[12px] text-[#6b7280]">
                              {address.addressSummary}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : addressesLoading ? null : (
                      <p className="mt-3 text-[13px] text-[#6b7280]">
                        No saved addresses yet. Confirm one from the map and we
                        will keep it here for quick select.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="p-3 md:p-4">
                  <MapPicker
                    latitude={selectedCoords?.lat ?? coords?.lat ?? null}
                    longitude={selectedCoords?.lng ?? coords?.lng ?? null}
                    onChange={(lat, lng) => {
                      setSelectedCoords({ lat, lng });
                      setSelectedLocationLabel("");
                      setLocationSelectionLocked(true);
                    }}
                    onResolvedAddress={(label) => {
                      setSelectedLocationLabel(label);
                      setLocationSelectionLocked(true);
                    }}
                    showSearch={true}
                    heightClassName="h-[360px]"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 text-sm font-light text-gray-300">
            Trending:{" "}
            {trendingTerms.length
              ? trendingTerms.map((term, index) => (
                  <span key={term}>
                    <span className="cursor-pointer font-medium text-white underline hover:text-primary">
                      {term}
                    </span>
                    {index === trendingTerms.length - 1 ? "" : ", "}
                  </span>
                ))
              : "Sushi, Burger, Chinese, Pizza"}
          </div>
        </div>
      </section>

      <main className="bg-white">
        <section className="relative z-20 pb-12 pt-6 md:pb-16 md:pt-8">
          <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-8 px-6 md:flex-row md:items-center md:justify-between md:px-10">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                Discover something delicious
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-[#222222] md:text-4xl">
                What do you want to eat?
              </h2>
              <p className="mt-2 text-sm text-[#6b7280]">
                Explore popular restaurants and fresh meals near you.
              </p>
            </div>

            <div
              className={cn(
                "h-[275px] w-[520px] max-w-full shrink-0 touch-pan-y select-none",
                heroIsDragging ? "cursor-grabbing" : "cursor-grab",
              )}
              onPointerDown={handleHeroPointerDown}
              onPointerMove={handleHeroPointerMove}
              onPointerUp={handleHeroPointerUp}
              onPointerLeave={endHeroDrag}
              onPointerCancel={endHeroDrag}
            >
              <Link
                href="/restaurants"
                className="block h-full overflow-hidden rounded-[12px] shadow-[0_18px_60px_rgba(15,23,42,0.10)]"
                onClick={(event) => {
                  if (heroWasDragged.current) {
                    event.preventDefault();
                    heroWasDragged.current = false;
                  }
                }}
                draggable={false}
              >
                <div
                  className="relative h-full w-full bg-contain bg-center bg-no-repeat bg-gray-100"
                  style={{
                    transform: `translateX(${heroDragOffset}px)`,
                    transition: heroIsDragging ? "none" : "transform 300ms ease",
                  }}
                >
                  <img
                    src={currentHeroPromoImage}
                    alt={currentHeroPromo.title}
                    className="absolute inset-0 h-full w-full object-cover object-center transition-all duration-500"
                    draggable={false}
                  />
                </div>
              </Link>
              <div className="mt-3 flex items-center justify-center gap-2">
                {activeHeroPromos.map((promo, index) => (
                  <button
                    key={promo.id}
                    type="button"
                    aria-label={`Go to hero promo ${index + 1}`}
                    onClick={() => heroPager.setIndex(index)}
                    className={`rounded-full transition-all duration-200 ${
                      index === heroPager.index
                        ? "h-2 w-6 bg-black"
                        : "h-2 w-2 bg-[#d9d9d9]"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {safeCategories.length > 0 && (
          <section className="pt-16 pb-12 overflow-hidden">
            <div className="text-center mb-10">
              <div className="w-[40px] h-[2px] bg-primary mx-auto mb-5"></div>
              <h2 className="text-[34px] font-medium text-[#222222] leading-[1.2]">
                Popular Categories
              </h2>
              <p className="text-[21px] font-light text-[#444444] mt-2 leading-[1.5]">
                Browse the cuisines shaping today&apos;s live YummyDoors feed.
              </p>
            </div>

            <div className="relative">
              <button
                onClick={catScroll.scrollPrev}
                className="absolute top-[50%] left-[16px] -translate-y-1/2 h-[42px] w-[42px] rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary transition-all z-50"
              >
                <ArrowRight
                  className="w-[16px] h-[16px] rotate-180"
                  strokeWidth={1.5}
                />
              </button>

              <div
                ref={catScroll.ref}
                {...catScroll.events}
                className={`flex gap-[16px] overflow-x-auto pb-4 scrollbar-hide pl-[100px] pr-[80px] ${catScroll.isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
                style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
              >
                {safeCategories.map((cat, i) => {
                  const categoryRestaurants = restaurants.filter((restaurant) =>
                    restaurant.categories?.some(
                      (restaurantCategory) =>
                        restaurantCategory.slug === cat.slug,
                    ),
                  );
                  const categoryItems = [
                    ...recommendedItems,
                    ...popularFoods,
                  ].filter((item) => item.category_id === cat.id);
                  const startingPrice = categoryItems.length
                    ? Math.min(...categoryItems.map((item) => item.price))
                    : null;
                  const categoryImage = isUsableImageUrl(
                      cat.web_image_url ?? cat.icon_url ?? undefined,
                  )
                    ? (cat.web_image_url ?? cat.icon_url ?? FALLBACK_MENU_ITEM_IMAGE)
                    : FALLBACK_MENU_ITEM_IMAGE;

                  return (
                    <Link
                      key={`${cat.slug}-${i}`}
                      href={`/restaurants?category=${encodeURIComponent(cat.slug)}`}
                      className="relative block h-[280px] w-[195px] shrink-0 overflow-hidden rounded-[4px]"
                    >
                      <Image
                        fill
                        src={categoryImage}
                        alt={cat.name}
                        className="object-cover"
                        sizes="195px"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                      <div className="absolute top-[12px] right-[12px] bg-white text-[#333333] text-[11px] font-semibold w-[30px] h-[30px] rounded-full flex items-center justify-center shadow">
                        {categoryRestaurants.length || 1}
                      </div>
                      <div className="absolute bottom-[16px] left-[14px] right-[14px]">
                        <h3 className="text-[16px] font-semibold text-white leading-none mb-1">
                          {cat.name}
                        </h3>
                        <p className="text-[12px] text-[#cccccc] font-normal">
                          {startingPrice
                            ? `From ${formatPrice(startingPrice)}`
                            : "Fresh picks available"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <button
                onClick={catScroll.scrollRight}
                className="absolute top-[50%] right-[24px] -translate-y-1/2 h-[42px] w-[42px] rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary transition-all z-50"
              >
                <ArrowRight className="w-[16px] h-[16px]" strokeWidth={1.5} />
              </button>
            </div>

            <style
              dangerouslySetInnerHTML={{
                __html: `.scrollbar-hide::-webkit-scrollbar { display: none; }`,
              }}
            />
          </section>
        )}

        <section className="pb-6">
          <div className="pl-[100px] pr-6">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Veg", href: "/restaurants?food_type=veg" },
                { label: "Non-Veg", href: "/restaurants?food_type=non_veg" },
                { label: "Free Delivery", href: "/restaurants?has_free_delivery=true" },
                { label: "Open Now", href: "/restaurants?open_now=true" },
                { label: "Top Rated", href: "/restaurants?sort_by=rating" },
                { label: "Fast Delivery", href: "/restaurants?sort_by=delivery_time" },
                { label: "Highly Reordered", href: "/restaurants?sort_by=highly_reordered" },
              ].map((chip) => (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className="inline-flex items-center rounded-full border border-gray-200 px-4 py-1.5 text-[13px] font-medium text-[#4b5563] transition hover:border-[#e8505b] hover:text-[#e8505b]"
                >
                  {chip.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {activeBannerPromos.length > 0 ? (
        <section className="pb-12">
          <div className="pl-[100px] pr-6">
            <div
              className={cn(
                "touch-pan-y select-none",
                bannerIsDragging ? "cursor-grabbing" : "cursor-grab",
              )}
              onPointerDown={handleBannerPointerDown}
              onPointerMove={handleBannerPointerMove}
              onPointerUp={handleBannerPointerUp}
              onPointerLeave={endBannerDrag}
              onPointerCancel={endBannerDrag}
            >
              <Link
                href="/restaurants"
                className="block overflow-hidden rounded-[12px] shadow-[0_16px_50px_rgba(15,23,42,0.08)]"
                onClick={(event) => {
                  if (bannerWasDragged.current) {
                    event.preventDefault();
                    bannerWasDragged.current = false;
                  }
                }}
                draggable={false}
              >
                <div
                  className="h-[203px] w-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${getPromoImage(currentBannerPromo)})`,
                    transform: `translateX(${bannerDragOffset}px)`,
                    transition: bannerIsDragging ? "none" : "transform 300ms ease, background-image 500ms ease",
                  }}
                />
              </Link>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              {activeBannerPromos.map((promo, index) => (
                <button
                  key={promo.id}
                  type="button"
                  aria-label={`Go to banner promo ${index + 1}`}
                  onClick={() => bannerPager.setIndex(index)}
                  className={`rounded-full transition-all duration-200 ${
                    index === bannerPager.index
                      ? "h-2 w-6 bg-black"
                      : "h-2 w-2 bg-[#d9d9d9]"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {recommendedItems.length > 0 && (
          <section className="py-12 bg-white">
            <div className="pl-[100px] pr-6">
              <div className="mb-8">
                <div className="w-[40px] h-[2px] bg-primary mb-4"></div>
                <h2 className="text-[28px] font-medium text-[#222222] leading-tight">
                  Recommended for You
                </h2>
                <p className="text-[16px] font-light text-[#555555] mt-1">
                  Based on your favourites and saved restaurants.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {recommendedItems.slice(0, 8).map((item) => {
                  const imgUrl = isUsableImageUrl(item.image_url ?? undefined)
                    ? item.image_url!
                    : FALLBACK_MENU_ITEM_IMAGE;
                  return (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div
                        className="h-[140px] w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${imgUrl})` }}
                      />
                      <div className="p-3">
                        <p className="truncate text-[14px] font-semibold text-[#222222]">
                          {item.name}
                        </p>
                        <p className="mt-1 text-[12px] text-[#777777]">
                          {item.currency_code} {item.price}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {popularFoods.length > 0 && (
          <section className="py-12 bg-gray-50/60">
            <div className="pl-[100px] pr-6">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <div className="w-[40px] h-[2px] bg-primary mb-4"></div>
                  <h2 className="text-[28px] font-medium text-[#222222] leading-tight">
                    Popular Foods
                  </h2>
                  <p className="text-[16px] font-light text-[#555555] mt-1">
                    Most hearted dishes across all restaurants.
                  </p>
                </div>
                <Link
                  href="/restaurants"
                  className="text-[13px] font-bold text-primary hover:text-gray-700 uppercase tracking-wider"
                >
                  View All
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {popularFoods.slice(0, 8).map((item) => {
                  const imgUrl = isUsableImageUrl(item.image_url ?? undefined)
                    ? item.image_url!
                    : FALLBACK_MENU_ITEM_IMAGE;
                  return (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div
                        className="h-[140px] w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${imgUrl})` }}
                      />
                      <div className="p-3">
                        <p className="truncate text-[14px] font-semibold text-[#222222]">
                          {item.name}
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-[12px] text-[#777777]">
                            {item.currency_code} {item.price}
                          </p>
                          {item.is_spicy && (
                            <span className="text-[10px] font-semibold text-[#e11d48]">
                              🌶 Spicy
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {featuredVideos.length > 0 && (
          <section className="py-12 bg-white">
            <div className="pl-[100px] pr-6">
              <div className="mb-8">
                <div className="w-[40px] h-[2px] bg-primary mb-4"></div>
                <h2 className="text-[28px] font-medium text-[#222222] leading-tight">
                  Featured Videos
                </h2>
                <p className="text-[16px] font-light text-[#555555] mt-1">
                  Watch before you order.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {featuredVideos.map((video) => (
                  <a
                    key={video.id}
                    href={video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      className="relative h-[140px] w-full bg-cover bg-center"
                      style={{
                        backgroundImage: isUsableImageUrl(
                          video.thumbnail_url ?? undefined,
                        )
                          ? `url(${video.thumbnail_url})`
                          : `url(https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop)`,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/40">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow">
                          <svg
                            className="ml-0.5 h-4 w-4 text-[#333]"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-[13px] font-semibold text-[#222222]">
                        {video.title}
                      </p>
                      {video.subtitle && (
                        <p className="mt-0.5 truncate text-[11px] text-[#777]">
                          {video.subtitle}
                        </p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {safeRestaurants.length > 0 && (
          <section className="bg-gray-50/60 py-12">
            <div className="pl-[100px] pr-6 flex justify-between items-end mb-8 border-b border-gray-200 pb-5">
              <div>
                <div className="w-[40px] h-[2px] bg-primary mb-4"></div>
                <h2 className="text-[34px] font-medium text-[#222222] leading-[1.2]">
                  Top Rated Restaurants
                </h2>
                <p className="text-[21px] font-light text-[#444444] mt-2 leading-[1.5]">
                  Live restaurants available for{" "}
                  {locationContext.location_title}.
                </p>
              </div>
              <Link
                href="/restaurants"
                className="text-[13px] font-bold text-primary hover:text-gray-700 uppercase tracking-wider"
              >
                View All
              </Link>
            </div>

            <div className="relative">
              <button
                onClick={restScroll.scrollPrev}
                className="absolute top-[100px] left-[16px] h-[42px] w-[42px] rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary transition-all z-50"
              >
                <ArrowRight
                  className="w-[16px] h-[16px] rotate-180"
                  strokeWidth={1.5}
                />
              </button>

              <div
                ref={restScroll.ref}
                {...restScroll.events}
                className={`flex gap-[18px] overflow-x-auto pb-8 scrollbar-hide pl-[120px] ${restScroll.isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
                style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
              >
                {safeRestaurants.map((r, i) => {
                  const coverUrl = isUsableImageUrl(
                    r.cover_image_url ?? undefined,
                  )
                    ? (r.cover_image_url ?? FALLBACK_RESTAURANT_COVER)
                    : FALLBACK_RESTAURANT_COVER;

                  return (
                    <div
                      key={`${r.slug}-${i}`}
                      className="shrink-0 w-[300px] bg-white border border-gray-200/60 rounded-[4px] overflow-hidden flex flex-col hover:shadow-lg transition-shadow duration-300"
                    >
                      <div className="relative h-[200px] w-full overflow-hidden bg-gray-100">
                        <Image
                          fill
                          src={coverUrl}
                          alt={r.name}
                          className="object-cover"
                          sizes="300px"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                        <div className="absolute top-4 left-4 bg-white text-gray-800 text-[10px] font-bold px-2.5 py-1 rounded-[3px] shadow-sm uppercase tracking-wider flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                          {r.primary_cuisine_label ?? "Restaurant"}
                        </div>

                        <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-[3px] uppercase tracking-wider">
                          {r.offer_text ??
                            (r.has_free_delivery
                              ? "Free delivery"
                              : "Open now")}
                        </div>

                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="text-[17px] font-semibold text-white mb-0.5">
                            {r.name}
                          </h3>
                          <p className="text-[12px] text-gray-300">
                            {[r.area, r.city].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between px-4 py-3 bg-white">
                        <div className="flex items-center gap-3 text-[12px] text-gray-500">
                          <span className="flex items-center gap-1 pointer-events-auto">
                            <svg
                              className="w-[13px] h-[13px]"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                              <line x1="3" y1="6" x2="21" y2="6"></line>
                              <path d="M16 10a4 4 0 0 1-8 0"></path>
                            </svg>{" "}
                            Take away
                          </span>
                          <span className="flex items-center gap-1 pointer-events-auto">
                            <svg
                              className="w-[13px] h-[13px]"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>{" "}
                            {r.delivery_eta_min_minutes &&
                            r.delivery_eta_max_minutes
                              ? `${r.delivery_eta_min_minutes}-${r.delivery_eta_max_minutes} min`
                              : "Delivery"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[12px] font-bold text-[#32a067]">
                          <Star className="w-[13px] h-[13px] fill-[#32a067]" />{" "}
                          {r.rating_average}
                        </div>
                      </div>
                      <div className="border-t border-gray-100 px-4 py-3">
                        <Link
                          href={`/restaurants/${r.slug}`}
                          className="pointer-events-auto inline-flex items-center text-[12px] font-semibold uppercase tracking-[0.12em] text-primary transition hover:text-[#d84c1d]"
                        >
                          Open restaurant
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={restScroll.scrollRight}
                className="absolute top-[100px] right-6 h-[44px] w-[44px] rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary transition-all z-50"
              >
                <ArrowRight className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
            </div>
          </section>
        )}

        <section className="bg-white py-14">
          <div className="pl-[100px] pr-6">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <div className="w-[40px] h-[2px] bg-primary mb-4"></div>
                <h2 className="text-[34px] font-medium text-[#222222] leading-[1.2]">
                  Explore Restaurants
                </h2>
                <p className="text-[18px] font-light text-[#555555] mt-2">
                  Most-ordered restaurants near you.
                </p>
              </div>
              <Link
                href="/restaurants"
                className="text-[13px] font-bold text-primary hover:text-gray-700 uppercase tracking-wider"
              >
                View All
              </Link>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={exploreScroll.scrollPrev}
              className="absolute top-[68px] left-[16px] h-[42px] w-[42px] rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary transition-all z-50"
            >
              <ArrowRight
                className="w-[16px] h-[16px] rotate-180"
                strokeWidth={1.5}
              />
            </button>

            <div
              ref={exploreScroll.ref}
              {...exploreScroll.events}
              className={`flex gap-5 overflow-x-auto pb-2 scrollbar-hide pl-[100px] pr-[80px] ${exploreScroll.isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
              style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
            >
              {exploreRestaurants.slice(0, 8).map((r) => {
                const coverUrl = isUsableImageUrl(
                  r.cover_image_url ?? undefined,
                )
                  ? (r.cover_image_url ?? FALLBACK_RESTAURANT_COVER)
                  : FALLBACK_RESTAURANT_COVER;
                return (
                  <Link
                    key={r.slug}
                    href={`/restaurants/${r.slug}`}
                    className="group w-[300px] shrink-0 overflow-hidden rounded-[8px] border border-gray-200/60 bg-white shadow-sm hover:shadow-lg transition-shadow duration-300"
                  >
                    <div className="relative h-[200px] w-full overflow-hidden bg-gray-100">
                      <Image
                        fill
                        src={coverUrl}
                        alt={r.name}
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="300px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {r.offer_text || r.has_free_delivery ? (
                        <div className="absolute top-3 right-3 rounded-[3px] bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                          {r.offer_text ?? "Free delivery"}
                        </div>
                      ) : null}
                      <div className="absolute bottom-3 left-4 right-4">
                        <h3 className="text-[16px] font-semibold text-white">
                          {r.name}
                        </h3>
                        <p className="text-[12px] text-gray-300">
                          {[r.area, r.city].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <p className="text-[12px] text-gray-500">
                        {r.primary_cuisine_label ?? "Restaurant"}
                      </p>
                      <div className="flex items-center gap-1 text-[12px] font-semibold text-[#32a067]">
                        <Star className="h-3 w-3 fill-[#32a067]" />{" "}
                        {r.rating_average.toFixed(1)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <button
              onClick={exploreScroll.scrollRight}
              className="absolute top-[68px] right-6 h-[42px] w-[42px] rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary transition-all z-50"
            >
              <ArrowRight className="w-[16px] h-[16px]" strokeWidth={1.5} />
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />

      {cookieModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delivery promotion"
            className="relative w-full max-w-[750px] overflow-hidden bg-white shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close promotion"
              onClick={() => setCookieModalOpen(false)}
              className="absolute right-4 top-3 z-10 text-3xl font-light leading-none text-gray-700 hover:text-black"
            >
              ×
            </button>
            <div className="relative aspect-[4/5] max-h-[82vh] w-full">
              <Image
                fill
                priority
                src={getPromoImage(cookiePromos[cookiePromoIndex])}
                alt={cookiePromos[cookiePromoIndex]?.title ?? "Delivery service"}
                className="object-cover"
                sizes="(max-width: 768px) 92vw, 750px"
              />
            </div>
            {cookiePromos.length > 1 ? (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                {cookiePromos.map((promo, index) => (
                  <span
                    key={promo.id}
                    className={`h-2 w-2 rounded-full ${index === cookiePromoIndex ? "bg-white" : "bg-white/50"}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
